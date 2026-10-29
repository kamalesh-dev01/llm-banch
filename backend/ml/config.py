from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ML_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

RESULTS_DIR = PROJECT_ROOT / "benchmark" / "results"
ARTIFACT_DIR = ML_DIR / "artifacts"
DATA_FILTERS_PATH = ML_DIR / "data_filters.json"
GPU_SPECS_PATH = ML_DIR / "gpu_specs.json"

USE_PROMPTS = ["medium", "long"]
MIN_OUTPUT_TOKENS = 50
MIN_CONFIGS_WARN = 8
MAX_MAPE_PCT = 35.0  # CI quality gate
DEFAULT_CTX = 4096
DEFAULT_RAM_BW_GBPS = 40.0  # Assumption: dual-channel laptop RAM, theoretical 40-70 GB/s
DEFAULT_CPU_BANDWIDTH_GBPS = DEFAULT_RAM_BW_GBPS  # Backward compatibility alias
FOOTPRINT_SAFETY = 1.15  # stopgap until the footprint map is fitted on clean data with file_size_gb
