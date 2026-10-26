"""
LLM Bench hardware monitor sidecar.
Reads GPU, VRAM, RAM, CPU metrics every 500ms.
Prints one JSON line per reading to stdout.
Tauri reads this stdout stream and forwards to React.
"""

import sys
import json
import time
import psutil

def get_gpu_metrics() -> dict:
    """
    Gets GPU utilisation, VRAM, and temperature using pynvml.
    Returns zeros if GPU not available.
    """
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)

        name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode('utf-8')

        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        temp = pynvml.nvmlDeviceGetTemperature(
            handle, pynvml.NVML_TEMPERATURE_GPU
        )

        return {
            "gpu_name": name,
            "gpu_utilization": util.gpu,
            "vram_used_gb": round(mem.used / 1e9, 1),
            "vram_total_gb": round(mem.total / 1e9, 1),
            "gpu_temperature": temp
        }
    except Exception:
        return {
            "gpu_name": "Unknown GPU",
            "gpu_utilization": 0,
            "vram_used_gb": 0.0,
            "vram_total_gb": 0.0,
            "gpu_temperature": 0
        }

def get_ollama_metrics() -> dict:
    """
    Polls Ollama API to detect running model.
    Returns model name and placeholder tokens/sec.
    """
    try:
        import requests
        res = requests.get(
            "http://localhost:11434/api/tags",
            timeout=1
        )
        data = res.json()
        models = data.get("models", [])
        if models:
            return {
                "model_running": True,
                "model_name": models[0].get("name", "unknown"),
                "tokens_per_sec": 0.0,
                "ttft_ms": 0
            }
    except Exception:
        pass

    return {
        "model_running": False,
        "model_name": "",
        "tokens_per_sec": 0.0,
        "ttft_ms": 0
    }

def main():
    """
    Main loop: reads metrics every 500ms, prints JSON line to stdout.
    Stdout is captured by Tauri sidecar API.
    """
    while True:
        try:
            gpu = get_gpu_metrics()
            ram_used = round(
                psutil.virtual_memory().used / 1e9, 1
            )
            ram_total = round(
                psutil.virtual_memory().total / 1e9, 1
            )
            cpu = psutil.cpu_percent(interval=None)
            ollama = get_ollama_metrics()

            metrics = {
                **gpu,
                "ram_used_gb": ram_used,
                "ram_total_gb": ram_total,
                "cpu_utilization": cpu,
                **ollama
            }

            # Print one JSON line — Tauri reads this
            print(json.dumps(metrics), flush=True)

        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

        time.sleep(0.5)

if __name__ == "__main__":
    main()
