import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
from sklearn.model_selection import LeaveOneGroupOut

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import joblib

from ml.config import (
    ARTIFACT_DIR,
    MAX_MAPE_PCT,
    MIN_CONFIGS_WARN,
    DEFAULT_RAM_BW_GBPS,
)
from ml.data_prep import load_configs
from ml.features import (
    fit_footprint_map,
    fit_reserve_gb,
    physics_features,
)


from ml.models import MeanBaseline, TheoryBaseline, PhysicsLinear


def evaluate_logo_cv(
    configs_df: pd.DataFrame,
    reserve_gb: float,
) -> Tuple[Dict[str, Dict[str, float]], Dict[str, np.ndarray], np.ndarray, np.ndarray]:
    """
    Runs Leave-One-Group-Out CV on configs_df for:
      - MeanBaseline
      - TheoryBaseline
      - PhysicsLinear
      - RandomForest
    Returns (metrics_dict, oof_preds_tps, true_tps, groups).
    """
    groups = configs_df["group"].values
    y_true_ms = configs_df["ms_per_token"].values
    y_true_tps = 1000.0 / y_true_ms

    # Feature sets
    footprint = configs_df["model_size_gb"].values
    vram = configs_df["vram_total_gb"].values
    bw = configs_df["gpu_mem_bandwidth_gbps"].values

    x_gpu, x_cpu, f_offload = physics_features(
        footprint_gb=footprint,
        vram_gb=vram,
        bandwidth_gbps=bw,
        reserve_gb=reserve_gb,
    )
    X_phys = np.column_stack([x_gpu, x_cpu])

    # RandomForest features: [model_size_gb, vram_total_gb, gpu_mem_bandwidth_gbps, ram_total_gb, params_b]
    rf_cols = ["model_size_gb", "vram_total_gb", "gpu_mem_bandwidth_gbps", "ram_total_gb", "params_b"]
    X_rf = configs_df[rf_cols].fillna(0.0).values

    n_samples = len(configs_df)
    oof_ms = {
        "MeanBaseline": np.zeros(n_samples),
        "TheoryBaseline": np.zeros(n_samples),
        "PhysicsLinear": np.zeros(n_samples),
        "RandomForest": np.zeros(n_samples),
    }

    logo = LeaveOneGroupOut()
    splits = list(logo.split(X_phys, y_true_ms, groups))

    for train_idx, test_idx in splits:
        y_train = y_true_ms[train_idx]

        # 1. MeanBaseline
        mean_model = MeanBaseline().fit(X_phys[train_idx], y_train)
        oof_ms["MeanBaseline"][test_idx] = mean_model.predict(X_phys[test_idx])

        # 2. TheoryBaseline
        theory_model = TheoryBaseline().fit(X_phys[train_idx], y_train)
        oof_ms["TheoryBaseline"][test_idx] = theory_model.predict(X_phys[test_idx])

        # 3. PhysicsLinear (excess over bandwidth floor)
        phys_model = PhysicsLinear()
        phys_model.fit(X_phys[train_idx], y_train, f_offload=f_offload[train_idx])
        oof_ms["PhysicsLinear"][test_idx] = phys_model.predict(X_phys[test_idx])

        # 4. RandomForest (safe min_samples_leaf for small datasets)
        min_leaf = max(1, min(2, len(train_idx) // 2))
        rf_model = RandomForestRegressor(
            n_estimators=50,
            max_depth=3,
            min_samples_leaf=min_leaf,
            random_state=42,
        )
        rf_model.fit(X_rf[train_idx], y_train)
        oof_ms["RandomForest"][test_idx] = rf_model.predict(X_rf[test_idx])

    # Convert out-of-fold ms/token to tokens/sec space and compute metrics
    metrics = {}
    oof_tps = {}

    for name in oof_ms:
        pred_ms = np.maximum(oof_ms[name], 1.0)  # clamp >= 1ms
        pred_tps = 1000.0 / pred_ms
        oof_tps[name] = pred_tps

        mae = float(np.mean(np.abs(pred_tps - y_true_tps)))
        mape = float(np.mean(np.abs((pred_tps - y_true_tps) / y_true_tps)) * 100.0)
        r2 = float(r2_score(y_true_tps, pred_tps)) if len(y_true_tps) >= 2 else 0.0

        metrics[name] = {
            "mae_tps": round(mae, 2),
            "mape_pct": round(mape, 2),
            "r2": round(r2, 4),
        }

    return metrics, oof_tps, y_true_tps, groups


def generate_plots(
    configs_df: pd.DataFrame,
    winner_name: str,
    winner_oof_tps: np.ndarray,
    y_true_tps: np.ndarray,
    output_dir: Path,
):
    """Saves pred_vs_actual.png and per_config_error.png."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Pred vs Actual scatter plot
    plt.figure(figsize=(7, 6))
    plt.scatter(y_true_tps, winner_oof_tps, color="#38bdf8", s=80, edgecolors="#0f172a", alpha=0.9, zorder=3)
    
    max_val = max(np.max(y_true_tps), np.max(winner_oof_tps)) * 1.15
    min_val = 0
    plt.plot([min_val, max_val], [min_val, max_val], "r--", alpha=0.7, label="Ideal (y = x)")

    # Label points with model tags
    for i, tag in enumerate(configs_df["model_tag"]):
        plt.annotate(
            tag,
            (y_true_tps[i], winner_oof_tps[i]),
            textcoords="offset points",
            xytext=(5, 5),
            fontsize=8,
            color="#334155",
        )

    plt.xlabel("Actual Speed (tokens/sec)")
    plt.ylabel(f"Predicted Speed (tokens/sec) [{winner_name}]")
    plt.title("Actual vs Predicted Tokens/sec (Leave-One-Group-Out CV)")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_dir / "pred_vs_actual.png", dpi=150)
    plt.close()

    # 2. Per-config percentage error bar chart
    pct_errors = ((winner_oof_tps - y_true_tps) / y_true_tps) * 100.0
    config_labels = [
        f"{row['model_tag']} ({row['quantization']})" for _, row in configs_df.iterrows()
    ]

    plt.figure(figsize=(8, 5))
    colors = ["#f87171" if abs(e) > 30 else "#38bdf8" for e in pct_errors]
    bars = plt.barh(config_labels, pct_errors, color=colors, edgecolor="#0f172a", alpha=0.85)
    plt.axvline(0, color="#64748b", linestyle="--", linewidth=1)
    plt.axvline(30, color="#f87171", linestyle=":", alpha=0.5, label="±30% Threshold")
    plt.axvline(-30, color="#f87171", linestyle=":", alpha=0.5)

    plt.xlabel("Prediction Error (%) [Positive = Overestimated]")
    plt.ylabel("Hardware / Model Config")
    plt.title("Prediction Error by Config (LOGO CV)")
    plt.grid(True, linestyle=":", alpha=0.5, axis="x")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_dir / "per_config_error.png", dpi=150)
    plt.close()


def generate_model_card(
    output_dir: Path,
    configs_df: pd.DataFrame,
    metrics: Dict[str, Dict[str, float]],
    winner_name: str,
    winner_metrics: Dict[str, float],
    a: float,
    b: float,
    reserve_gb: float,
    coeff_gpu: float,
    coeff_cpu: float,
    cpu_term_source: str = "prior",
    footprint_map_source: str = "default+margin",
    n_configs_gpu: int = 0,
    n_configs_cpu: int = 0,
):
    """Writes model_card.md."""
    n_configs = len(configs_df)
    is_dev = n_configs < MIN_CONFIGS_WARN

    warning_block = ""
    if is_dev:
        warning_block = (
            "> [!WARNING]\n"
            "> **DEV DATA - retrain on clean benchmark**\n"
            f"> The training dataset contains only **{n_configs}** configurations (< {MIN_CONFIGS_WARN} recommended minimum).\n"
            "> Model metrics and predictions are illustrative only. Collect benchmark data on diverse hardware\n"
            "> before relying on these predictions for production hardware recommendations.\n\n"
        )

    models_list = ", ".join(sorted(configs_df["model_tag"].unique()))
    gpus_list = ", ".join(sorted(configs_df["gpu_name"].unique()))

    card_content = f"""# LLM Bench Performance Predictor — Model Card

{warning_block}## 1. Overview
This ML model predicts local LLM inference performance (tokens per second) on consumer GPUs.
It replaces heuristic lookup tables with a first-principles physics-guided regression model trained
on actual Ollama inference benchmarks collected with `benchmark/run_benchmark.py`.

## 2. Dataset Summary
- **Total Configurations**: {n_configs}
- **Evaluated Models**: {models_list}
- **Benchmarked Hardware**: {gpus_list}
- **Target Metric**: Generation speed (tokens/second) converted from millisecond-per-token inference latency.
- **Evaluation Grouping**: Leave-One-Group-Out (LOGO) cross-validation grouped by unique hardware-model configuration.

## 3. Leave-One-Group-Out (LOGO) Cross-Validation Results

| Model | LOGO MAE (tokens/s) | LOGO MAPE (%) | $R^2$ |
| :--- | :---: | :---: | :---: |
| MeanBaseline | {metrics['MeanBaseline']['mae_tps']} | {metrics['MeanBaseline']['mape_pct']}% | {metrics['MeanBaseline']['r2']} |
| TheoryBaseline | {metrics['TheoryBaseline']['mae_tps']} | {metrics['TheoryBaseline']['mape_pct']}% | {metrics['TheoryBaseline']['r2']} |
| PhysicsLinear | {metrics['PhysicsLinear']['mae_tps']} | {metrics['PhysicsLinear']['mape_pct']}% | {metrics['PhysicsLinear']['r2']} |
| RandomForest | {metrics['RandomForest']['mae_tps']} | {metrics['RandomForest']['mape_pct']}% | {metrics['RandomForest']['r2']} |

**Selected Model**: `{winner_name}` (Lowest LOGO MAPE: {winner_metrics['mape_pct']}%)

## 4. Fitted Parameters & Physical Interpretation
- **Loaded Footprint Mapping**: `model_size_gb = {a:.3f} * file_size_gb + {b:.3f}` (source: `{footprint_map_source}`; safety margin: {'15% stopgap applied' if footprint_map_source == 'default+margin' else 'none (fitted)'})
- **Fitted VRAM OS/Display Reserve ($R$)**: `{reserve_gb:.2f} GB`
- **Physics Linear Coefficients**:
  - `coeff_gpu`: `{coeff_gpu:.1f}` (supported by {n_configs_gpu} configs. Implies ~{1000.0/coeff_gpu*100.0 if coeff_gpu > 0 else 0.0:.1f}% effective memory bandwidth utilization due to compute kernel overhead; efficiency cannot exceed 100%).
  - `coeff_cpu`: `{coeff_cpu:.1f}` (source: `{cpu_term_source}`; supported by {n_configs_cpu} configs with offload < 0.95).
- **CPU Term Source**: `{cpu_term_source}`. Because the dataset currently has {n_configs_cpu} configuration(s) with offload < 0.95 (less than the minimum threshold of 3 configs required for empirical fitting), the CPU term is anchored to a stated prior of 60% of theoretical dual-channel RAM bandwidth (`coeff_cpu = 1000 / 0.6 = 1666.7`) to prevent ungrounded extrapolation.

## 5. Artifacts
- `model.joblib`: Trained model pipeline and parameters.
- `metrics.json`: LOGO cross-validation scores and training metadata.
- `pred_vs_actual.png`: Out-of-fold predicted speed vs actual speed.
- `per_config_error.png`: Percentage error across benchmarked configurations.

## 6. How to Retrain
To retrain with new benchmark runs:
```bash
cd backend
python -m ml.train
```
"""
    with open(output_dir / "model_card.md", "w", encoding="utf-8") as f:
        f.write(card_content)


def train():
    print("=" * 60)
    print("LLM Bench ML Training — Inference Performance Predictor")
    print("=" * 60)

    # 1. Load clean configs
    configs_df = load_configs()
    n_configs = len(configs_df)
    print(f"[INFO] Loaded {n_configs} valid configuration(s).")

    # 2. Fit footprint map & GPU reserve
    a, b, footprint_map_source = fit_footprint_map(configs_df)
    reserve_gb = fit_reserve_gb(configs_df)
    print(f"[INFO] Footprint mapping: model_size_gb = {a:.3f} * file_size_gb + {b:.3f} (source: {footprint_map_source})")
    print(f"[INFO] Fitted VRAM reserve R = {reserve_gb:.2f} GB")

    # 3. LOGO CV Model Comparison
    metrics, oof_tps, y_true_tps, groups = evaluate_logo_cv(configs_df, reserve_gb)

    print("\n" + "=" * 60)
    print(f"{'Model':<18} {'LOGO MAE (t/s)':<18} {'LOGO MAPE (%)':<18} {'R2':<10}")
    print("-" * 60)
    for model_name in ["MeanBaseline", "TheoryBaseline", "PhysicsLinear", "RandomForest"]:
        m = metrics[model_name]
        print(f"{model_name:<18} {m['mae_tps']:<18.2f} {m['mape_pct']:<18.2f} {m['r2']:<10.4f}")
    print("=" * 60 + "\n")

    # Select winner by lowest MAPE
    winner_name = min(metrics.keys(), key=lambda k: metrics[k]["mape_pct"])
    winner_metrics = metrics[winner_name]
    print(f"[INFO] Best Model: {winner_name} (MAPE: {winner_metrics['mape_pct']}%, MAE: {winner_metrics['mae_tps']} t/s)")

    # 4. Train winning model on ALL data
    y_true_ms = configs_df["ms_per_token"].values
    footprint = configs_df["model_size_gb"].values
    vram = configs_df["vram_total_gb"].values
    bw = configs_df["gpu_mem_bandwidth_gbps"].values

    x_gpu, x_cpu, f_offload = physics_features(footprint, vram, bw, reserve_gb)
    X_phys = np.column_stack([x_gpu, x_cpu])

    rf_cols = ["model_size_gb", "vram_total_gb", "gpu_mem_bandwidth_gbps", "ram_total_gb", "params_b"]
    X_rf = configs_df[rf_cols].fillna(0.0).values

    trained_model = None
    coeff_gpu, coeff_cpu = 0.0, 0.0
    cpu_term_source = "prior"
    e0 = 0.0
    n_offload = int(np.sum(f_offload < 0.95))
    n_configs_gpu = int(len(configs_df))
    n_configs_cpu = int(n_offload)

    if winner_name == "PhysicsLinear":
        trained_model = PhysicsLinear()
        trained_model.fit(X_phys, y_true_ms, f_offload=f_offload)
        coeff_gpu = float(trained_model.coeff_gpu_)
        coeff_cpu = float(trained_model.coeff_cpu_)
        cpu_term_source = trained_model.cpu_term_source_
        e0 = float(trained_model.intercept_)
        print(f"[COEFFICIENTS] coeff_gpu = {coeff_gpu:.1f}, coeff_cpu = {coeff_cpu:.1f} (source: {cpu_term_source})")
        eff_pct = (1000.0 / coeff_gpu * 100.0) if coeff_gpu > 0 else 0.0
        print(
            f"[EXPLANATION] coeff_gpu ({coeff_gpu:.1f}) indicates GPU memory-bound generation time.\n"
            f"              Theoretical memory transfer is multiplied by ~{coeff_gpu/1000.0:.2f}x\n"
            f"              (implying {eff_pct:.1f}% bandwidth efficiency; efficiency cannot exceed 100%).\n"
            f"              coeff_cpu ({coeff_cpu:.1f}) source: {cpu_term_source} (supported by {n_configs_cpu} configs with offload < 0.95)."
        )
        pred_ms_all = trained_model.predict(X_phys)
    elif winner_name == "TheoryBaseline":
        trained_model = TheoryBaseline().fit(X_phys, y_true_ms)
        pred_ms_all = trained_model.predict(X_phys)
    elif winner_name == "RandomForest":
        min_leaf = max(1, min(2, len(configs_df) // 2))
        trained_model = RandomForestRegressor(n_estimators=50, max_depth=3, min_samples_leaf=min_leaf, random_state=42)
        trained_model.fit(X_rf, y_true_ms)
        pred_ms_all = trained_model.predict(X_rf)
    else:  # MeanBaseline
        trained_model = MeanBaseline().fit(X_phys, y_true_ms)
        pred_ms_all = trained_model.predict(X_phys)

    # Compute residual std in ms
    residuals_ms = y_true_ms - pred_ms_all
    residual_std_ms = float(np.std(residuals_ms, ddof=1)) if len(residuals_ms) > 1 else float(np.std(residuals_ms))

    # Compute training ranges
    training_ranges = {
        "min_offload_fraction": round(float(np.min(f_offload)), 3),
        "max_offload_fraction": round(float(np.max(f_offload)), 3),
        "max_x_cpu": round(float(np.max(x_cpu)), 4),
        "min_footprint": round(float(np.min(footprint)), 3),
        "max_footprint": round(float(np.max(footprint)), 3),
    }

    # Ensure output dir exists
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    # Save model.joblib
    model_payload = {
        "model": trained_model,
        "model_type": winner_name,
        "footprint_a": a,
        "footprint_b": b,
        "footprint_map_source": footprint_map_source,
        "reserve_gb": reserve_gb,
        "residual_std_ms": residual_std_ms,
        "metrics": winner_metrics,
        "all_metrics": metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_configs": int(n_configs),
        "n_configs_gpu": n_configs_gpu,
        "n_configs_cpu": n_configs_cpu,
        "n_offload": n_offload,
        "cpu_term_source": cpu_term_source,
        "groups": list(np.unique(groups).astype(str)),
        "coeff_gpu": coeff_gpu,
        "coeff_cpu": coeff_cpu,
        "intercept": e0,
        "training_ranges": training_ranges,
    }
    joblib.dump(model_payload, ARTIFACT_DIR / "model.joblib")
    print(f"[INFO] Saved model artifact to {ARTIFACT_DIR / 'model.joblib'}")

    # Save metrics.json
    metrics_payload = {
        "selected_model": winner_name,
        "n_configs": int(n_configs),
        "n_configs_gpu": n_configs_gpu,
        "n_configs_cpu": n_configs_cpu,
        "n_offload": n_offload,
        "cpu_term_source": cpu_term_source,
        "footprint_map_source": footprint_map_source,
        "models_compared": metrics,
        "winner_metrics": winner_metrics,
        "reserve_gb": reserve_gb,
        "footprint_params": {"a": a, "b": b, "source": footprint_map_source},
        "residual_std_ms": round(residual_std_ms, 2),
        "coeff_gpu": round(coeff_gpu, 1),
        "coeff_cpu": round(coeff_cpu, 1),
        "intercept": round(e0, 2),
        "training_ranges": training_ranges,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(ARTIFACT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"[INFO] Saved metrics to {ARTIFACT_DIR / 'metrics.json'}")

    # Generate plots
    generate_plots(configs_df, winner_name, oof_tps[winner_name], y_true_tps, ARTIFACT_DIR)
    print(f"[INFO] Saved diagnostic plots to {ARTIFACT_DIR}")

    # Generate model_card.md
    generate_model_card(
        ARTIFACT_DIR,
        configs_df,
        metrics,
        winner_name,
        winner_metrics,
        a,
        b,
        reserve_gb,
        coeff_gpu,
        coeff_cpu,
        cpu_term_source,
        footprint_map_source,
        n_configs_gpu,
        n_configs_cpu,
    )
    print(f"[INFO] Generated {ARTIFACT_DIR / 'model_card.md'}")

    # CI Quality Gate Check
    if winner_metrics["mape_pct"] > MAX_MAPE_PCT:
        if n_configs < MIN_CONFIGS_WARN:
            print(
                f"[WARN] Winner LOGO MAPE ({winner_metrics['mape_pct']}%) exceeds gate ({MAX_MAPE_PCT}%). "
                f"Accepted because dataset size ({n_configs} configs) < {MIN_CONFIGS_WARN}."
            )
        else:
            raise ValueError(
                f"CI quality gate failed: Winner LOGO MAPE ({winner_metrics['mape_pct']}%) "
                f"exceeds maximum allowed threshold ({MAX_MAPE_PCT}%)."
            )

    print("[SUCCESS] Training and evaluation complete!")


if __name__ == "__main__":
    train()
