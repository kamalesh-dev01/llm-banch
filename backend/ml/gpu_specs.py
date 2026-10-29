import json
import re
from typing import Optional, Tuple
from ml.config import GPU_SPECS_PATH

_SPECS = None

def load_gpu_specs() -> dict:
    global _SPECS
    if _SPECS is None:
        with open(GPU_SPECS_PATH, "r", encoding="utf-8") as f:
            _SPECS = json.load(f)
    return _SPECS

def match_gpu(gpu_name: Optional[str]) -> Tuple[Optional[str], Optional[float]]:
    """
    Normalizes a scanner name (e.g. 'NVIDIA GeForce RTX 3050 Laptop GPU')
    to key (e.g. 'RTX 3050 Laptop') and returns (key, bandwidth_gbps).
    Case-insensitive substring match, longest match wins so
    'RTX 3050 Laptop' matches before 'RTX 3050'.
    Returns (None, None) if no match.
    """
    if not gpu_name or not isinstance(gpu_name, str):
        return None, None

    specs = load_gpu_specs()
    # Normalize spaces
    name_clean = " " + " ".join(gpu_name.lower().split()) + " "

    # Sort keys by length descending (longest match wins)
    sorted_keys = sorted(specs.keys(), key=lambda k: len(k), reverse=True)

    for key in sorted_keys:
        key_clean = key.lower()
        # Word boundary aware search
        pattern = r"(?:\b|_)" + re.escape(key_clean) + r"(?:\b|_)"
        if re.search(pattern, name_clean):
            return key, float(specs[key]["bandwidth_gbps"])

    return None, None
