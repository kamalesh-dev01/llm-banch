"""
Results calculation service for LLM Bench.
Computes model tiers, hardware compatibility, and inference tok/s predictions
using the ML physics model (features, offload, training range validation).
"""
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from models import HardwareSession, Model, ModelQuant
from ml.config import DEFAULT_RAM_BW_GBPS
from ml.features import estimate_footprint, estimate_offload
from ml.predict import get_cached_model, predict_tps

logger = logging.getLogger(__name__)

# ==============================================================================
# Tier Rules & Classification Constants
# ==============================================================================
# too_large: Model weight memory on CPU exceeds 80% of available system RAM
# gpu:       At least 95% of weights fit directly in GPU VRAM (fastest execution)
# offload:   At least 40% of weights fit in GPU VRAM; remainder runs in system RAM
# heavy:     Less than 40% in VRAM; model runs mostly on CPU and is very slow
TIER_TOO_LARGE = "too_large"
TIER_GPU = "gpu"
TIER_OFFLOAD = "offload"
TIER_HEAVY = "heavy"

# Priority ranking for quantization quality preference (higher score = better quality)
QUANT_PRIORITY = {
    "Q8_0": 90,
    "Q6_K": 75,
    "Q5_K_M": 65,
    "Q5_K_S": 60,
    "Q5_0": 55,
    "Q4_K_M": 50,
    "Q4_K_S": 45,
    "Q4_0": 40,
    "Q3_K_L": 35,
    "Q3_K_M": 30,
    "Q3_K_S": 25,
    "Q2_K": 15,
}


def classify_tier(footprint_gb: float, offload_fraction: float, ram_gb: Optional[float]) -> str:
    """
    Evaluates hardware tier based on memory footprint, GPU offload fraction, and RAM:
      too_large: footprint_gb * (1 - offload) > 0.80 * ram_gb
      gpu:       offload >= 0.95
      offload:   offload >= 0.40
      heavy:     otherwise (mostly on CPU, very slow)
    """
    ram = float(ram_gb) if (ram_gb is not None and ram_gb > 0) else 16.0
    cpu_weight_gb = footprint_gb * (1.0 - offload_fraction)

    if cpu_weight_gb > (0.80 * ram):
        return TIER_TOO_LARGE
    if offload_fraction >= 0.95:
        return TIER_GPU
    if offload_fraction >= 0.40:
        return TIER_OFFLOAD
    return TIER_HEAVY


def build_tier_reason(tier: str, footprint_gb: float, offload: float, vram_gb: float, ram_gb: float) -> str:
    """Returns human-readable explanation of why a model landed in a specific tier."""
    if tier == TIER_GPU:
        return f"Fits fully in {vram_gb:.1f} GB VRAM for maximum GPU generation speed."
    elif tier == TIER_OFFLOAD:
        pct = int(round(offload * 100))
        return f"{pct}% offloaded to GPU; remaining weights run in system RAM."
    elif tier == TIER_HEAVY:
        pct = int(round(offload * 100))
        return f"Only {pct}% fits in VRAM; generation will run mostly on CPU."
    else:
        req_ram = footprint_gb * (1.0 - offload)
        return f"Requires {req_ram:.1f} GB system RAM, exceeding 80% of your {ram_gb:.1f} GB RAM."


def parse_model_tasks(raw_tasks: Any) -> List[str]:
    """Safely parses JSON or comma-separated tasks into a list of strings."""
    if not raw_tasks:
        return []
    if isinstance(raw_tasks, list):
        return [str(t).strip() for t in raw_tasks if t]
    if isinstance(raw_tasks, str):
        raw_tasks = raw_tasks.strip()
        if raw_tasks.startswith("["):
            try:
                parsed = json.loads(raw_tasks)
                if isinstance(parsed, list):
                    return [str(t).strip() for t in parsed if t]
            except Exception:
                pass
        return [t.strip() for t in raw_tasks.split(",") if t.strip()]
    return []


def compute_quant_result(
    quant: ModelQuant,
    model: Model,
    vram_gb: float,
    ram_gb: float,
    gpu_name: str,
    a: float,
    b: float,
    reserve_gb: float,
    footprint_source: str = "default+margin"
) -> Dict[str, Any]:
    """Computes tier, footprint, offload, and tok/s for a single quantization."""
    file_size_gb = float(quant.size_gb or 0.0)
    footprint_gb = estimate_footprint(file_size_gb, a=a, b=b, source=footprint_source)
    offload = estimate_offload(vram_gb=vram_gb, model_size_gb=footprint_gb, reserve_gb=reserve_gb)
    tier = classify_tier(footprint_gb, offload, ram_gb)

    # ML tok/s prediction
    pred = predict_tps(
        file_size_gb=file_size_gb,
        vram_gb=vram_gb,
        gpu_name=gpu_name,
        ram_total_gb=ram_gb,
        params_b=float(model.params_b or 3.0),
    )

    in_range = False
    tps = None
    tps_range = None
    speed_basis = "extrapolated"

    if pred:
        in_range = bool(pred.get("in_range", False))
        if in_range:
            tps = float(pred["tps"])
            tps_range = [float(pred["tps_min"]), float(pred["tps_max"])]
            speed_basis = "measured_range"
        else:
            speed_basis = "extrapolated"

    reason = build_tier_reason(tier, footprint_gb, offload, vram_gb, ram_gb)

    # Clean ollama run command
    tag = model.ollama_tag or model.name.lower().replace(" ", "")
    ollama_command = f"ollama run {tag}"

    return {
        "quant": quant.quant,
        "file_size_gb": round(file_size_gb, 2),
        "footprint_gb": round(footprint_gb, 2),
        "offload_fraction": round(offload, 2),
        "tier": tier,
        "tps": tps,
        "tps_range": tps_range,
        "in_range": in_range,
        "speed_basis": speed_basis,
        "reason": reason,
        "ollama_command": ollama_command,
    }


TIER_RANK = {TIER_GPU: 0, TIER_OFFLOAD: 1, TIER_HEAVY: 2, TIER_TOO_LARGE: 3}


def select_best_quant(quant_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Selects the best quantization for a model according to the best-quant rule:
    1. Never pick a quant in a worse tier than another quant of the same model.
    2. Candidates = quants with offload >= 0.90 within the best achievable tier.
    3. If any candidates, pick the largest file among them.
    4. Otherwise, pick the quant with the HIGHEST offload (smallest file).
    """
    if not quant_results:
        return {}

    best_tier_rank = min(TIER_RANK.get(q["tier"], 99) for q in quant_results)
    eligible = [q for q in quant_results if TIER_RANK.get(q["tier"], 99) == best_tier_rank]

    candidates = [q for q in eligible if q.get("offload_fraction", 0.0) >= 0.90]
    if candidates:
        return max(candidates, key=lambda q: (q.get("file_size_gb", 0.0), QUANT_PRIORITY.get(q.get("quant", ""), 30)))

    return max(eligible, key=lambda q: (q.get("offload_fraction", 0.0), -q.get("file_size_gb", 0.0), QUANT_PRIORITY.get(q.get("quant", ""), 30)))


def get_all_results_for_session(hw_session: HardwareSession, db: Session) -> Dict[str, Any]:
    """
    Computes results for all models in the database for the given hardware session.
    Returns:
      {
        token,
        hardware,
        tier_counts,
        models
      }
    """
    vram_gb = float(hw_session.vram_gb or 0.0)
    ram_gb = float(hw_session.ram_gb or 16.0)
    gpu_name = hw_session.gpu_name or "Unknown GPU"

    model_payload = get_cached_model()
    a = float(model_payload.get("footprint_a", 1.1)) if model_payload else 1.1
    b = float(model_payload.get("footprint_b", 0.1)) if model_payload else 0.1
    reserve_gb = float(model_payload.get("reserve_gb", 0.5)) if model_payload else 0.5
    footprint_source = str(model_payload.get("footprint_map_source", "default+margin")) if model_payload else "default+margin"

    all_models = db.query(Model).all()
    results = []

    for model in all_models:
        quants = db.query(ModelQuant).filter(ModelQuant.model_id == model.id).all()
        if not quants:
            continue

        quant_evals = [
            compute_quant_result(q, model, vram_gb, ram_gb, gpu_name, a, b, reserve_gb, footprint_source)
            for q in quants
        ]

        best = select_best_quant(quant_evals)
        if not best:
            continue

        tasks = parse_model_tasks(model.tasks)

        results.append({
            "model_id": model.id,
            "name": model.name,
            "family": model.family,
            "params_b": model.params_b,
            "description": model.description or f"{model.name} {model.params_b}B parameters model",
            "tasks": tasks,
            "quality_score": round(float(model.quality_score or 0.5), 2),
            "downloads_last_month": int(model.downloads_last_month or 0),
            "best_quant": best["quant"],
            "file_size_gb": best["file_size_gb"],
            "footprint_gb": best["footprint_gb"],
            "offload_fraction": best["offload_fraction"],
            "tier": best["tier"],
            "tps": best["tps"],
            "tps_range": best["tps_range"],
            "in_range": best["in_range"],
            "speed_basis": best["speed_basis"],
            "reason": best["reason"],
            "ollama_command": best["ollama_command"],
        })

    # Sort: GPU first, then quality_score descending
    tier_rank = {TIER_GPU: 0, TIER_OFFLOAD: 1, TIER_HEAVY: 2, TIER_TOO_LARGE: 3}
    results.sort(key=lambda m: (tier_rank.get(m["tier"], 4), -float(m["quality_score"] or 0.0)))

    # Per-tier counts
    tier_counts = {
        "gpu": sum(1 for m in results if m["tier"] == TIER_GPU),
        "offload": sum(1 for m in results if m["tier"] == TIER_OFFLOAD),
        "heavy": sum(1 for m in results if m["tier"] == TIER_HEAVY),
        "too_large": sum(1 for m in results if m["tier"] == TIER_TOO_LARGE),
        "total": len(results),
    }

    hardware_echo = {
        "gpu_name": hw_session.gpu_name or "Unknown GPU",
        "vram_gb": round(vram_gb, 1),
        "vram_source": hw_session.vram_source or "scanner",
        "ram_gb": round(ram_gb, 1),
        "cpu_name": hw_session.cpu_name or "Unknown CPU",
        "cpu_cores": hw_session.cpu_cores or 1,
        "os": hw_session.os or "Unknown OS",
        "disk_total_gb": round(float(hw_session.disk_total_gb or 0.0), 1),
        "disk_free_gb": round(float(hw_session.disk_free_gb or 0.0), 1),
    }

    return {
        "token": hw_session.token,
        "hardware": hardware_echo,
        "tier_counts": tier_counts,
        "models": results,
    }


def get_model_result_details(hw_session: HardwareSession, model: Model, db: Session) -> Dict[str, Any]:
    """
    Computes per-quant evaluations and system-requirements comparison rows for a single model.
    """
    vram_gb = float(hw_session.vram_gb or 0.0)
    ram_gb = float(hw_session.ram_gb or 16.0)
    gpu_name = hw_session.gpu_name or "Unknown GPU"
    cpu_name = hw_session.cpu_name or "Unknown CPU"
    cpu_cores = int(hw_session.cpu_cores or 1)
    os_name = hw_session.os or "Windows 11"
    disk_free_gb = float(hw_session.disk_free_gb or 0.0)

    model_payload = get_cached_model()
    a = float(model_payload.get("footprint_a", 1.1)) if model_payload else 1.1
    b = float(model_payload.get("footprint_b", 0.1)) if model_payload else 0.1
    reserve_gb = float(model_payload.get("reserve_gb", 0.5)) if model_payload else 0.5
    footprint_source = str(model_payload.get("footprint_map_source", "default+margin")) if model_payload else "default+margin"

    quants = db.query(ModelQuant).filter(ModelQuant.model_id == model.id).all()
    quant_evals = [
        compute_quant_result(q, model, vram_gb, ram_gb, gpu_name, a, b, reserve_gb, footprint_source)
        for q in quants
    ]

    best = select_best_quant(quant_evals) or (quant_evals[0] if quant_evals else {})
    file_size_gb = best.get("file_size_gb", 4.0)
    footprint_gb = best.get("footprint_gb", 4.5)
    offload = best.get("offload_fraction", 0.0)

    # Recommended = fully on GPU:
    # VRAM >= footprint + reserve; RAM >= 8 GB; disk >= file size
    vram_rec_val = round(footprint_gb + reserve_gb, 1)
    # Minimum = runs with CPU help:
    # >= 40% of weights on GPU; RAM >= footprint*(1-0.40) + 2 GB; disk >= file size
    vram_min_val = round(max(0.5, footprint_gb * 0.40 + reserve_gb), 1)
    ram_min_val = round(max(8.0, footprint_gb * 0.60 + 2.0), 1)

    # 1. VRAM Row
    vram_status = "fail"
    if vram_gb >= vram_rec_val:
        vram_status = "ok"
    elif offload >= 0.40:
        vram_status = "warn"

    # 2. RAM Row
    ram_status = "ok" if (footprint_gb * (1.0 - offload) <= 0.80 * ram_gb) else "fail"

    # 3. Disk Row
    disk_rec_val = round(file_size_gb * 1.5, 1)
    disk_min_val = round(file_size_gb, 1)
    disk_status = "ok" if disk_free_gb >= disk_rec_val else ("warn" if disk_free_gb >= disk_min_val else "fail")

    rows = [
        {
            "key": "vram",
            "label": "Graphics Memory (VRAM)",
            "minimum": f"{vram_min_val} GB",
            "recommended": f"{vram_rec_val} GB",
            "you_have": f"{vram_gb:.1f} GB ({gpu_name})",
            "status": vram_status,
        },
        {
            "key": "ram",
            "label": "System Memory (RAM)",
            "minimum": f"{ram_min_val} GB",
            "recommended": "8.0 GB",
            "you_have": f"{ram_gb:.1f} GB",
            "status": ram_status,
        },
        {
            "key": "disk",
            "label": "Free Storage",
            "minimum": f"{disk_min_val} GB",
            "recommended": f"{disk_rec_val} GB",
            "you_have": f"{disk_free_gb:.1f} GB",
            "status": disk_status,
        },
        {
            "key": "cpu",
            "label": "Processor (CPU)",
            "minimum": "4 cores",
            "recommended": "8+ cores",
            "you_have": f"{cpu_name} ({cpu_cores} cores)",
            "status": "info",
        },
        {
            "key": "os",
            "label": "Operating System",
            "minimum": "64-bit OS",
            "recommended": "Windows 10/11, Linux, macOS",
            "you_have": str(os_name),
            "status": "info",
        },
    ]

    hardware_echo = {
        "gpu_name": gpu_name,
        "vram_gb": round(vram_gb, 1),
        "vram_source": hw_session.vram_source or "scanner",
        "ram_gb": round(ram_gb, 1),
        "cpu_name": cpu_name,
        "cpu_cores": cpu_cores,
        "os": os_name,
        "disk_total_gb": round(float(hw_session.disk_total_gb or 0.0), 1),
        "disk_free_gb": round(disk_free_gb, 1),
    }

    return {
        "token": hw_session.token,
        "model_id": model.id,
        "name": model.name,
        "family": model.family,
        "params_b": model.params_b,
        "description": model.description,
        "tasks": parse_model_tasks(model.tasks),
        "quality_score": round(float(model.quality_score or 0.5), 2),
        "downloads_last_month": int(model.downloads_last_month or 0),
        "ollama_tag": model.ollama_tag,
        "best_quant": best.get("quant", "Q4_K_M"),
        "tier": best.get("tier", TIER_HEAVY),
        "hardware": hardware_echo,
        "comparison": rows,
        "quants": quant_evals,
    }


def compute_model_requirements(
    model: Model,
    quant_name: Optional[str] = None,
    hw_session: Optional[HardwareSession] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Computes Minimum and Recommended hardware requirement rows (VRAM, RAM, storage, CPU, OS)
    for a model/quant according to the ML physics engine rules.
    Works standalone (no hardware session needed).
    If hw_session is provided, populates 'you_have' and 'status' columns.
    """
    model_payload = get_cached_model()
    a = float(model_payload.get("footprint_a", 1.1)) if model_payload else 1.1
    b = float(model_payload.get("footprint_b", 0.1)) if model_payload else 0.1
    reserve_gb = float(model_payload.get("reserve_gb", 0.5)) if model_payload else 0.5
    footprint_source = str(model_payload.get("footprint_map_source", "default+margin")) if model_payload else "default+margin"

    quants = db.query(ModelQuant).filter(ModelQuant.model_id == model.id).all() if db else getattr(model, "quants", [])
    if not quants:
        return {"rows": [], "quant": quant_name, "error": "No quants available"}

    selected_quant = None
    if quant_name:
        selected_quant = next((q for q in quants if q.quant.lower() == quant_name.lower()), None)
    if not selected_quant:
        selected_quant = quants[0]

    file_size_gb = float(selected_quant.size_gb or 0.0)
    footprint_gb = estimate_footprint(file_size_gb, a=a, b=b, source=footprint_source)

    vram_rec_val = round(footprint_gb + reserve_gb, 1)
    vram_min_val = round(max(0.5, footprint_gb * 0.40 + reserve_gb), 1)
    ram_min_val = round(max(8.0, footprint_gb * 0.60 + 2.0), 1)
    disk_rec_val = round(file_size_gb * 1.5, 1)
    disk_min_val = round(file_size_gb, 1)

    has_hw = hw_session is not None
    vram_gb = float(hw_session.vram_gb or 0.0) if has_hw else 0.0
    ram_gb = float(hw_session.ram_gb or 16.0) if has_hw else 16.0
    gpu_name = hw_session.gpu_name or "Unknown GPU" if has_hw else ""
    cpu_name = hw_session.cpu_name or "Unknown CPU" if has_hw else ""
    cpu_cores = int(hw_session.cpu_cores or 1) if has_hw else 1
    os_name = hw_session.os or "Unknown OS" if has_hw else ""
    disk_free_gb = float(hw_session.disk_free_gb or 0.0) if has_hw else 0.0

    offload = estimate_offload(vram_gb, footprint_gb, reserve_gb) if has_hw else 0.0
    tier = classify_tier(footprint_gb, offload, ram_gb) if has_hw else None

    # Status indicators
    vram_status = None
    if has_hw:
        if vram_gb >= vram_rec_val:
            vram_status = "ok"
        elif offload >= 0.40:
            vram_status = "warn"
        else:
            vram_status = "fail"

    ram_status = None
    if has_hw:
        ram_status = "ok" if (footprint_gb * (1.0 - offload) <= 0.80 * ram_gb) else "fail"

    disk_status = None
    if has_hw:
        disk_status = "ok" if disk_free_gb >= disk_rec_val else ("warn" if disk_free_gb >= disk_min_val else "fail")

    rows = [
        {
            "key": "vram",
            "label": "Graphics Memory (VRAM)",
            "minimum": f"{vram_min_val} GB",
            "recommended": f"{vram_rec_val} GB",
            "you_have": f"{vram_gb:.1f} GB ({gpu_name})" if has_hw else None,
            "status": vram_status if has_hw else "info",
        },
        {
            "key": "ram",
            "label": "System Memory (RAM)",
            "minimum": f"{ram_min_val} GB",
            "recommended": "8.0 GB",
            "you_have": f"{ram_gb:.1f} GB" if has_hw else None,
            "status": ram_status if has_hw else "info",
        },
        {
            "key": "disk",
            "label": "Free Storage",
            "minimum": f"{disk_min_val} GB",
            "recommended": f"{disk_rec_val} GB",
            "you_have": f"{disk_free_gb:.1f} GB" if has_hw else None,
            "status": disk_status if has_hw else "info",
        },
        {
            "key": "cpu",
            "label": "Processor (CPU)",
            "minimum": "4 cores",
            "recommended": "8+ cores",
            "you_have": f"{cpu_name} ({cpu_cores} cores)" if has_hw else None,
            "status": "info",
        },
        {
            "key": "os",
            "label": "Operating System",
            "minimum": "64-bit OS",
            "recommended": "Windows 10/11, Linux, macOS",
            "you_have": str(os_name) if has_hw else None,
            "status": "info",
        },
    ]

    return {
        "model_id": model.id,
        "quant": selected_quant.quant,
        "file_size_gb": file_size_gb,
        "footprint_gb": footprint_gb,
        "tier": tier,
        "offload_fraction": offload if has_hw else None,
        "rows": rows,
    }
