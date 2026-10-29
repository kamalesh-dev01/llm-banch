import glob
import json
import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from ml.config import (
    DATA_FILTERS_PATH,
    MIN_CONFIGS_WARN,
    MIN_OUTPUT_TOKENS,
    RESULTS_DIR,
    USE_PROMPTS,
)

logger = logging.getLogger(__name__)


def load_configs(results_dir: Optional[Path] = None) -> pd.DataFrame:
    """
    Reads all CSV files from results_dir, filters, validates, and aggregates
    to config-level medians.
    """
    results_path = results_dir or RESULTS_DIR
    csv_files = glob.glob(str(Path(results_path) / "*.csv"))

    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {results_path}")

    dfs = []
    for f in csv_files:
        try:
            df_file = pd.read_csv(f)
            dfs.append(df_file)
        except Exception as e:
            print(f"[WARN] Failed to read {f}: {e}")

    if not dfs:
        raise ValueError(f"No valid data could be read from CSV files in {results_path}")

    raw_df = pd.concat(dfs, ignore_index=True)

    # 1. Drop rows with errors
    if "error" in raw_df.columns:
        err_mask = raw_df["error"].notna() & (raw_df["error"].astype(str).str.strip() != "")
        dropped_errs = int(err_mask.sum())
        if dropped_errs > 0:
            print(f"[INFO] Dropped {dropped_errs} rows with errors.")
        df = raw_df[~err_mask].copy()
    else:
        df = raw_df.copy()

    # 2. Filter prompt_label in USE_PROMPTS
    if "prompt_label" in df.columns:
        before_prompt = len(df)
        df = df[df["prompt_label"].isin(USE_PROMPTS)].copy()
        dropped_prompts = before_prompt - len(df)
        if dropped_prompts > 0:
            print(f"[INFO] Dropped {dropped_prompts} rows with prompts not in {USE_PROMPTS}.")

    # 3. Filter output_tokens >= MIN_OUTPUT_TOKENS
    if "output_tokens" in df.columns:
        before_out = len(df)
        df = df[pd.to_numeric(df["output_tokens"], errors="coerce").fillna(0) >= MIN_OUTPUT_TOKENS].copy()
        dropped_out = before_out - len(df)
        if dropped_out > 0:
            print(f"[INFO] Dropped {dropped_out} rows with output_tokens < {MIN_OUTPUT_TOKENS}.")

    # 4. Filter data_filters.json
    if DATA_FILTERS_PATH.exists():
        try:
            with open(DATA_FILTERS_PATH, "r", encoding="utf-8") as f:
                filters_cfg = json.load(f)
            excludes = filters_cfg.get("exclude", [])
            for exc in excludes:
                m_label = exc.get("machine_label")
                m_tag = exc.get("model_tag")
                exc_date = exc.get("date")

                mask = pd.Series(True, index=df.index)
                if m_label:
                    mask = mask & (df["machine_label"] == m_label)
                if m_tag:
                    mask = mask & (df["model_tag"] == m_tag)
                if exc_date and "timestamp" in df.columns:
                    mask = mask & (df["timestamp"].astype(str).str.startswith(exc_date))

                dropped_exc = int(mask.sum())
                if dropped_exc > 0:
                    print(f"[INFO] Dropped {dropped_exc} rows matching filter: {exc}")
                    df = df[~mask].copy()
        except Exception as e:
            print(f"[WARN] Error applying data_filters.json: {e}")

    # 5. Check ac_plugged
    if "ac_plugged" in df.columns:
        # Drop rows where ac_plugged is False (boolean or string "False"/"false")
        ac_series = df["ac_plugged"].astype(str).str.lower().replace({"nan": None, "none": None, "": None})
        unplugged = ac_series == "false"
        dropped_ac = int(unplugged.sum())
        if dropped_ac > 0:
            print(f"[INFO] Dropped {dropped_ac} rows where ac_plugged was False.")
            df = df[~unplugged].copy()
    else:
        print("[NOTE] 'ac_plugged' column not present in CSV; skipping battery power check.")

    # 6. Check avg_sm_clock_mhz and multi-session variance
    if "avg_sm_clock_mhz" in df.columns:
        if "timestamp" in df.columns:
            # Check clock variance across sessions (dates)
            df["_date"] = df["timestamp"].astype(str).str.slice(0, 10)  # YYYY-MM-DD
            config_cols = ["machine_label", "model_tag", "quantization"]
            for (mlab, mtag, quant), group in df.groupby(config_cols):
                dates = group["_date"].unique()
                if len(dates) > 1:
                    date_clocks = group.groupby("_date")["avg_sm_clock_mhz"].mean()
                    min_clock = date_clocks.min()
                    max_clock = date_clocks.max()
                    if min_clock > 0 and (max_clock / min_clock - 1.0) > 0.15:
                        print(
                            f"[WARN] Clock variance >15% for ({mlab}, {mtag}, {quant}) "
                            f"across sessions ({min_clock:.0f} vs {max_clock:.0f} MHz). "
                            f"Thermal throttling suspected."
                        )
            df.drop(columns=["_date"], inplace=True, errors="ignore")
    else:
        print("[NOTE] 'avg_sm_clock_mhz' column not present in CSV; skipping clock variance check.")

    # 7. Check file_size_gb
    if "file_size_gb" not in df.columns:
        print("[NOTE] 'file_size_gb' column not present; will use footprint map defaults (a=1.1, b=0.1).")
        df["file_size_gb"] = np.nan
    else:
        # Values <= 0 treated as missing
        df.loc[pd.to_numeric(df["file_size_gb"], errors="coerce") <= 0, "file_size_gb"] = np.nan

    # Ensure numeric columns
    numeric_cols = [
        "tokens_per_sec",
        "prompt_tokens_per_sec",
        "ttft_ms",
        "load_ms",
        "peak_vram_used_gb",
        "avg_gpu_util",
        "gpu_offload_fraction",
        "params_b",
        "model_size_gb",
        "file_size_gb",
        "vram_total_gb",
        "gpu_mem_bandwidth_gbps",
        "ram_total_gb",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 8. Aggregation: group by config = (machine_label, model_tag, quantization)
    config_keys = ["machine_label", "model_tag", "quantization"]
    missing_keys = [k for k in config_keys if k not in df.columns]
    if missing_keys:
        raise ValueError(f"Missing required config columns: {missing_keys}")

    median_cols = [
        "tokens_per_sec",
        "prompt_tokens_per_sec",
        "ttft_ms",
        "peak_vram_used_gb",
        "avg_gpu_util",
        "gpu_offload_fraction",
    ]
    median_cols_present = [c for c in median_cols if c in df.columns]

    first_cols = [
        "gpu_name",
        "vram_total_gb",
        "gpu_mem_bandwidth_gbps",
        "ram_total_gb",
        "cpu_name",
        "params_b",
        "model_size_gb",
        "file_size_gb",
    ]
    first_cols_present = [c for c in first_cols if c in df.columns]

    agg_dict = {col: "median" for col in median_cols_present}
    for col in first_cols_present:
        agg_dict[col] = "first"

    configs_df = df.groupby(config_keys, as_index=False).agg(agg_dict).reset_index(drop=True)

    # Compute ms_per_token = 1000.0 / tokens_per_sec
    configs_df["ms_per_token"] = 1000.0 / configs_df["tokens_per_sec"]

    # Compute group column:
    # If multiple machines exist, group by machine_label; if single machine, group by config
    if configs_df["machine_label"].nunique() > 1:
        configs_df["group"] = configs_df["machine_label"]
    else:
        configs_df["group"] = (
            configs_df["machine_label"]
            + "__"
            + configs_df["model_tag"]
            + "__"
            + configs_df["quantization"]
        )

    # Check config count
    n_configs = len(configs_df)
    if n_configs < MIN_CONFIGS_WARN:
        print(f"[WARN] Dataset contains only {n_configs} configs. Minimum recommended is {MIN_CONFIGS_WARN}.")
        print("       Results are illustrative only. Collect more benchmark data before relying on these predictions.")

    return configs_df
