"""
Idempotent benchmark importer for LLM Bench (UI-3).
Reads benchmark/results/*.csv, drops errors/short prompts/unplugged runs,
aggregates per (machine_label, model_tag, quantization) using medians,
matches to models by stripped ollama_tag and params, and upserts into benchmark_results with source='measured'.
"""
import glob
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from database import SessionLocal
from models import BenchmarkResult, Model, ModelQuant
from utils_time import utcnow

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_benchmarks")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = PROJECT_ROOT / "benchmark" / "results"


def parse_timestamp(val: any) -> Optional[datetime]:
    if pd.isna(val) or not val:
        return None
    try:
        dt = pd.to_datetime(val)
        if dt.tzinfo is not None:
            dt = dt.tz_convert("UTC").tz_localize(None)
        return dt.to_pydatetime()
    except Exception:
        return None


def import_benchmarks():
    print("=" * 60)
    print("LLM Bench Benchmark Importer (UI-3)")
    print("=" * 60)

    csv_files = list(RESULTS_DIR.glob("*.csv"))
    if not csv_files:
        print(f"[WARN] No CSV files found in {RESULTS_DIR}")
        return

    print(f"[INFO] Found {len(csv_files)} CSV file(s) in {RESULTS_DIR}:")
    for f in csv_files:
        print(f"  - {f.name}")

    dfs = []
    for f in csv_files:
        try:
            df = pd.read_csv(f)
            df["source_file"] = f.name
            dfs.append(df)
        except Exception as e:
            print(f"[ERROR] Failed to read {f.name}: {e}")

    if not dfs:
        return

    combined = pd.concat(dfs, ignore_index=True)
    n_initial = len(combined)
    print(f"\n[INFO] Loaded {n_initial} raw benchmark rows.")

    # 1. Filter: Drop rows with errors
    if "error" in combined.columns:
        valid_error = combined["error"].isna() | (combined["error"] == "") | (combined["error"] == "None")
        combined = combined[valid_error]
    print(f"[INFO] After dropping error rows: {len(combined)} rows remaining.")

    # 2. Filter: Drop prompt_label == "short"
    if "prompt_label" in combined.columns:
        combined = combined[combined["prompt_label"] != "short"]
    print(f"[INFO] After dropping 'short' prompt rows: {len(combined)} rows remaining.")

    # 3. Filter: Drop ac_plugged == False (if column present)
    if "ac_plugged" in combined.columns:
        def is_plugged(v):
            if pd.isna(v):
                return True
            if isinstance(v, bool):
                return v
            s = str(v).lower().strip()
            return s not in ("false", "0", "no")
        combined = combined[combined["ac_plugged"].apply(is_plugged)]
    print(f"[INFO] After dropping unplugged rows: {len(combined)} rows remaining.")

    if len(combined) == 0:
        print("[WARN] No valid benchmark rows remaining after filtering.")
        return

    # Normalize column types
    for num_col in ["tokens_per_sec", "ttft_ms", "gpu_offload_fraction", "peak_vram_used_gb", "vram_total_gb", "ram_total_gb", "params_b"]:
        if num_col in combined.columns:
            combined[num_col] = pd.to_numeric(combined[num_col], errors="coerce")

    # Group by (machine_label, model_tag, quantization)
    group_cols = ["machine_label", "model_tag", "quantization"]
    missing_cols = [c for c in group_cols if c not in combined.columns]
    if missing_cols:
        print(f"[ERROR] Missing required grouping columns: {missing_cols}")
        return

    groups = combined.groupby(group_cols)
    print(f"[INFO] Formed {len(groups)} distinct (machine, model, quant) group(s) for aggregation.\n")

    db: Session = SessionLocal()
    try:
        all_models = db.query(Model).all()
        imported_count = 0
        updated_count = 0
        unmatched_count = 0

        for (machine_label, model_tag, quant), group_df in groups:
            # Check calendar date drift (> 15% difference in medians between dates)
            if "timestamp" in group_df.columns:
                group_df["_date"] = pd.to_datetime(group_df["timestamp"]).dt.date
                date_medians = group_df.groupby("_date")["tokens_per_sec"].median()
                if len(date_medians) > 1:
                    min_m = float(date_medians.min())
                    max_m = float(date_medians.max())
                    drift_pct = ((max_m - min_m) / min_m * 100.0) if min_m > 0 else 0.0
                    if drift_pct > 15.0:
                        newest_date = group_df["_date"].max()
                        print(f"[DRIFT] Config ({machine_label}, {model_tag}, {quant}) medians differ by {drift_pct:.1f}% across dates. Retaining only newest date ({newest_date}).")
                        group_df = group_df[group_df["_date"] == newest_date]

            n_runs = len(group_df)
            tps_median = float(group_df["tokens_per_sec"].median()) if "tokens_per_sec" in group_df else 0.0
            ttft_median = int(round(group_df["ttft_ms"].median())) if "ttft_ms" in group_df and not pd.isna(group_df["ttft_ms"].median()) else 0
            offload_median = float(group_df["gpu_offload_fraction"].median()) if "gpu_offload_fraction" in group_df and not pd.isna(group_df["gpu_offload_fraction"].median()) else 1.0
            peak_vram_median = float(group_df["peak_vram_used_gb"].median()) if "peak_vram_used_gb" in group_df and not pd.isna(group_df["peak_vram_used_gb"].median()) else 0.0
            vram_gb = float(group_df["vram_total_gb"].iloc[0]) if "vram_total_gb" in group_df and not pd.isna(group_df["vram_total_gb"].iloc[0]) else 4.0
            ram_gb = float(group_df["ram_total_gb"].iloc[0]) if "ram_total_gb" in group_df and not pd.isna(group_df["ram_total_gb"].iloc[0]) else 16.0
            gpu_name = str(group_df["gpu_name"].iloc[0]) if "gpu_name" in group_df and not pd.isna(group_df["gpu_name"].iloc[0]) else "Unknown GPU"
            params_b = float(group_df["params_b"].iloc[0]) if "params_b" in group_df and not pd.isna(group_df["params_b"].iloc[0]) else 3.0

            measured_at = None
            if "timestamp" in group_df.columns:
                measured_at = parse_timestamp(group_df["timestamp"].max())
            if not measured_at:
                measured_at = utcnow()

            # Matching to model
            base_tag = str(model_tag).split(":")[0].strip().lower()
            matched_model: Optional[Model] = None
            unmatch_reason = None

            # First find models sharing the base tag
            candidates = [m for m in all_models if m.ollama_tag and m.ollama_tag.split(":")[0].strip().lower() == base_tag]
            if candidates:
                # Disambiguate by params_b proximity
                candidates.sort(key=lambda m: abs(float(m.params_b or 0.0) - params_b))
                best_cand = candidates[0]
                if abs(float(best_cand.params_b or 0.0) - params_b) <= 1.5:
                    matched_model = best_cand
                else:
                    unmatch_reason = f"Tag base '{base_tag}' matched model '{best_cand.name}' ({best_cand.params_b}B), but CSV params ({params_b}B) differ by > 1.5B"
            else:
                unmatch_reason = f"No model in DB matches tag '{model_tag}' (base: '{base_tag}')"

            if not matched_model:
                print(f"[UNMATCHED] ({machine_label}, {model_tag}, {quant}) - Reason: {unmatch_reason}")
                unmatched_count += 1
                continue

            # Verify model has this quant in model_quants (case-insensitive)
            quant_clean = str(quant).strip()
            model_quants = {q.quant.lower(): q for q in matched_model.quants}
            if quant_clean.lower() not in model_quants:
                avail_quants = [q.quant for q in matched_model.quants]
                print(f"[UNMATCHED] ({machine_label}, {model_tag}, {quant}) - Reason: Model '{matched_model.name}' has no '{quant_clean}' quantization (available: {avail_quants})")
                unmatched_count += 1
                continue

            # Upsert into benchmark_results
            existing = db.query(BenchmarkResult).filter(
                BenchmarkResult.machine_label == machine_label,
                BenchmarkResult.model_id == matched_model.id,
                BenchmarkResult.quant == quant_clean,
            ).first()

            if existing:
                existing.gpu_name = gpu_name
                existing.vram_gb = vram_gb
                existing.ram_gb = ram_gb
                existing.tokens_per_sec = round(tps_median, 2)
                existing.ttft_ms = ttft_median
                existing.offload_fraction = round(offload_median, 3)
                existing.peak_vram_gb = round(peak_vram_median, 2)
                existing.measured_at = measured_at
                existing.ac_plugged = True
                existing.n_runs = n_runs
                existing.source = "measured"
                updated_count += 1
                print(f"[UPDATE] {matched_model.name} ({matched_model.params_b}B) [{quant_clean}] on {machine_label}: {tps_median:.1f} tps, TTFT {ttft_median} ms, {n_runs} runs.")
            else:
                new_row = BenchmarkResult(
                    machine_label=machine_label,
                    model_id=matched_model.id,
                    quant=quant_clean,
                    gpu_name=gpu_name,
                    vram_gb=vram_gb,
                    ram_gb=ram_gb,
                    tokens_per_sec=round(tps_median, 2),
                    ttft_ms=ttft_median,
                    offload_fraction=round(offload_median, 3),
                    peak_vram_gb=round(peak_vram_median, 2),
                    measured_at=measured_at,
                    ac_plugged=True,
                    n_runs=n_runs,
                    source="measured",
                    submitted_at=utcnow(),
                )
                db.add(new_row)
                imported_count += 1
                print(f"[INSERT] {matched_model.name} ({matched_model.params_b}B) [{quant_clean}] on {machine_label}: {tps_median:.1f} tps, TTFT {ttft_median} ms, {n_runs} runs.")

        total_configs = len(groups)
        imported_total = imported_count + updated_count
        db.commit()
        print("\n" + "=" * 60)
        print("IMPORT TOTALS")
        print("=" * 60)
        print(f"Total configs in CSV: {total_configs} | Imported: {imported_total} | Unmatched: {unmatched_count}")
        print(f"  - Inserted new benchmark records: {imported_count}")
        print(f"  - Updated existing benchmark records: {updated_count}")
        print(f"  - Unmatched configs: {unmatched_count}")
        print("=" * 60 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    import_benchmarks()
