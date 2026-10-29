"""
CI helper script to patch URLs, compile the standalone Windows scanner EXE,
compute SHA-256 and size, and generate release notes.
"""
import os
import sys
import re
import hashlib
import subprocess
import argparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def patch_scanner_constants(scanner_core_path: str, backend_url: str, site_url: str):
    """Patches the default BACKEND_URL and SITE_URL constants in scanner_core.py."""
    with open(scanner_core_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace BACKEND_URL default
    content = re.sub(
        r'BACKEND_URL\s*=\s*os\.environ\.get\("LLMBENCH_BACKEND",\s*"[^"]+"\)',
        f'BACKEND_URL = os.environ.get("LLMBENCH_BACKEND", "{backend_url}")',
        content
    )
    # Replace SITE_URL default
    content = re.sub(
        r'SITE_URL\s*=\s*os\.environ\.get\("LLMBENCH_SITE",\s*"[^"]+"\)',
        f'SITE_URL = os.environ.get("LLMBENCH_SITE", "{site_url}")',
        content
    )

    with open(scanner_core_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[CI BUILD] Successfully patched scanner_core.py:")
    print(f"  - BACKEND_URL: {backend_url}")
    print(f"  - SITE_URL   : {site_url}")


def compute_file_hash_and_size(file_path: str) -> tuple[str, float]:
    """Computes SHA-256 hex digest and size in MB."""
    stat = os.stat(file_path)
    size_mb = round(stat.st_size / (1024 * 1024), 2)
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest(), size_mb


def main():
    parser = argparse.ArgumentParser(description="Build and package LLM Bench Scanner for CI release")
    parser.add_argument("--backend-url", default=os.getenv("PRODUCTION_BACKEND_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--site-url", default=os.getenv("PRODUCTION_SITE_URL", "http://localhost:5173"))
    parser.add_argument("--output-notes", default="scanner_release_notes.md")
    parser.add_argument("--skip-build", action="store_true", help="Skip PyInstaller compilation (hash existing binary)")
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scanner_dir = os.path.join(repo_root, "scanner")
    core_file = os.path.join(scanner_dir, "scanner_core.py")
    dist_file = os.path.join(scanner_dir, "dist", "LLMBench-Scanner.exe")

    # 1. Patch Constants
    patch_scanner_constants(core_file, args.backend_url, args.site_url)

    # 2. Build with PyInstaller
    if not args.skip_build:
        print("[CI BUILD] Executing PyInstaller with build.bat flags...")
        build_cmd = [
            sys.executable, "-m", "PyInstaller",
            "--onefile",
            "--noconsole",
            "--name", "LLMBench-Scanner",
            "--icon", os.path.join("assets", "icon.ico"),
            "--version-file", "version_info.txt",
            "--collect-all", "customtkinter",
            "scanner_gui.py"
        ]
        ret = subprocess.call(build_cmd, cwd=scanner_dir)
        if ret != 0:
            print(f"[CI BUILD ERROR] PyInstaller failed with exit code {ret}")
            sys.exit(ret)

    if not os.path.exists(dist_file):
        print(f"[CI BUILD ERROR] Dist executable not found at: {dist_file}")
        sys.exit(1)

    # 3. Compute SHA-256 and Size
    sha256_hash, size_mb = compute_file_hash_and_size(dist_file)
    print("\n" + "=" * 60)
    print("SCANNER RELEASE ARTIFACT COMPILED")
    print("=" * 60)
    print(f"Path   : {dist_file}")
    print(f"Size   : {size_mb} MB")
    print(f"SHA-256: {sha256_hash}")
    print("=" * 60 + "\n")

    # 4. Generate Release Notes
    release_notes = f"""# LLM Bench Hardware Scanner Release

Windows native standalone hardware diagnostic utility for local LLM capability scoring.

## Release Artifact Specs
- **Filename**: `LLMBench-Scanner.exe`
- **File Size**: `{size_mb} MB`
- **SHA-256 Checksum**: `{sha256_hash}`
- **Backend Endpoint**: `{args.backend_url}`
- **Web App Endpoint**: `{args.site_url}`

## Verification
You can verify the downloaded binary integrity in Windows PowerShell:
```powershell
Get-FileHash -Algorithm SHA256 .\\LLMBench-Scanner.exe
```
Expected hash: `{sha256_hash}`
"""

    if args.output_notes:
        with open(args.output_notes, "w", encoding="utf-8") as f:
            f.write(release_notes)
        print(f"Saved release notes to: {args.output_notes}")

    # Set GITHUB_OUTPUT if running in GitHub Actions
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"scanner_sha256={sha256_hash}\n")
            f.write(f"scanner_size_mb={size_mb}\n")
            f.write(f"scanner_path={dist_file}\n")

    # Append to GITHUB_STEP_SUMMARY
    github_summary = os.getenv("GITHUB_STEP_SUMMARY")
    if github_summary:
        with open(github_summary, "a", encoding="utf-8") as f:
            f.write("\n" + release_notes + "\n")

if __name__ == "__main__":
    main()
