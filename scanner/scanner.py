"""
LLM Bench Hardware Scanner
Scans hardware, sends to backend, copies token, opens website, and self-deletes.
"""

import sys
import os
import subprocess
import tempfile
import time
import requests
import psutil

BACKEND_URL = os.environ.get("LLMBENCH_BACKEND", "https://llm-banch.onrender.com")
WEBSITE_URL = os.environ.get("LLMBENCH_SITE", "https://llm-banch.vercel.app")

def get_gpu_info() -> dict:
    """
    Gets GPU name and VRAM using pynvml.
    Falls back to generic values if pynvml fails (AMD GPU or no GPU).
    Returns: {"gpu_name": str, "vram_gb": float}
    """
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        gpu_name = pynvml.nvmlDeviceGetName(handle)
        
        # nvmlDeviceGetName returns bytes in older versions, str in newer
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode("utf-8")
            
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        vram_gb = round(mem_info.total / (1024**3), 1)
        pynvml.nvmlShutdown()
        
        return {"gpu_name": gpu_name, "vram_gb": vram_gb}
    except Exception:
        return {"gpu_name": "Unknown GPU", "vram_gb": 0.0}

def get_system_info() -> dict:
    """
    Gets RAM, CPU name, CPU cores, and OS using psutil and platform.
    Returns: {"ram_gb": float, "cpu_name": str, "cpu_cores": int, "os": str}
    """
    ram_gb = round(psutil.virtual_memory().total / (1024**3), 1)
    cpu_cores = psutil.cpu_count(logical=False) or psutil.cpu_count()
    
    # Get CPU name from platform
    try:
        import platform
        cpu_name = platform.processor()
        if not cpu_name:
            cpu_name = "Unknown CPU"
    except Exception:
        cpu_name = "Unknown CPU"
        
    # Get OS name
    try:
        import platform
        os_name = f"{platform.system()} {platform.release()}"
    except Exception:
        os_name = "Unknown OS"
        
    # Get available disk space on C: drive
    try:
        disk = psutil.disk_usage('C:\\')
        disk_total_gb = round(disk.total / (1024**3), 1)
        disk_free_gb = round(disk.free / (1024**3), 1)
    except:
        disk_total_gb = 0.0
        disk_free_gb = 0.0
        
    return {
        "ram_gb": ram_gb,
        "cpu_name": cpu_name,
        "cpu_cores": cpu_cores,
        "os": os_name,
        "disk_total_gb": disk_total_gb,
        "disk_free_gb": disk_free_gb
    }

def send_to_backend(hardware_data: dict) -> str | None:
    """
    POSTs hardware data to the backend.
    Returns the session token string, or None if it fails.
    """
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/hardware-scan",
            json=hardware_data,
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("token")
        else:
            print(f"Backend error: {response.status_code}")
            return None
    except requests.exceptions.ConnectionError:
        print("Could not connect to backend. Make sure the server is running.")
        return None
    except Exception as e:
        print(f"Error sending data: {e}")
        return None

def open_website_with_token(token: str):
    """Opens the website in the default browser with the token as a URL param."""
    import webbrowser
    url = f"{WEBSITE_URL}/scan-result?token={token}"
    webbrowser.open(url)

def copy_to_clipboard(text: str):
    """Copies text to clipboard using pyperclip."""
    try:
        import pyperclip
        pyperclip.copy(text)
        return True
    except Exception:
        return False

def self_delete():
    """
    Schedules deletion of the running executable after a short delay.
    Uses a bat script on Windows to delete the exe after the process exits.
    """
    # Get the path to the current executable
    exe_path = sys.executable
    
    # If running as a PyInstaller bundle, sys.executable is the exe
    # If running as a .py script directly, skip deletion
    if not exe_path.endswith(".exe"):
        print("(Running as .py — skipping self-delete)")
        return
        
    # Write a temp bat file that waits 2 seconds then deletes the exe
    bat_content = f"""
@echo off
timeout /t 2 /nobreak > nul
del /f /q "{exe_path}"
del /f /q "%~f0"
"""
    
    # Write bat to temp directory
    bat_path = os.path.join(tempfile.gettempdir(), "llmbench_cleanup.bat")
    with open(bat_path, "w") as f:
        f.write(bat_content)
        
    # Run the bat file detached (independent of this process)
    subprocess.Popen(
        bat_path,
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW
    )

def main():
    """Main execution flow for the hardware scanner."""
    print("=" * 50)
    print("  LLM Bench Hardware Scanner")
    print("=" * 50)
    print()
    
    # Step 1: Scan hardware
    print("Scanning your hardware...")
    gpu_info = get_gpu_info()
    sys_info = get_system_info()
    
    hardware_data = {
        "gpu_name": gpu_info["gpu_name"],
        "vram_gb": gpu_info["vram_gb"],
        "ram_gb": sys_info["ram_gb"],
        "cpu_name": sys_info["cpu_name"],
        "cpu_cores": sys_info["cpu_cores"],
        "os": sys_info["os"],
        "disk_total_gb": sys_info["disk_total_gb"],
        "disk_free_gb": sys_info["disk_free_gb"]
    }
    
    # Print what was detected
    print(f"  GPU:  {hardware_data['gpu_name']} ({hardware_data['vram_gb']} GB VRAM)")
    print(f"  RAM:  {hardware_data['ram_gb']} GB")
    print(f"  CPU:  {hardware_data['cpu_name']} ({hardware_data['cpu_cores']} cores)")
    print(f"  OS:   {hardware_data['os']}")
    print(f"  Disk: {hardware_data['disk_free_gb']} GB free of {hardware_data['disk_total_gb']} GB total (C:\\)")
    print()
    
    # Step 2: Send to backend
    print("Sending to LLM Bench...")
    token = send_to_backend(hardware_data)
    
    if not token:
        print()
        print("❌ Could not connect to LLM Bench.")
        print("   Make sure the app is running at localhost:8000")
        print()
        input("Press Enter to exit...")
        return
        
    # Step 3: Open browser
    print(f"✅ Scan complete! Token: {token[:8]}...")
    print()
    open_website_with_token(token)
    
    # Step 4: Copy token to clipboard
    copied = copy_to_clipboard(token)
    if copied:
        print("✅ Token copied to clipboard!")
    else:
        print(f"   Your token: {token}")
        
    print()
    print("✅ Opening LLM Bench in your browser...")
    print("   Your hardware scan is ready to view.")
    print()
    
    # Short pause so user can read the output
    time.sleep(3)
    
    # Step 5: Self-delete
    self_delete()
    print("Scanner will clean up automatically. Goodbye!")

if __name__ == "__main__":
    main()
