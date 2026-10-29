import json
import os
import tempfile
from pathlib import Path
import pytest
import pandas as pd
import numpy as np

from ml.gpu_specs import match_gpu
from ml.data_prep import load_configs
from ml.features import estimate_footprint, estimate_offload, physics_features
from ml.predict import predict_tps, clear_model_cache
from ml.config import ARTIFACT_DIR


def test_match_gpu():
    """Tests GPU normalization and bandwidth matching."""
    # 1. Substring with longest match
    key, bw = match_gpu("NVIDIA GeForce RTX 3050 Laptop GPU")
    assert key == "RTX 3050 Laptop"
    assert bw == 176.0

    # 2. Desktop variant
    key, bw = match_gpu("NVIDIA GeForce RTX 2050")
    assert key == "RTX 2050"
    assert bw == 112.0

    # 3. High-end desktop GPU
    key, bw = match_gpu("NVIDIA GeForce RTX 4090")
    assert key == "RTX 4090"
    assert bw == 1008.0

    # 4. Apple Silicon
    key, bw = match_gpu("Apple M1 Pro")
    assert key == "M1 Pro"
    assert bw == 200.0

    # 5. Unknown GPU
    key, bw = match_gpu("Intel Iris Xe Graphics 96EU")
    assert key is None
    assert bw is None

    # 6. None or empty string
    assert match_gpu(None) == (None, None)
    assert match_gpu("") == (None, None)


def test_load_configs_with_mock_csv(tmp_path):
    """Tests data_prep.load_configs filtering and aggregation."""
    csv_file = tmp_path / "test_machine.csv"
    mock_data = {
        "machine_label": ["test-box"] * 5,
        "timestamp": ["2026-10-26T10:00:00Z"] * 5,
        "gpu_name": ["RTX 2050"] * 5,
        "vram_total_gb": [4.0] * 5,
        "gpu_mem_bandwidth_gbps": [112.0] * 5,
        "ram_total_gb": [16.0] * 5,
        "cpu_name": ["Test CPU"] * 5,
        "model_tag": ["test-model:1b"] * 5,
        "params_b": [1.0] * 5,
        "quantization": ["Q4_K_M"] * 5,
        "model_size_gb": [1.5] * 5,
        "prompt_label": ["medium", "long", "short", "medium", "long"],
        "run_idx": [0, 0, 0, 1, 1],
        "prompt_tokens": [100] * 5,
        "output_tokens": [100, 100, 100, 30, 100],  # row 3 has < 50 tokens (should drop)
        "tokens_per_sec": [50.0, 52.0, 48.0, 40.0, 51.0],
        "prompt_tokens_per_sec": [150.0] * 5,
        "ttft_ms": [20.0] * 5,
        "load_ms": [100.0] * 5,
        "gpu_offload_fraction": [1.0] * 5,
        "peak_vram_used_gb": [2.0] * 5,
        "avg_gpu_util": [90.0] * 5,
        "error": ["", "", "", "", "Failed to run"],  # row 4 has error (should drop)
    }
    df = pd.DataFrame(mock_data)
    df.to_csv(csv_file, index=False)

    loaded = load_configs(results_dir=tmp_path)
    assert len(loaded) == 1  # 1 aggregated config
    row = loaded.iloc[0]
    assert row["machine_label"] == "test-box"
    assert row["model_tag"] == "test-model:1b"
    assert row["quantization"] == "Q4_K_M"
    # Rows included should be idx 0 (50.0) and idx 1 (52.0). Median is 51.0
    assert row["tokens_per_sec"] == pytest.approx(51.0, 0.1)
    assert row["ms_per_token"] == pytest.approx(1000.0 / 51.0, 0.1)
    assert "group" in loaded.columns


def test_predict_tps():
    """Tests ML inference prediction formatting and confidence bounds."""
    pred = predict_tps(
        file_size_gb=2.0,
        vram_gb=4.0,
        bandwidth_gbps=112.0,
        gpu_name="RTX 2050",
    )
    assert pred is not None
    assert "tps" in pred
    assert "tps_min" in pred
    assert "tps_max" in pred
    assert "offload_fraction" in pred
    assert "footprint_gb" in pred
    assert "confidence" in pred
    assert "model_type" in pred

    assert pred["tps"] > 0
    assert pred["tps_min"] <= pred["tps"] <= pred["tps_max"]
    assert 0.0 <= pred["offload_fraction"] <= 1.0
    assert pred["footprint_gb"] > 0


def test_missing_artifacts(monkeypatch, tmp_path):
    """Tests graceful None return when model artifact does not exist."""
    clear_model_cache()
    # Point ARTIFACT_DIR to empty temp directory
    monkeypatch.setattr("ml.predict.ARTIFACT_DIR", tmp_path)
    res = predict_tps(file_size_gb=2.0, vram_gb=4.0, bandwidth_gbps=112.0)
    assert res is None
    clear_model_cache()


def test_metrics_json():
    """Verifies metrics.json exists and conforms to schema."""
    metrics_path = ARTIFACT_DIR / "metrics.json"
    assert metrics_path.exists(), "metrics.json should exist in ml/artifacts"

    with open(metrics_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "selected_model" in data
    assert "winner_metrics" in data
    assert "models_compared" in data
    assert "reserve_gb" in data
    assert "n_configs" in data
    assert data["n_configs"] >= 1
    assert "mape_pct" in data["winner_metrics"]
    assert "mae_tps" in data["winner_metrics"]


def test_features():
    """Tests offload and physics feature calculations."""
    offload = estimate_offload(vram_gb=4.0, model_size_gb=2.0, reserve_gb=0.5)
    assert offload == 1.0  # (4 - 0.5) / 2 = 1.75 -> clipped to 1.0

    offload_part = estimate_offload(vram_gb=2.0, model_size_gb=4.0, reserve_gb=0.5)
    assert offload_part == pytest.approx(0.375, 0.01)

    x_gpu, x_cpu, f = physics_features(
        footprint_gb=2.0,
        vram_gb=4.0,
        bandwidth_gbps=112.0,
        reserve_gb=0.5,
    )
    assert f == 1.0
    assert x_gpu > 0
    assert x_cpu == 0.0  # 100% offloaded


def test_cpu_offload_bandwidth_bound():
    """For a config with 75% weights on CPU, predicted tok/s must be strictly

    below the pure-GPU-bandwidth bound for that footprint.
    """
    bandwidth_gbps = 112.0
    # Let footprint be 8.0 GB -> pure GPU bandwidth bound = 112 / 8.0 = 14.0 tok/s
    footprint_gb = 8.0
    pure_gpu_bound_tps = bandwidth_gbps / footprint_gb

    # Load metrics to get the trained reserve_gb and footprint parameters
    metrics_path = ARTIFACT_DIR / "metrics.json"
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    reserve_gb = float(metrics.get("reserve_gb", 0.5))
    footprint_source = metrics.get("footprint_map_source", "default+margin")
    from ml.config import FOOTPRINT_SAFETY
    margin = FOOTPRINT_SAFETY if footprint_source == "default+margin" else 1.0

    # Invert footprint = (file_size_gb * 1.1 + 0.1) * margin => file_size_gb = ((8.0 / margin) - 0.1) / 1.1
    file_size_gb = ((footprint_gb / margin) - 0.1) / 1.1

    # We want offload = 0.25 (i.e. 75% weights on CPU)
    # offload = (vram_gb - reserve_gb) / footprint_gb = 0.25
    vram_gb = reserve_gb + 0.25 * footprint_gb

    pred = predict_tps(
        file_size_gb=file_size_gb,
        vram_gb=vram_gb,
        bandwidth_gbps=bandwidth_gbps,
        gpu_name="RTX 2050",
    )

    assert pred is not None
    # Verify offload is ~0.25 (75% on CPU)
    assert pred["offload_fraction"] == pytest.approx(0.25, abs=0.02)
    # Predicted TPS must be strictly below pure-GPU-bandwidth bound
    assert pred["tps"] < pure_gpu_bound_tps

