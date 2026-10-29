"""
LLM Bench Hardware Scanner - Core Engine
Handles hardware detection, token resolution, and network communication with the backend.
Contains no GUI code and is fully unit-testable.
"""
import os
import sys
import re
import time
import logging
import tempfile
import subprocess
import platform
import psutil
import requests

import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

# Constants overridable by environment variables
BACKEND_URL = os.environ.get("LLMBENCH_BACKEND", "https://llm-banch.onrender.com")
SITE_URL = os.environ.get("LLMBENCH_SITE", "https://llm-banch.vercel.app")

# File logger to %TEMP%\llmbench-scanner.log
LOG_PATH = os.path.join(tempfile.gettempdir(), "llmbench-scanner.log")
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    encoding="utf-8"
)
logger = logging.getLogger("scanner_core")


def parse_token(exe_path: str = None, argv: list = None) -> str | None:
    """
    Parses scan session token in order of precedence:
    1. From executable/file name: LLMBench-Scanner-([A-Za-z0-9_-]{8,32})
    2. From CLI argv[1]
    3. From environment variable LLMBENCH_TOKEN
    4. Returns None if not found
    """
    if exe_path is None:
        exe_path = sys.executable if getattr(sys, "frozen", False) else sys.argv[0]

    filename = os.path.basename(exe_path)
    match = re.search(r"LLMBench-Scanner-([A-Za-z0-9_-]{8,32})", filename, re.IGNORECASE)
    if match:
        token = match.group(1)
        logger.info("Found token from file name: %s", token)
        return token

    if argv is None:
        argv = sys.argv
    if len(argv) > 1 and argv[1] and not argv[1].startswith("-"):
        token = argv[1].strip()
        logger.info("Found token from command line argument: %s", token)
        return token

    env_token = os.environ.get("LLMBENCH_TOKEN")
    if env_token and env_token.strip():
        token = env_token.strip()
        logger.info("Found token from LLMBENCH_TOKEN environment variable: %s", token)
        return token

    logger.info("No token provided via filename, argv, or environment.")
    return None


def create_session(backend_url: str = BACKEND_URL) -> str:
    """
    Fallback flow: requests a new scan session token from the backend.
    """
    url = f"{backend_url.rstrip('/')}/api/scan-sessions"
    logger.info("Creating fallback scan session at %s", url)
    res = requests.post(url, timeout=10)
    res.raise_for_status()
    data = res.json()
    token = data["token"]
    logger.info("Created new session token: %s", token)
    return token


def detect_gpu() -> dict:
    """
    Detects GPU using pynvml (nvidia-ml-py) first, picking the GPU with the most VRAM.
    Falls back to PowerShell Get-CimInstance Win32_VideoController with vram_gb = 0.
    """
    # 1. Try NVML
    try:
        import pynvml
        pynvml.nvmlInit()
        device_count = pynvml.nvmlDeviceGetCount()
        best_gpu = None
        max_vram = -1.0

        for i in range(device_count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            raw_name = pynvml.nvmlDeviceGetName(handle)
            gpu_name = raw_name.decode("utf-8") if isinstance(raw_name, bytes) else str(raw_name)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            vram_gb = round(mem_info.total / (1024 ** 3), 1)

            if vram_gb > max_vram:
                max_vram = vram_gb
                best_gpu = {"gpu_name": gpu_name.strip(), "vram_gb": vram_gb}

        pynvml.nvmlShutdown()
        if best_gpu:
            logger.info("Detected NVIDIA GPU via NVML: %s (%s GB)", best_gpu["gpu_name"], best_gpu["vram_gb"])
            return best_gpu
    except Exception as e:
        logger.warning("NVML GPU detection failed or not available: %s", e)

    # 2. Fallback to PowerShell
    try:
        cmd = [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=8, check=True)
        names = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
        if names:
            chosen = names[0]
            # Prefer discrete/dedicated GPU if multiple are reported (e.g. integrated + discrete)
            for name in names:
                if any(k in name.lower() for k in ["nvidia", "geforce", "rtx", "gtx", "radeon", "amd", "arc"]):
                    chosen = name
                    break
            logger.info("Detected GPU via PowerShell: %s (vram_gb=0, to be resolved by backend)", chosen)
            return {"gpu_name": chosen, "vram_gb": 0.0}
    except Exception as e:
        logger.error("PowerShell GPU detection failed: %s", e)

    return {"gpu_name": "Unknown GPU", "vram_gb": 0.0}


def detect_cpu() -> dict:
    """
    Detects real CPU name from Windows registry:
    HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0 ProcessorNameString
    and physical core count via psutil.
    """
    cpu_name = "Unknown CPU"
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        raw_name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
        winreg.CloseKey(key)
        if raw_name:
            cpu_name = str(raw_name).strip()
    except Exception as e:
        logger.warning("Registry CPU name read failed: %s", e)
        # Non-Windows or fallback
        cpu_name = platform.processor() or "Unknown CPU"

    physical_cores = psutil.cpu_count(logical=False) or psutil.cpu_count() or 1
    logger.info("Detected CPU: %s (%s physical cores)", cpu_name, physical_cores)
    return {"cpu_name": cpu_name, "cpu_cores": physical_cores}


def detect_ram() -> dict:
    """
    Detects total system memory in GB.
    """
    ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    logger.info("Detected RAM: %s GB", ram_gb)
    return {"ram_gb": ram_gb}


def detect_os() -> dict:
    """
    Detects operating system name and version.
    """
    os_name = f"{platform.system()} {platform.release()}".strip()
    logger.info("Detected OS: %s", os_name)
    return {"os": os_name}


def detect_disk() -> dict:
    """
    Detects free and total disk space on the drive holding %USERPROFILE%\\.ollama
    if it exists, otherwise on the system drive.
    """
    user_profile = os.environ.get("USERPROFILE", "")
    ollama_dir = os.path.join(user_profile, ".ollama") if user_profile else ""
    target_path = ollama_dir if (ollama_dir and os.path.exists(ollama_dir)) else (os.environ.get("SystemDrive", "C:") + "\\")

    try:
        usage = psutil.disk_usage(target_path)
        disk_total_gb = round(usage.total / (1024 ** 3), 1)
        disk_free_gb = round(usage.free / (1024 ** 3), 1)
    except Exception as e:
        logger.warning("Disk check failed on %s: %s", target_path, e)
        disk_total_gb = 0.0
        disk_free_gb = 0.0

    logger.info("Detected Disk (%s): %s GB free of %s GB total", target_path, disk_free_gb, disk_total_gb)
    return {"disk_total_gb": disk_total_gb, "disk_free_gb": disk_free_gb}


def scan_all() -> dict:
    """
    Runs all hardware detection steps and returns the aggregated hardware payload.
    """
    hw = {}
    hw.update(detect_gpu())
    hw.update(detect_ram())
    hw.update(detect_cpu())
    hw.update(detect_os())
    hw.update(detect_disk())
    return hw


def send(hardware_data: dict, token: str, backend_url: str = BACKEND_URL, max_retries: int = 3, timeout: int = 10) -> str:
    """
    Submits hardware data to POST /api/hardware-scan with 10s timeout and 3 retries.
    Returns the token upon success or raises RuntimeError.
    """
    url = f"{backend_url.rstrip('/')}/api/hardware-scan"
    payload = {
        "token": token,
        "gpu_name": str(hardware_data.get("gpu_name", "Unknown GPU")),
        "vram_gb": float(hardware_data.get("vram_gb", 0.0)),
        "ram_gb": float(hardware_data.get("ram_gb", 0.0)),
        "cpu_name": str(hardware_data.get("cpu_name", "Unknown CPU")),
        "cpu_cores": int(hardware_data.get("cpu_cores", 1)),
        "os": str(hardware_data.get("os", "Unknown OS")),
        "disk_total_gb": float(hardware_data.get("disk_total_gb", 0.0)),
        "disk_free_gb": float(hardware_data.get("disk_free_gb", 0.0)),
    }

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Submitting hardware to %s (attempt %s/%s)...", url, attempt, max_retries)
            resp = requests.post(url, json=payload, timeout=timeout)
            if resp.status_code == 200:
                logger.info("Hardware successfully submitted for token %s", token)
                return token
            elif resp.status_code in (404, 409, 410):
                # Client errors: do not retry
                msg = resp.json().get("detail", f"HTTP {resp.status_code}")
                logger.error("Backend rejected submission: %s", msg)
                raise RuntimeError(f"Scan submission failed: {msg}")
            else:
                last_error = f"Server returned status {resp.status_code}: {resp.text}"
                logger.warning("Attempt %s failed: %s", attempt, last_error)
        except requests.RequestException as e:
            last_error = str(e)
            logger.warning("Attempt %s network error: %s", attempt, last_error)

        if attempt < max_retries:
            time.sleep(1.0 * attempt)

    raise RuntimeError(f"Could not submit scan results after {max_retries} attempts: {last_error}")
