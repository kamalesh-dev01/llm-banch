import logging
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import joblib

from ml.config import ARTIFACT_DIR, DEFAULT_RAM_BW_GBPS
from ml.features import estimate_footprint, physics_features
from ml.gpu_specs import match_gpu

logger = logging.getLogger(__name__)

_MODEL_CACHE: Optional[Dict[str, Any]] = None


def get_cached_model() -> Optional[Dict[str, Any]]:
    """Loads and caches the model payload from model.joblib. Returns None if file does not exist."""
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    model_path = ARTIFACT_DIR / "model.joblib"
    if not model_path.exists():
        return None

    try:
        _MODEL_CACHE = joblib.load(model_path)
        return _MODEL_CACHE
    except Exception as e:
        logger.warning(f"Failed to load ML model artifact from {model_path}: {e}")
        return None


def clear_model_cache():
    """Clears in-memory model cache to allow reloading newly trained models."""
    global _MODEL_CACHE
    _MODEL_CACHE = None


def predict_tps(
    file_size_gb: float,
    vram_gb: float,
    bandwidth_gbps: Optional[float] = None,
    gpu_name: Optional[str] = None,
    ram_total_gb: float = 16.0,
    params_b: float = 3.0,
) -> Optional[Dict[str, Any]]:
    """
    Predicts inference tokens/second using the trained ML model.

    Returns:
      dict with tps, tps_min, tps_max, offload_fraction, footprint_gb, confidence, model_type.
      Returns None gracefully if model is not available or inputs cannot be resolved.
    """
    try:
        model_payload = get_cached_model()
        if model_payload is None:
            return None

        # Resolve bandwidth if missing
        if (bandwidth_gbps is None or bandwidth_gbps <= 0) and gpu_name:
            matched_key, matched_bw = match_gpu(gpu_name)
            if matched_bw is not None:
                bandwidth_gbps = matched_bw

        if bandwidth_gbps is None or bandwidth_gbps <= 0:
            # Cannot predict without GPU bandwidth
            return None

        model = model_payload.get("model")
        if model is None:
            return None

        model_type = model_payload.get("model_type", "PhysicsLinear")
        a = float(model_payload.get("footprint_a", 1.1))
        b = float(model_payload.get("footprint_b", 0.1))
        footprint_map_source = str(model_payload.get("footprint_map_source", "default+margin"))
        reserve_gb = float(model_payload.get("reserve_gb", 0.5))
        residual_std_ms = float(model_payload.get("residual_std_ms", 5.0))
        n_configs = int(model_payload.get("n_configs", 0))

        # 1. Estimate loaded footprint
        footprint_gb = estimate_footprint(file_size_gb, a=a, b=b, source=footprint_map_source)

        # 2. Compute physics features
        x_gpu, x_cpu, f = physics_features(
            footprint_gb=footprint_gb,
            vram_gb=vram_gb,
            bandwidth_gbps=bandwidth_gbps,
            reserve_gb=reserve_gb,
            cpu_bandwidth_gbps=DEFAULT_RAM_BW_GBPS,
        )

        # 3. Model inference
        if model_type in ("PhysicsLinear", "TheoryBaseline", "MeanBaseline"):
            X_input = np.array([[x_gpu, x_cpu]])
            ms_pred = float(model.predict(X_input)[0])
        elif model_type == "RandomForest":
            X_input = np.array([[footprint_gb, vram_gb, bandwidth_gbps, ram_total_gb, params_b]])
            ms_pred = float(model.predict(X_input)[0])
        else:
            X_input = np.array([[x_gpu, x_cpu]])
            ms_pred = float(model.predict(X_input)[0])

        # Clamp ms_pred >= 1.0 (max 1000 tps)
        ms_pred = max(1.0, ms_pred)

        # 90% confidence bounds (1.64 * sigma)
        ci_delta = 1.64 * residual_std_ms
        ms_lower = max(1.0, ms_pred - ci_delta)
        ms_upper = ms_pred + ci_delta

        tps = round(float(1000.0 / ms_pred), 1)
        tps_min = round(float(1000.0 / ms_upper), 1)
        tps_max = round(float(1000.0 / ms_lower), 1)

        confidence = "high" if n_configs >= 15 else "low"

        # Check training ranges
        training_ranges = model_payload.get("training_ranges")
        in_range = True
        if training_ranges:
            min_train_offload = float(training_ranges.get("min_offload_fraction", 0.0))
            max_train_x_cpu = float(training_ranges.get("max_x_cpu", 10.0))
            max_train_footprint = float(training_ranges.get("max_footprint", 100.0))

            if float(f) < (min_train_offload - 0.05):
                in_range = False
            if float(x_cpu) > (max_train_x_cpu + 0.05):
                in_range = False
            if float(footprint_gb) > (max_train_footprint * 1.5):
                in_range = False

        return {
            "tps": tps,
            "tps_min": tps_min,
            "tps_max": tps_max,
            "offload_fraction": round(float(f), 2),
            "footprint_gb": round(float(footprint_gb), 2),
            "confidence": confidence,
            "model_type": model_type,
            "in_range": in_range,
        }
    except Exception as e:
        logger.warning(f"Error in predict_tps: {e}")
        return None
