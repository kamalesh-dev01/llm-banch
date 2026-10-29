from typing import Tuple, Union
import numpy as np
import pandas as pd

from ml.config import DEFAULT_RAM_BW_GBPS, FOOTPRINT_SAFETY


def fit_footprint_map(df: pd.DataFrame) -> Tuple[float, float, str]:
    """
    Fits linear relationship: model_size_gb = a * file_size_gb + b
    Returns (a, b, source).
    If >= 6 configs have clean file_size_gb (>0) and >= 2 unique values,
    fits (a, b) and source is "fitted".
    Otherwise returns default (1.1, 0.1) and source is "default+margin".
    """
    if "file_size_gb" not in df.columns or "model_size_gb" not in df.columns:
        return 1.1, 0.1, "default+margin"

    valid = df.dropna(subset=["file_size_gb", "model_size_gb"]).copy()
    valid = valid[(valid["file_size_gb"] > 0) & (valid["model_size_gb"] > 0)]

    if len(valid) < 6 or valid["file_size_gb"].nunique() < 2:
        return 1.1, 0.1, "default+margin"

    x = valid["file_size_gb"].values
    y = valid["model_size_gb"].values

    # OLS: y = a * x + b
    A = np.vstack([x, np.ones_like(x)]).T
    try:
        a, b = np.linalg.lstsq(A, y, rcond=None)[0]
        # Sanity check: a should be positive
        if a <= 0:
            return 1.1, 0.1, "default+margin"
        return float(a), float(b), "fitted"
    except Exception:
        return 1.1, 0.1, "default+margin"


def estimate_footprint(
    file_size_gb: float, 
    a: float = 1.1, 
    b: float = 0.1, 
    source: str = "default+margin"
) -> float:
    """
    Estimates loaded memory footprint from file_size_gb using fitted (a, b).
    Multiplies by FOOTPRINT_SAFETY (1.15) ONLY when the map is the unfitted default
    (source == "default+margin"); once fitted from >= 6 configs that have file_size_gb
    (source == "fitted"), no margin is applied.
    """
    raw_footprint = float(max(0.1, a * float(file_size_gb) + b))
    if source == "default+margin":
        return float(max(0.1, raw_footprint * FOOTPRINT_SAFETY))
    return raw_footprint


def fit_reserve_gb(df: pd.DataFrame) -> float:
    """
    Grid search R in [0.0, 3.0] GB (step 0.05) to minimize MAE between:
    f_est = clip((vram_gb - R) / model_size_gb, 0.0, 1.0)
    and actual gpu_offload_fraction in the dataset.
    """
    required = ["vram_total_gb", "model_size_gb", "gpu_offload_fraction"]
    for col in required:
        if col not in df.columns:
            return 0.5

    valid = df.dropna(subset=required).copy()
    valid = valid[valid["model_size_gb"] > 0]
    if len(valid) == 0:
        return 0.5

    vram = valid["vram_total_gb"].values
    size = valid["model_size_gb"].values
    actual_offload = valid["gpu_offload_fraction"].values

    candidates = np.arange(0.0, 3.05, 0.05)
    best_r = 0.5
    best_mae = float("inf")

    for r in candidates:
        f_est = np.clip((vram - r) / size, 0.0, 1.0)
        mae = float(np.mean(np.abs(f_est - actual_offload)))
        if mae < best_mae:
            best_mae = mae
            best_r = float(r)

    return round(best_r, 2)


def estimate_offload(vram_gb: float, model_size_gb: float, reserve_gb: float = 0.5) -> float:
    """
    Estimates GPU offload fraction:
    f = clip((vram_gb - reserve_gb) / model_size_gb, 0.0, 1.0)
    """
    if model_size_gb <= 0:
        return 1.0 if vram_gb > 0 else 0.0
    return float(np.clip((float(vram_gb) - float(reserve_gb)) / float(model_size_gb), 0.0, 1.0))


def physics_features(
    footprint_gb: Union[float, np.ndarray],
    vram_gb: Union[float, np.ndarray],
    bandwidth_gbps: Union[float, np.ndarray],
    reserve_gb: float = 0.5,
    cpu_bandwidth_gbps: float = DEFAULT_RAM_BW_GBPS,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes theoretical physics memory transfer times per token (in seconds):
      f = clip((vram - reserve) / footprint, 0.0, 1.0)
      x_gpu = (f * footprint) / bandwidth_gbps
      x_cpu = footprint_gb * (1 - offload) / RAM_BW_GBPS (seconds)

    Returns (x_gpu, x_cpu, f) as numpy arrays.
    """
    footprint = np.asarray(footprint_gb, dtype=float)
    vram = np.asarray(vram_gb, dtype=float)
    bandwidth = np.asarray(bandwidth_gbps, dtype=float)

    # Avoid div by zero
    bandwidth_safe = np.where(bandwidth > 0, bandwidth, 1.0)
    cpu_bw_safe = max(float(cpu_bandwidth_gbps), 1.0)

    f = np.clip((vram - float(reserve_gb)) / np.maximum(footprint, 0.001), 0.0, 1.0)
    x_gpu = (f * footprint) / bandwidth_safe
    x_cpu = ((1.0 - f) * footprint) / cpu_bw_safe

    return x_gpu, x_cpu, f
