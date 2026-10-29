import logging
from typing import Any, Dict, Optional

from ml.gpu_specs import match_gpu
from ml.predict import predict_tps

logger = logging.getLogger(__name__)


def predict_for_session_and_quant(
    quant: Any,
    hw_session: Any,
    params_b: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """
    Predicts inference performance for a given ModelQuant and HardwareSession.
    Returns dict with keys: tps, tps_min, tps_max, offload_fraction, footprint_gb, confidence, model_type.
    Falls back gracefully to None on any error or missing data.
    """
    try:
        if not quant or not hw_session:
            return None

        # GPU name and bandwidth
        gpu_name = getattr(hw_session, "gpu_name", None)
        vram_gb = float(getattr(hw_session, "vram_gb", 0.0))
        ram_gb = float(getattr(hw_session, "ram_gb", 16.0))

        # Size of quant
        file_size_gb = float(getattr(quant, "size_gb", 0.0))
        if file_size_gb <= 0:
            return None

        matched_key, bandwidth_gbps = match_gpu(gpu_name)

        # Model params if available
        if params_b is None:
            model_obj = getattr(quant, "model", None)
            if model_obj:
                params_b = float(getattr(model_obj, "params_b", 3.0))
            else:
                params_b = 3.0

        prediction = predict_tps(
            file_size_gb=file_size_gb,
            vram_gb=vram_gb,
            bandwidth_gbps=bandwidth_gbps,
            gpu_name=gpu_name,
            ram_total_gb=ram_gb,
            params_b=params_b,
        )
        return prediction
    except Exception as e:
        logger.warning(f"Failed to generate ML prediction: {e}")
        return None
