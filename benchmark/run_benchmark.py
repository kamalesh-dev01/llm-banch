"""
LLM Bench - Real Benchmark Runner
Measures actual Ollama inference performance and saves hardware and metric data to CSV.
"""

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import sys
import threading
import time
from typing import Any, Optional
import warnings

# Suppress deprecation warning from pynvml wrapper if present
warnings.filterwarnings("ignore", category=FutureWarning)

import psutil
import requests

# Ensure benchmark directory is on sys.path so prompts can be imported directly
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from prompts import PROMPTS

# CSV column specifications in exact required order
CSV_COLUMNS: list[str] = [
    "machine_label",
    "timestamp",
    "gpu_name",
    "vram_total_gb",
    "gpu_mem_bandwidth_gbps",
    "ram_total_gb",
    "cpu_name",
    "model_tag",
    "params_b",
    "quantization",
    "model_size_gb",
    "prompt_label",
    "run_idx",
    "prompt_tokens",
    "output_tokens",
    "tokens_per_sec",
    "prompt_tokens_per_sec",
    "ttft_ms",
    "load_ms",
    "gpu_offload_fraction",
    "peak_vram_used_gb",
    "avg_gpu_util",
    "error",
]


class GpuSampler:
    """
    Samples GPU memory used and GPU utilization via pynvml every 200 ms in a background thread.
    Safely degrades if pynvml fails or no NVIDIA GPU is available.
    """

    def __init__(self, interval_sec: float = 0.2) -> None:
        """Initialize the GPU sampler with a sampling interval in seconds."""
        self.interval_sec = interval_sec
        self.running: bool = False
        self.thread: Optional[threading.Thread] = None
        self._used_vram_samples: list[float] = []
        self._util_samples: list[float] = []
        self._handle: Any = None
        self._nvml_initialized: bool = False

    def start(self) -> None:
        """Initialize NVML handle and launch background sampling thread."""
        self._used_vram_samples = []
        self._util_samples = []
        try:
            import pynvml
            pynvml.nvmlInit()
            self._handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            self._nvml_initialized = True
        except Exception:
            self._handle = None
            self._nvml_initialized = False

        self.running = True
        self.thread = threading.Thread(target=self._sample_loop, daemon=True)
        self.thread.start()

    def _sample_loop(self) -> None:
        """Continuous background sampling loop."""
        while self.running:
            if self._nvml_initialized and self._handle is not None:
                try:
                    import pynvml
                    mem_info = pynvml.nvmlDeviceGetMemoryInfo(self._handle)
                    used_gb = mem_info.used / (1024 ** 3)
                    self._used_vram_samples.append(used_gb)

                    rates = pynvml.nvmlDeviceGetUtilizationRates(self._handle)
                    self._util_samples.append(float(rates.gpu))
                except Exception:
                    pass
            time.sleep(self.interval_sec)

    def stop(self) -> tuple[float, float]:
        """
        Stop sampling thread and calculate peak VRAM used (GB) and average GPU utilization (%).
        Returns: (peak_vram_used_gb, avg_gpu_util).
        """
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=1.0)
            self.thread = None

        if self._nvml_initialized:
            try:
                import pynvml
                pynvml.nvmlShutdown()
            except Exception:
                pass
            self._nvml_initialized = False

        peak_vram_gb = round(max(self._used_vram_samples), 3) if self._used_vram_samples else 0.0
        avg_util = round(sum(self._util_samples) / len(self._util_samples), 1) if self._util_samples else 0.0
        return peak_vram_gb, avg_util


def get_gpu_info() -> dict[str, Any]:
    """
    Retrieve GPU name and total VRAM in GB using pynvml.
    Falls back gracefully if pynvml fails or non-NVIDIA GPU is present.
    """
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        gpu_name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode("utf-8")
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        vram_total_gb = round(mem_info.total / (1024 ** 3), 2)
        pynvml.nvmlShutdown()
        return {"gpu_name": gpu_name, "vram_total_gb": vram_total_gb}
    except Exception:
        return {"gpu_name": "Unknown GPU", "vram_total_gb": 0.0}


def get_system_info() -> dict[str, Any]:
    """
    Retrieve total RAM in GB and CPU model name using psutil and system queries.
    """
    ram_total_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)
    cpu_name = ""

    # Attempt to query Windows registry for clean CPU marketing name
    if sys.platform == "win32":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
            )
            val, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            cpu_name = str(val).strip()
        except Exception:
            pass

    if not cpu_name:
        try:
            cpu_name = platform.processor() or "Unknown CPU"
        except Exception:
            cpu_name = "Unknown CPU"

    return {"ram_total_gb": ram_total_gb, "cpu_name": cpu_name}


def load_config(config_path: Path) -> dict[str, Any]:
    """
    Load benchmark configuration from JSON file.
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_parameter_size(param_size_str: str) -> float:
    """
    Convert parameter_size string (e.g. '3.2B', '494M', '494.03M', '1.5b') to billions of parameters (float).
    """
    if not param_size_str:
        return 0.0
    val = param_size_str.strip().upper()
    if val.endswith("B"):
        try:
            return round(float(val[:-1]), 3)
        except ValueError:
            return 0.0
    elif val.endswith("M"):
        try:
            return round(float(val[:-1]) / 1000.0, 3)
        except ValueError:
            return 0.0
    elif val.endswith("K"):
        try:
            return round(float(val[:-1]) / 1_000_000.0, 6)
        except ValueError:
            return 0.0
    elif val.endswith("T"):
        try:
            return round(float(val[:-1]) * 1000.0, 2)
        except ValueError:
            return 0.0
    try:
        return round(float(val), 3)
    except ValueError:
        return 0.0


def get_installed_models(base_url: str) -> set[str]:
    """
    Query GET /api/tags to retrieve the set of currently installed models in Ollama.
    """
    installed: set[str] = set()
    try:
        resp = requests.get(f"{base_url}/api/tags", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            for m in data.get("models", []):
                name = m.get("name", "")
                model = m.get("model", "")
                if name:
                    installed.add(name)
                if model:
                    installed.add(model)
    except Exception as e:
        print(f"Warning: Could not query installed models from {base_url}/api/tags: {e}")
    return installed


def is_model_installed(installed_models: set[str], model_tag: str) -> bool:
    """
    Check if a model tag or its canonical latest variant is already present in installed models.
    """
    if model_tag in installed_models:
        return True
    if ":" not in model_tag and f"{model_tag}:latest" in installed_models:
        return True
    if model_tag.endswith(":latest") and model_tag[:-7] in installed_models:
        return True
    return False


def pull_model(base_url: str, model_tag: str) -> None:
    """
    Pull model from Ollama registry with streaming progress percentage.
    Raises RuntimeError if pull fails.
    """
    url = f"{base_url}/api/pull"
    try:
        resp = requests.post(
            url,
            json={"name": model_tag, "stream": True},
            stream=True,
            timeout=600,
        )
    except Exception as e:
        raise RuntimeError(f"Network error initiating pull for {model_tag}: {e}")

    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} pulling {model_tag}: {resp.text}")

    last_pct = -1.0
    for line in resp.iter_lines():
        if not line:
            continue
        try:
            chunk = json.loads(line.decode("utf-8"))
        except Exception:
            continue

        if "error" in chunk:
            raise RuntimeError(chunk["error"])

        status = chunk.get("status", "")
        completed = chunk.get("completed")
        total = chunk.get("total")

        if total and total > 0 and completed is not None:
            pct = (completed / total) * 100
            if abs(pct - last_pct) >= 1.0 or pct >= 100.0:
                print(f"\rPulling {model_tag}: {pct:.1f}% ({status})", end="", flush=True)
                last_pct = pct
        elif status:
            print(f"\rPulling {model_tag}: {status}...", end="", flush=True)

    print(f"\rPulling {model_tag}: 100.0% Complete.                             ")


def get_model_details(base_url: str, model_tag: str) -> tuple[float, str]:
    """
    Query POST /api/show to read quantization_level and parameter_size.
    Returns: (params_b, quantization).
    """
    url = f"{base_url}/api/show"
    resp = requests.post(url, json={"name": model_tag}, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to get model details for {model_tag}: HTTP {resp.status_code}")

    data = resp.json()
    details = data.get("details", {})
    quantization = details.get("quantization_level", "unknown")
    param_size_str = details.get("parameter_size", "")
    params_b = parse_parameter_size(param_size_str)
    return params_b, quantization


def warmup_model(base_url: str, model_tag: str, num_ctx: int) -> None:
    """
    Run one short generation and discard the result so model load time
    does not pollute the benchmark measurements.
    """
    url = f"{base_url}/api/generate"
    payload = {
        "model": model_tag,
        "prompt": "Warm-up inference check.",
        "stream": False,
        "options": {
            "num_predict": 5,
            "num_ctx": num_ctx,
            "temperature": 0.0,
        },
    }
    requests.post(url, json=payload, timeout=300)


def get_model_memory_stats(base_url: str, model_tag: str) -> tuple[int, int]:
    """
    Call GET /api/ps immediately after generation to retrieve total size and size_vram in bytes.
    Returns: (size_bytes, size_vram_bytes).
    """
    try:
        resp = requests.get(f"{base_url}/api/ps", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            for m in data.get("models", []):
                name = m.get("name", "")
                model = m.get("model", "")
                if (
                    name == model_tag
                    or model == model_tag
                    or name.startswith(model_tag)
                    or model_tag.startswith(name)
                    or name.split(":")[0] == model_tag.split(":")[0]
                ):
                    size = int(m.get("size", 0))
                    size_vram = int(m.get("size_vram", 0))
                    return size, size_vram
    except Exception as e:
        print(f"Warning: Failed to read /api/ps: {e}")
    return 0, 0


def unload_model(base_url: str, model_tag: str) -> None:
    """
    Unload model from memory by sending POST /api/generate with keep_alive: 0.
    """
    try:
        requests.post(
            f"{base_url}/api/generate",
            json={"model": model_tag, "keep_alive": 0},
            timeout=30,
        )
    except Exception as e:
        print(f"Warning: Failed to unload model {model_tag}: {e}")


def delete_model(base_url: str, model_tag: str) -> None:
    """
    Delete a model from Ollama using DELETE /api/delete.
    """
    try:
        resp = requests.delete(
            f"{base_url}/api/delete",
            json={"model": model_tag},
            timeout=30,
        )
        if resp.status_code == 200:
            print(f"Cleaned up model {model_tag} (deleted from Ollama).")
        else:
            print(f"Failed to cleanup model {model_tag}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"Warning: Exception while deleting model {model_tag}: {e}")


def append_csv_row(csv_path: Path, row: dict[str, Any]) -> None:
    """
    Append a single row to the results CSV file, writing the header if the file does not exist.
    """
    file_exists = csv_path.exists() and csv_path.stat().st_size > 0
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)
        f.flush()


def get_completed_models(csv_path: Path) -> set[str]:
    """
    Read the existing CSV file (if any) and return the set of model_tags that already
    have completed rows with an empty error column.
    """
    completed: set[str] = set()
    if not csv_path.exists() or csv_path.stat().st_size == 0:
        return completed

    try:
        with open(csv_path, mode="r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                model_tag = row.get("model_tag", "").strip()
                err = row.get("error", "").strip()
                if model_tag and not err:
                    completed.add(model_tag)
    except Exception as e:
        print(f"Warning: Could not read existing CSV at {csv_path}: {e}")
    return completed


def create_error_row(
    hw_info: dict[str, Any],
    machine_label: str,
    gpu_bandwidth: float,
    model_tag: str,
    error_msg: str,
    params_b: float = 0.0,
    quantization: str = "",
    model_size_gb: float = 0.0,
    prompt_label: str = "",
    run_idx: int = 0,
) -> dict[str, Any]:
    """
    Construct an error row for the CSV when pull or generation fails.
    """
    return {
        "machine_label": machine_label,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gpu_name": hw_info.get("gpu_name", "Unknown GPU"),
        "vram_total_gb": hw_info.get("vram_total_gb", 0.0),
        "gpu_mem_bandwidth_gbps": gpu_bandwidth,
        "ram_total_gb": hw_info.get("ram_total_gb", 0.0),
        "cpu_name": hw_info.get("cpu_name", "Unknown CPU"),
        "model_tag": model_tag,
        "params_b": params_b,
        "quantization": quantization,
        "model_size_gb": model_size_gb,
        "prompt_label": prompt_label,
        "run_idx": run_idx,
        "prompt_tokens": 0,
        "output_tokens": 0,
        "tokens_per_sec": 0.0,
        "prompt_tokens_per_sec": 0.0,
        "ttft_ms": 0.0,
        "load_ms": 0.0,
        "gpu_offload_fraction": 0.0,
        "peak_vram_used_gb": 0.0,
        "avg_gpu_util": 0.0,
        "error": error_msg,
    }


def print_summary_table(csv_path: Path, target_models: Optional[list[str]] = None) -> None:
    """
    Print a summary table from the CSV results:
    model_tag, quantization, avg tokens_per_sec, avg ttft_ms, avg gpu_offload_fraction.
    """
    if not csv_path.exists() or csv_path.stat().st_size == 0:
        print("\nNo results available to summarize.")
        return

    data: dict[str, dict[str, Any]] = {}
    with open(csv_path, mode="r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tag = row.get("model_tag", "").strip()
            if target_models is not None and tag not in target_models:
                continue
            err = row.get("error", "").strip()
            if err:
                continue
            if tag not in data:
                data[tag] = {
                    "quantization": row.get("quantization", "unknown"),
                    "tps": [],
                    "ttft": [],
                    "offload": [],
                }
            try:
                data[tag]["tps"].append(float(row.get("tokens_per_sec", 0.0)))
                data[tag]["ttft"].append(float(row.get("ttft_ms", 0.0)))
                data[tag]["offload"].append(float(row.get("gpu_offload_fraction", 0.0)))
            except ValueError:
                pass

    if not data:
        print("\nNo successful benchmark runs found to summarize.")
        return

    print("\n" + "=" * 84)
    print("                              BENCHMARK SUMMARY")
    print("=" * 84)
    print(f"{'Model Tag':<26} {'Quantization':<14} {'Avg tok/s':<14} {'Avg TTFT (ms)':<15} {'Avg GPU Offload':<15}")
    print("-" * 84)
    for tag, stats in data.items():
        avg_tps = sum(stats["tps"]) / len(stats["tps"]) if stats["tps"] else 0.0
        avg_ttft = sum(stats["ttft"]) / len(stats["ttft"]) if stats["ttft"] else 0.0
        avg_offload = (sum(stats["offload"]) / len(stats["offload"])) if stats["offload"] else 0.0
        offload_str = f"{avg_offload * 100:.1f}%"
        print(f"{tag:<26} {stats['quantization']:<14} {avg_tps:<14.2f} {avg_ttft:<15.2f} {offload_str:<15}")
    print("=" * 84 + "\n")


def run_benchmark(config_path: Path, only_model: Optional[str] = None, cleanup: bool = False) -> None:
    """
    Execute the benchmark workflow across all specified models and prompts.
    """
    # Configure UTF-8 encoding for standard output if supported
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    config = load_config(config_path)
    machine_label: str = config.get("machine_label", "default-machine")
    ollama_url: str = config.get("ollama_url", "http://localhost:11434").rstrip("/")
    gpu_bandwidth: float = float(config.get("gpu_mem_bandwidth_gbps", 0.0))
    runs_per_prompt: int = int(config.get("runs_per_prompt", 2))
    num_predict: int = int(config.get("num_predict", 200))
    num_ctx: int = int(config.get("num_ctx", 4096))
    models: list[str] = config.get("models", [])

    if only_model:
        models = [only_model]

    # Hardware detection
    gpu_info = get_gpu_info()
    sys_info = get_system_info()
    hw_info = {
        "gpu_name": gpu_info["gpu_name"],
        "vram_total_gb": gpu_info["vram_total_gb"],
        "ram_total_gb": sys_info["ram_total_gb"],
        "cpu_name": sys_info["cpu_name"],
    }

    # Results file location (benchmark/results/{machine_label}.csv)
    results_dir = SCRIPT_DIR / "results"
    results_csv_path = results_dir / f"{machine_label}.csv"

    print("================================================================================")
    print("LLM Bench - Inference Performance Benchmark")
    print(f"Machine Label      : {machine_label}")
    print(f"GPU Detected       : {hw_info['gpu_name']} ({hw_info['vram_total_gb']} GB VRAM)")
    print(f"GPU Bandwidth      : {gpu_bandwidth} GB/s")
    print(f"System RAM         : {hw_info['ram_total_gb']} GB")
    print(f"CPU Detected       : {hw_info['cpu_name']}")
    print(f"Ollama Endpoint    : {ollama_url}")
    print(f"Runs per Prompt    : {runs_per_prompt} (Prompts: {len(PROMPTS)})")
    print(f"Output CSV         : {results_csv_path}")
    print("================================================================================\n")

    # Discover initially installed models for cleanup check
    initial_installed = get_installed_models(ollama_url)

    # Check existing CSV for resumability
    completed_models = get_completed_models(results_csv_path)

    total_models = len(models)
    models_evaluated: list[str] = []

    for model_idx, model_tag in enumerate(models, start=1):
        # Resumable check
        if model_tag in completed_models:
            if only_model:
                print(f"Notice: '{model_tag}' already completed in CSV, re-running due to --only flag.")
            else:
                print(f"[{model_idx}/{total_models}] Skipping {model_tag} — already completed in {results_csv_path.name}")
                models_evaluated.append(model_tag)
                continue

        models_evaluated.append(model_tag)
        print(f"\n[{model_idx}/{total_models}] Preparing model: {model_tag}")

        pre_existing = is_model_installed(initial_installed, model_tag)

        # 1. Pull model if not installed
        current_installed = get_installed_models(ollama_url)
        if not is_model_installed(current_installed, model_tag):
            print(f"Pulling model {model_tag}...")
            try:
                pull_model(ollama_url, model_tag)
            except Exception as e:
                err_msg = f"Pull failed: {e}"
                print(f"ERROR: {err_msg}")
                error_row = create_error_row(
                    hw_info=hw_info,
                    machine_label=machine_label,
                    gpu_bandwidth=gpu_bandwidth,
                    model_tag=model_tag,
                    error_msg=err_msg,
                )
                append_csv_row(results_csv_path, error_row)
                continue

        # 2. Query details: quantization_level and parameter_size
        params_b = 0.0
        quantization = "unknown"
        try:
            params_b, quantization = get_model_details(ollama_url, model_tag)
            print(f"Model Specs: params={params_b}B, quantization={quantization}")
        except Exception as e:
            err_msg = f"Failed to retrieve model details: {e}"
            print(f"ERROR: {err_msg}")
            error_row = create_error_row(
                hw_info=hw_info,
                machine_label=machine_label,
                gpu_bandwidth=gpu_bandwidth,
                model_tag=model_tag,
                error_msg=err_msg,
            )
            append_csv_row(results_csv_path, error_row)
            continue

        # Benchmark runs for this model
        try:
            # 3. Warm-up run
            print(f"Running warm-up for {model_tag}...")
            try:
                warmup_model(ollama_url, model_tag, num_ctx=num_ctx)
            except Exception as e:
                print(f"Warm-up notice: {e}")

            # 4. Prompt runs
            total_runs_for_model = len(PROMPTS) * runs_per_prompt
            current_run = 0

            for prompt_label, prompt_text in PROMPTS.items():
                for run_idx in range(runs_per_prompt):
                    current_run += 1
                    sampler = GpuSampler(interval_sec=0.2)
                    sampler.start()

                    gen_url = f"{ollama_url}/api/generate"
                    gen_payload = {
                        "model": model_tag,
                        "prompt": prompt_text,
                        "stream": False,
                        "options": {
                            "num_predict": num_predict,
                            "num_ctx": num_ctx,
                            "temperature": 0.0,
                        },
                    }

                    try:
                        gen_resp = requests.post(gen_url, json=gen_payload, timeout=300)
                        peak_vram_used_gb, avg_gpu_util = sampler.stop()

                        if gen_resp.status_code != 200:
                            raise RuntimeError(f"HTTP {gen_resp.status_code}: {gen_resp.text}")

                        gen_data = gen_resp.json()

                        # Read size and size_vram from GET /api/ps immediately after generation
                        size_bytes, size_vram_bytes = get_model_memory_stats(ollama_url, model_tag)
                        gpu_offload_fraction = (size_vram_bytes / size_bytes) if size_bytes > 0 else 0.0
                        gpu_offload_fraction = max(0.0, min(1.0, gpu_offload_fraction))
                        model_size_gb = round(size_bytes / (1024 ** 3), 2) if size_bytes > 0 else 0.0

                        # Calculate performance metrics
                        eval_count = int(gen_data.get("eval_count", 0))
                        prompt_eval_count = int(gen_data.get("prompt_eval_count", 0))
                        eval_duration_ns = float(gen_data.get("eval_duration", 0.0))
                        prompt_eval_duration_ns = float(gen_data.get("prompt_eval_duration", 0.0))
                        load_duration_ns = float(gen_data.get("load_duration", 0.0))

                        tokens_per_sec = (eval_count / (eval_duration_ns / 1e9)) if eval_duration_ns > 0 else 0.0
                        prompt_tokens_per_sec = (
                            (prompt_eval_count / (prompt_eval_duration_ns / 1e9))
                            if prompt_eval_duration_ns > 0
                            else 0.0
                        )
                        ttft_ms = (prompt_eval_duration_ns / 1e6) if prompt_eval_duration_ns > 0 else 0.0
                        load_ms = (load_duration_ns / 1e6) if load_duration_ns > 0 else 0.0

                        row = {
                            "machine_label": machine_label,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "gpu_name": hw_info["gpu_name"],
                            "vram_total_gb": hw_info["vram_total_gb"],
                            "gpu_mem_bandwidth_gbps": gpu_bandwidth,
                            "ram_total_gb": hw_info["ram_total_gb"],
                            "cpu_name": hw_info["cpu_name"],
                            "model_tag": model_tag,
                            "params_b": params_b,
                            "quantization": quantization,
                            "model_size_gb": model_size_gb,
                            "prompt_label": prompt_label,
                            "run_idx": run_idx,
                            "prompt_tokens": prompt_eval_count,
                            "output_tokens": eval_count,
                            "tokens_per_sec": round(tokens_per_sec, 2),
                            "prompt_tokens_per_sec": round(prompt_tokens_per_sec, 2),
                            "ttft_ms": round(ttft_ms, 2),
                            "load_ms": round(load_ms, 2),
                            "gpu_offload_fraction": round(gpu_offload_fraction, 4),
                            "peak_vram_used_gb": peak_vram_used_gb,
                            "avg_gpu_util": avg_gpu_util,
                            "error": "",
                        }
                        append_csv_row(results_csv_path, row)

                        # Print clear progress matching exact specification:
                        # "[3/14] qwen2.5:3b — run 2/6 — 41.2 tok/s"
                        print(
                            f"[{model_idx}/{total_models}] {model_tag} \u2014 run {current_run}/{total_runs_for_model} \u2014 {tokens_per_sec:.1f} tok/s"
                        )

                    except Exception as run_err:
                        sampler.stop()
                        err_msg = f"Inference failed on {prompt_label} run {run_idx}: {run_err}"
                        print(f"ERROR: {err_msg}")
                        error_row = create_error_row(
                            hw_info=hw_info,
                            machine_label=machine_label,
                            gpu_bandwidth=gpu_bandwidth,
                            model_tag=model_tag,
                            error_msg=err_msg,
                            params_b=params_b,
                            quantization=quantization,
                            prompt_label=prompt_label,
                            run_idx=run_idx,
                        )
                        append_csv_row(results_csv_path, error_row)

        finally:
            # 5. Unload the model before moving to next model
            unload_model(ollama_url, model_tag)

            # Cleanup if requested and model was not preinstalled
            if cleanup and not pre_existing:
                delete_model(ollama_url, model_tag)

            # Let GPU settle
            time.sleep(2)

    # Print summary table at completion
    print_summary_table(results_csv_path, target_models=models_evaluated)


def main() -> None:
    """Parse CLI arguments and run benchmark."""
    parser = argparse.ArgumentParser(
        description="LLM Bench - Real Ollama Benchmark Runner"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="benchmark_config.json",
        help="Path to benchmark config JSON (default: benchmark_config.json)",
    )
    parser.add_argument(
        "--only",
        type=str,
        default=None,
        help="Run only this one model tag (for quick testing)",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Delete each model after benchmarking IF it was not already installed before the run started",
    )

    args = parser.parse_args()

    # Resolve config path against cwd or script directory
    config_file = Path(args.config)
    if not config_file.exists():
        fallback = SCRIPT_DIR / args.config
        if fallback.exists():
            config_file = fallback
        else:
            print(f"Error: Config file not found at '{args.config}' or '{fallback}'")
            sys.exit(1)

    run_benchmark(config_path=config_file, only_model=args.only, cleanup=args.cleanup)


if __name__ == "__main__":
    main()
