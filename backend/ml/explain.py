import argparse
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so database/models can be imported
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import joblib
from ml.config import ARTIFACT_DIR, DEFAULT_RAM_BW_GBPS
from ml.features import estimate_footprint, estimate_offload, physics_features
from ml.gpu_specs import match_gpu


def get_gpu_vram(gpu_name: str) -> float:
    """Looks up VRAM in gpu_database.json or returns default."""
    gpu_db_path = backend_dir / "data" / "gpu_database.json"
    if gpu_db_path.exists():
        try:
            with open(gpu_db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            gpus = data.get("gpus", {})
            for name, vram in gpus.items():
                if name.lower() in gpu_name.lower() or gpu_name.lower() in name.lower():
                    return float(vram)
        except Exception:
            pass
    # Fallback heuristics
    if "2050" in gpu_name or "3050 laptop" in gpu_name.lower():
        return 4.0
    if "3060" in gpu_name:
        return 12.0
    if "4090" in gpu_name:
        return 24.0
    return 8.0


def resolve_model_specs(model_arg: str, quant_arg: str):
    """Tries to resolve model specs from DB or heuristic fallback."""
    try:
        from database import SessionLocal
        from models import Model, ModelQuant

        db = SessionLocal()
        # Search by name or tag
        query = db.query(Model).filter(
            (Model.name.ilike(f"%{model_arg}%")) | (Model.ollama_tag.ilike(f"%{model_arg}%"))
        ).first()

        if query:
            # Look for matching quant
            quant_obj = db.query(ModelQuant).filter(
                ModelQuant.model_id == query.id,
                ModelQuant.quant.ilike(f"%{quant_arg}%")
            ).first()

            if not quant_obj:
                quant_obj = db.query(ModelQuant).filter(ModelQuant.model_id == query.id).first()

            if quant_obj:
                return query.name, quant_obj.quant, float(query.params_b), float(quant_obj.size_gb)
    except Exception:
        pass

    # Fallback common models
    name_lower = model_arg.lower()
    if "phi4" in name_lower or "phi-4" in name_lower:
        return "Phi 4", quant_arg, 14.0, 9.1
    elif "llama3.2:1b" in name_lower or ("llama" in name_lower and "1b" in name_lower):
        return "Llama 3.2 1B", quant_arg, 1.2, 1.3
    elif "llama3.2:3b" in name_lower or ("llama" in name_lower and "3b" in name_lower):
        return "Llama 3.2 3B", quant_arg, 3.2, 2.0
    elif "qwen2.5:7b" in name_lower or ("qwen" in name_lower and "7b" in name_lower):
        return "Qwen 2.5 7B", quant_arg, 7.6, 4.7
    elif "mistral" in name_lower:
        return "Mistral 7B", quant_arg, 7.2, 4.4
    elif "deepseek" in name_lower:
        return "DeepSeek R1 1.5B", quant_arg, 1.8, 1.1

    return model_arg, quant_arg, 7.0, 4.5


def explain_prediction(model_arg: str, quant_arg: str, gpu_arg: str, vram_arg: float = None, bandwidth_arg: float = None):
    model_path = ARTIFACT_DIR / "model.joblib"
    if not model_path.exists():
        print(f"[ERROR] Trained model artifact not found at {model_path}.")
        print("Run `python -m ml.train` first.")
        sys.exit(1)

    payload = joblib.load(model_path)
    model = payload.get("model")
    model_type = payload.get("model_type", "PhysicsLinear")
    a = float(payload.get("footprint_a", 1.1))
    b = float(payload.get("footprint_b", 0.1))
    reserve_gb = float(payload.get("reserve_gb", 0.5))
    coeff_gpu = float(payload.get("coeff_gpu", 0.0))
    coeff_cpu = float(payload.get("coeff_cpu", 0.0))
    intercept = float(payload.get("intercept", getattr(model, "intercept_", 0.0)))
    cpu_term_source = payload.get("cpu_term_source", "prior")
    n_configs = int(payload.get("n_configs", 0))
    n_configs_gpu = int(payload.get("n_configs_gpu", n_configs))
    n_configs_cpu = int(payload.get("n_configs_cpu", payload.get("n_offload", 0)))
    footprint_map_source = payload.get("footprint_map_source", "default+margin")
    training_ranges = payload.get("training_ranges", {})

    model_name, quant_name, params_b, file_size_gb = resolve_model_specs(model_arg, quant_arg)

    # Resolve GPU
    matched_key, matched_bw = match_gpu(gpu_arg)
    bandwidth_gbps = bandwidth_arg if bandwidth_arg else (matched_bw if matched_bw else 112.0)
    gpu_display_name = matched_key if matched_key else gpu_arg
    vram_gb = vram_arg if vram_arg else get_gpu_vram(gpu_display_name)

    # 1. Footprint
    footprint_gb = estimate_footprint(file_size_gb, a=a, b=b, source=footprint_map_source)

    # 2. Offload
    f = estimate_offload(vram_gb, footprint_gb, reserve_gb=reserve_gb)
    vram_used = f * footprint_gb
    ram_used = (1.0 - f) * footprint_gb

    # 3. Physics features
    x_gpu, x_cpu, _ = physics_features(
        footprint_gb=footprint_gb,
        vram_gb=vram_gb,
        bandwidth_gbps=bandwidth_gbps,
        reserve_gb=reserve_gb,
        cpu_bandwidth_gbps=DEFAULT_RAM_BW_GBPS,
    )
    x_gpu = float(x_gpu)
    x_cpu = float(x_cpu)

    # 4. Coefficients and terms
    term_gpu_ms = coeff_gpu * x_gpu
    term_cpu_ms = coeff_cpu * x_cpu
    total_ms = max(1.0, term_gpu_ms + term_cpu_ms + intercept)
    tok_per_sec = 1000.0 / total_ms

    # 5. Check in_range
    in_range = True
    reasons = []
    if training_ranges:
        min_train_offload = float(training_ranges.get("min_offload_fraction", 0.0))
        max_train_x_cpu = float(training_ranges.get("max_x_cpu", 10.0))
        max_train_footprint = float(training_ranges.get("max_footprint", 100.0))

        if f < (min_train_offload - 0.05):
            in_range = False
            reasons.append(f"offload {f:.2f} < min trained {min_train_offload:.2f}")
        if x_cpu > (max_train_x_cpu + 0.05):
            in_range = False
            reasons.append(f"x_cpu {x_cpu:.4f}s > max trained {max_train_x_cpu:.4f}s")
        if footprint_gb > (max_train_footprint * 1.5):
            in_range = False
            reasons.append(f"footprint {footprint_gb:.1f}GB > max trained {max_train_footprint:.1f}GB")

    print("\n" + "=" * 64)
    print(f" LLM Bench ML Inference Prediction Breakdown ({model_type})")
    print("=" * 64)
    print(f"Model:           {model_name} ({quant_name}) [{params_b:.1f}B params]")
    print(f"Target GPU:      {gpu_display_name} ({vram_gb:.1f} GB VRAM, {bandwidth_gbps:.0f} GB/s bandwidth)")
    print("-" * 64)
    print(f"Weights Size:    {file_size_gb:.2f} GB (download file size)")
    print(f"Loaded Footprint:{footprint_gb:.2f} GB (weights + KV cache overhead: {a:.2f}x + {b:.2f}; source: {footprint_map_source})")
    print(f"OS/VRAM Reserve: {reserve_gb:.2f} GB (display & desktop compositor overhead)")
    print(f"GPU Offload (f): {f * 100:.1f}% ({vram_used:.2f} GB in VRAM, {ram_used:.2f} GB in System RAM)")
    print("-" * 64)
    print(f"Feature x_gpu:   {x_gpu:.6f} seconds (memory transfer time on GPU)")
    print(f"Feature x_cpu:   {x_cpu:.6f} seconds (memory transfer time on CPU/RAM)")
    print(f"Term GPU (c1*x): {term_gpu_ms:.2f} ms (coefficient c1 = {coeff_gpu:.1f}, supported by {n_configs_gpu} configs)")
    print(f"Term CPU (c2*x): {term_cpu_ms:.2f} ms (coefficient c2 = {coeff_cpu:.1f}, source: {cpu_term_source}, supported by {n_configs_cpu} configs with offload < 0.95)")
    print(f"Model Intercept: {intercept:.2f} ms")
    print("-" * 64)
    print(f"Total Latency:   {total_ms:.2f} ms per generated token")
    print(f"Predicted Speed: {tok_per_sec:.1f} tokens / second")
    print(f"Training Range:  {'IN RANGE' if in_range else 'OUT OF RANGE (' + ', '.join(reasons) + ')'}")
    print("=" * 64 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Explain LLM Bench ML inference speed prediction terms.")
    parser.add_argument("--model", type=str, required=True, help="Model name or tag (e.g. phi4, llama3.2:3b)")
    parser.add_argument("--quant", type=str, default="Q4_K_M", help="Quantization tag (e.g. Q4_K_M)")
    parser.add_argument("--gpu", type=str, required=True, help="GPU name (e.g. 'RTX 2050', 'RTX 4090')")
    parser.add_argument("--vram", type=float, default=None, help="VRAM in GB (optional override)")
    parser.add_argument("--bandwidth", type=float, default=None, help="Memory bandwidth in GB/s (optional override)")

    args = parser.parse_args()
    explain_prediction(
        model_arg=args.model,
        quant_arg=args.quant,
        gpu_arg=args.gpu,
        vram_arg=args.vram,
        bandwidth_arg=args.bandwidth
    )


if __name__ == "__main__":
    main()
