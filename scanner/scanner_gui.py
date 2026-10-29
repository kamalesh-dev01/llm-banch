"""
LLM Bench Hardware Scanner - GUI Application
Modern CustomTkinter desktop interface for hardware inspection.
Runs hardware detection in a background thread and communicates via Queue + after().
"""
import os
import sys
import time
import queue
import logging
import tempfile
import threading
import subprocess
import webbrowser
import customtkinter as ctk

import scanner_core

# Logger configuration
LOG_PATH = os.path.join(tempfile.gettempdir(), "llmbench-scanner.log")
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    encoding="utf-8"
)
logger = logging.getLogger("scanner_gui")

PRIMARY_COLOR = "#4F46E5"
PRIMARY_HOVER = "#4338CA"
SUCCESS_COLOR = "#059669"
TEXT_MUTED = ("#6B7280", "#9CA3AF")
BG_CARD = ("#F3F4F6", "#1F242D")

STEP_LABELS = [
    "Graphics card",
    "Memory",
    "Processor",
    "Storage",
    "Sending results"
]


def self_delete_if_needed():
    """
    Self-deletes the executable after closing ONLY when:
    - Running as a frozen PyInstaller binary
    - Exe filename starts with 'LLMBench-Scanner'
    - LLMBENCH_KEEP environment variable is not '1'
    """
    if os.environ.get("LLMBENCH_KEEP") == "1":
        logger.info("Self-deletion skipped because LLMBENCH_KEEP=1")
        return

    if not getattr(sys, "frozen", False):
        logger.info("Self-deletion skipped because process is not frozen executable.")
        return

    exe_path = sys.executable
    filename = os.path.basename(exe_path)
    if not filename.lower().startswith("llmbench-scanner"):
        logger.info("Self-deletion skipped because exe name '%s' does not start with 'LLMBench-Scanner'", filename)
        return

    logger.info("Triggering background self-deletion for %s", exe_path)
    # Windows detached flags
    CREATE_NO_WINDOW = 0x08000000
    DETACHED_PROCESS = 0x00000008
    flags = CREATE_NO_WINDOW | DETACHED_PROCESS
    cmd = f'cmd /c timeout /t 3 /nobreak > nul & del /f /q "{exe_path}"'
    try:
        subprocess.Popen(
            cmd,
            shell=True,
            creationflags=flags,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        logger.error("Failed to spawn self-delete command: %s", e)


class ScannerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Appearance mode follows Windows system light/dark
        ctk.set_appearance_mode("system")
        ctk.set_default_color_theme("blue")

        self.title("LLM Bench Scanner")
        self.resizable(False, False)

        # Center window 460x400
        window_width = 460
        window_height = 400
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        pos_x = max(0, (screen_width - window_width) // 2)
        pos_y = max(0, (screen_height - window_height) // 2)
        self.geometry(f"{window_width}x{window_height}+{pos_x}+{pos_y}")

        # Set Window Icon
        icon_path = os.path.join(os.path.dirname(__file__), "assets", "icon.ico")
        if os.path.exists(icon_path):
            try:
                self.iconbitmap(icon_path)
            except Exception as e:
                logger.warning("Could not set icon: %s", e)

        # State
        self.msg_queue = queue.Queue()
        self.token = scanner_core.parse_token()
        self.hw_data = {}
        self.last_error = ""
        self.step_widgets = []
        self.auto_open_job = None

        self.protocol("WM_DELETE_WINDOW", self.on_close)

        self.init_ui()
        self.after(50, self.process_queue)
        self.start_scan_thread()

    def init_ui(self):
        # Main container with padding
        self.container = ctk.CTkFrame(self, fg_color="transparent")
        self.container.pack(fill="both", expand=True, padx=28, pady=20)

        # Header
        self.header_frame = ctk.CTkFrame(self.container, fg_color="transparent")
        self.header_frame.pack(fill="x", pady=(0, 14))

        self.title_label = ctk.CTkLabel(
            self.header_frame,
            text="Checking your PC",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold")
        )
        self.title_label.pack(anchor="w")

        self.subtitle_label = ctk.CTkLabel(
            self.header_frame,
            text="Inspecting GPU, memory, and CPU for local LLM suitability",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            text_color=TEXT_MUTED
        )
        self.subtitle_label.pack(anchor="w", pady=(2, 0))

        # Thin Progress Bar
        self.progress_bar = ctk.CTkProgressBar(
            self.container,
            height=4,
            corner_radius=2,
            progress_color=PRIMARY_COLOR
        )
        self.progress_bar.pack(fill="x", pady=(0, 18))
        self.progress_bar.set(0.05)

        # Steps Frame
        self.steps_container = ctk.CTkFrame(
            self.container,
            corner_radius=10,
            fg_color=BG_CARD
        )
        self.steps_container.pack(fill="both", expand=True, padx=0, pady=(0, 14))

        self.step_widgets = []
        for i, name in enumerate(STEP_LABELS):
            row = ctk.CTkFrame(self.steps_container, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=5)

            icon_lbl = ctk.CTkLabel(
                row,
                text="○",
                font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
                text_color=TEXT_MUTED,
                width=22
            )
            icon_lbl.pack(side="left", padx=(0, 8))

            text_lbl = ctk.CTkLabel(
                row,
                text=name,
                font=ctk.CTkFont(family="Segoe UI", size=13),
                anchor="w"
            )
            text_lbl.pack(side="left", fill="x", expand=True)

            self.step_widgets.append({"icon": icon_lbl, "text": text_lbl, "name": name})

        # Footer
        self.footer_label = ctk.CTkLabel(
            self.container,
            text="Only your graphics card, memory, processor and free disk space are read.\nNothing else leaves your PC.",
            font=ctk.CTkFont(family="Segoe UI", size=10),
            text_color=TEXT_MUTED,
            justify="center"
        )
        self.footer_label.pack(side="bottom", fill="x")

    def start_scan_thread(self):
        # Reset UI if retrying
        self.progress_bar.set(0.05)
        for w in self.step_widgets:
            w["icon"].configure(text="○", text_color=TEXT_MUTED)
            w["text"].configure(text=w["name"], text_color=("black", "white"))

        thread = threading.Thread(target=self.worker_scan, daemon=True)
        thread.start()

    def worker_scan(self):
        """Worker thread executing detection and posting to backend."""
        logger.info("Scanner worker thread started.")
        try:
            # Token resolution / creation
            if not self.token:
                logger.info("No token detected; creating session via fallback flow...")
                self.token = scanner_core.create_session()

            # Step 1: Graphics card
            self.msg_queue.put({"type": "step_active", "step": 0})
            t0 = time.time()
            gpu_info = scanner_core.detect_gpu()
            self.hw_data.update(gpu_info)
            time.sleep(max(0.0, 0.6 - (time.time() - t0)))
            desc = f"Graphics card: {gpu_info.get('gpu_name', 'Unknown')}"
            if gpu_info.get("vram_gb", 0) > 0:
                desc += f" ({gpu_info['vram_gb']} GB)"
            self.msg_queue.put({"type": "step_done", "step": 0, "desc": desc, "progress": 0.25})

            # Step 2: Memory
            self.msg_queue.put({"type": "step_active", "step": 1})
            t0 = time.time()
            ram_info = scanner_core.detect_ram()
            self.hw_data.update(ram_info)
            time.sleep(max(0.0, 0.6 - (time.time() - t0)))
            self.msg_queue.put({
                "type": "step_done",
                "step": 1,
                "desc": f"Memory: {ram_info.get('ram_gb', 0)} GB RAM",
                "progress": 0.45
            })

            # Step 3: Processor
            self.msg_queue.put({"type": "step_active", "step": 2})
            t0 = time.time()
            cpu_info = scanner_core.detect_cpu()
            os_info = scanner_core.detect_os()
            self.hw_data.update(cpu_info)
            self.hw_data.update(os_info)
            time.sleep(max(0.0, 0.6 - (time.time() - t0)))
            cpu_short = cpu_info.get("cpu_name", "Unknown CPU")
            if len(cpu_short) > 28:
                cpu_short = cpu_short[:25] + "..."
            self.msg_queue.put({
                "type": "step_done",
                "step": 2,
                "desc": f"Processor: {cpu_short} ({cpu_info.get('cpu_cores', 1)} cores)",
                "progress": 0.65
            })

            # Step 4: Storage
            self.msg_queue.put({"type": "step_active", "step": 3})
            t0 = time.time()
            disk_info = scanner_core.detect_disk()
            self.hw_data.update(disk_info)
            time.sleep(max(0.0, 0.6 - (time.time() - t0)))
            self.msg_queue.put({
                "type": "step_done",
                "step": 3,
                "desc": f"Storage: {disk_info.get('disk_free_gb', 0)} GB free",
                "progress": 0.85
            })

            # Step 5: Sending results
            self.msg_queue.put({"type": "step_active", "step": 4})
            t0 = time.time()
            scanner_core.send(self.hw_data, token=self.token)
            time.sleep(max(0.0, 0.6 - (time.time() - t0)))
            self.msg_queue.put({
                "type": "step_done",
                "step": 4,
                "desc": "Results sent successfully",
                "progress": 1.0
            })

            # Completed!
            self.msg_queue.put({"type": "scan_complete"})

        except Exception as e:
            logger.error("Scan error occurred: %s", e, exc_info=True)
            self.msg_queue.put({"type": "scan_error", "error": str(e)})

    def process_queue(self):
        """Processes messages from worker thread on the UI thread."""
        try:
            while not self.msg_queue.empty():
                msg = self.msg_queue.get_nowait()
                m_type = msg.get("type")

                if m_type == "step_active":
                    step_idx = msg["step"]
                    if step_idx < len(self.step_widgets):
                        self.step_widgets[step_idx]["icon"].configure(text="⟳", text_color=PRIMARY_COLOR)

                elif m_type == "step_done":
                    step_idx = msg["step"]
                    desc = msg["desc"]
                    prog = msg.get("progress", 0.0)
                    if step_idx < len(self.step_widgets):
                        self.step_widgets[step_idx]["icon"].configure(text="✓", text_color=SUCCESS_COLOR)
                        self.step_widgets[step_idx]["text"].configure(text=desc)
                    self.progress_bar.set(prog)

                elif m_type == "scan_complete":
                    self.show_done_state()

                elif m_type == "scan_error":
                    self.last_error = msg.get("error", "Unknown error")
                    self.show_error_state(self.last_error)

        finally:
            self.after(50, self.process_queue)

    def show_done_state(self):
        """Displays completion screen and schedules browser launch."""
        self.steps_container.pack_forget()
        self.progress_bar.pack_forget()
        self.subtitle_label.pack_forget()
        self.title_label.pack_forget()

        self.done_frame = ctk.CTkFrame(self.container, fg_color="transparent")
        self.done_frame.pack(fill="both", expand=True, pady=10)

        # Big Check
        check_icon = ctk.CTkLabel(
            self.done_frame,
            text="✓",
            font=ctk.CTkFont(family="Segoe UI", size=52, weight="bold"),
            text_color=SUCCESS_COLOR
        )
        check_icon.pack(pady=(12, 4))

        done_title = ctk.CTkLabel(
            self.done_frame,
            text="All done!",
            font=ctk.CTkFont(family="Segoe UI", size=22, weight="bold")
        )
        done_title.pack()

        done_sub = ctk.CTkLabel(
            self.done_frame,
            text="All done! Opening your results...",
            font=ctk.CTkFont(family="Segoe UI", size=13),
            text_color=TEXT_MUTED
        )
        done_sub.pack(pady=(4, 20))

        # Buttons
        btn_frame = ctk.CTkFrame(self.done_frame, fg_color="transparent")
        btn_frame.pack()

        open_btn = ctk.CTkButton(
            btn_frame,
            text="Open results",
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            fg_color=PRIMARY_COLOR,
            hover_color=PRIMARY_HOVER,
            width=140,
            height=36,
            corner_radius=8,
            command=self.open_results_url
        )
        open_btn.pack(side="left", padx=6)

        close_btn = ctk.CTkButton(
            btn_frame,
            text="Close",
            font=ctk.CTkFont(family="Segoe UI", size=13),
            fg_color=("gray85", "gray25"),
            hover_color=("gray75", "gray35"),
            text_color=("black", "white"),
            width=90,
            height=36,
            corner_radius=8,
            command=self.on_close
        )
        close_btn.pack(side="left", padx=6)

        # NOTE: Do NOT auto-open browser — the website's polling mechanism
        # already auto-navigates to the results page when the scan completes.
        # self.auto_open_job = self.after(1500, self.open_results_url)

    def show_error_state(self, error_message: str):
        """Displays friendly error state with retry and copy buttons."""
        self.steps_container.pack_forget()
        self.progress_bar.pack_forget()

        self.error_frame = ctk.CTkFrame(self.container, fg_color="transparent")
        self.error_frame.pack(fill="both", expand=True, pady=10)

        err_icon = ctk.CTkLabel(
            self.error_frame,
            text="✕",
            font=ctk.CTkFont(family="Segoe UI", size=44, weight="bold"),
            text_color="#DC2626"
        )
        err_icon.pack(pady=(10, 4))

        err_title = ctk.CTkLabel(
            self.error_frame,
            text="Couldn't send scan results",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold")
        )
        err_title.pack()

        err_sub = ctk.CTkLabel(
            self.error_frame,
            text="Make sure the LLM Bench server is reachable and try again.",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            text_color=TEXT_MUTED
        )
        err_sub.pack(pady=(4, 16))

        btn_frame = ctk.CTkFrame(self.error_frame, fg_color="transparent")
        btn_frame.pack()

        retry_btn = ctk.CTkButton(
            btn_frame,
            text="Try again",
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            fg_color=PRIMARY_COLOR,
            hover_color=PRIMARY_HOVER,
            width=120,
            height=36,
            corner_radius=8,
            command=self.on_retry
        )
        retry_btn.pack(side="left", padx=6)

        self.copy_btn = ctk.CTkButton(
            btn_frame,
            text="Copy details",
            font=ctk.CTkFont(family="Segoe UI", size=13),
            fg_color=("gray85", "gray25"),
            hover_color=("gray75", "gray35"),
            text_color=("black", "white"),
            width=120,
            height=36,
            corner_radius=8,
            command=self.copy_error_details
        )
        self.copy_btn.pack(side="left", padx=6)

    def copy_error_details(self):
        """Copies error traceback/details to clipboard."""
        self.clipboard_clear()
        details = f"LLM Bench Scanner Error:\nToken: {self.token}\nError: {self.last_error}"
        self.clipboard_append(details)
        self.copy_btn.configure(text="Copied!")
        self.after(2000, lambda: self.copy_btn.configure(text="Copy details"))

    def on_retry(self):
        """Restores UI and restarts worker thread."""
        if hasattr(self, "error_frame"):
            self.error_frame.destroy()
        self.progress_bar.pack(fill="x", pady=(0, 18), before=self.footer_label)
        self.steps_container.pack(fill="both", expand=True, padx=0, pady=(0, 14), before=self.footer_label)
        self.start_scan_thread()

    def open_results_url(self):
        """Opens results page in browser."""
        if self.auto_open_job:
            self.after_cancel(self.auto_open_job)
            self.auto_open_job = None
        target_url = f"{scanner_core.SITE_URL.rstrip('/')}/results/{self.token}"
        logger.info("Opening results URL: %s", target_url)
        try:
            webbrowser.open(target_url)
        except Exception as e:
            logger.error("Failed to open browser: %s", e)

    def on_close(self):
        """Handles window closing and invokes self-deletion if applicable."""
        if self.auto_open_job:
            self.after_cancel(self.auto_open_job)
            self.auto_open_job = None
        self.destroy()
        self_delete_if_needed()


if __name__ == "__main__":
    try:
        app = ScannerApp()
        app.mainloop()
    except KeyboardInterrupt:
        pass
