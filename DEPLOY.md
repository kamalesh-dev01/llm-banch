# LLM Bench — Production Deployment Guide

This guide describes how to deploy the LLM Bench full-stack application (FastAPI backend on Render/Railway, React/Vite frontend on Vercel/Cloudflare Pages, and prebuilt Windows Hardware Scanner assets on GitHub Releases).

---

## 1. Production Database Migrations

> [!WARNING]
> **NEVER run `seed.py` in CI or on Render.**
> `seed.py` drops and recreates all database tables. It is guarded and will immediately exit with status 1 unless `ALLOW_DROP=1` is explicitly set in the environment.

All production schema updates must be executed using the idempotent `migrate_*.py` scripts. Run once against the production `DATABASE_URL`:

```bash
# 1. Add session status, expiration, and VRAM provenance columns
python backend/migrate_scan_sessions.py

# 2. Add rich model metadata (taglines, capabilities, benchmarks table extensions)
python backend/migrate_model_fields.py

# 3. Add honest evaluation metadata (quality_source, quality_n, quality_ci)
python backend/migrate_quality_source.py
```

`main.py` inspects the active schema upon startup and will log a warning if any of these expected columns are missing.

---

## 2. Backend Deployment (Render / Docker)

### Environment Variables
Configure the following in the Render Dashboard under **Environment**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase / Render Postgres) | `postgresql://user:pass@host:5432/db` |
| `SCANNER_DOWNLOAD_URL` | Direct URL to the released Windows scanner `.exe` asset | `https://github.com/<org>/llmbench/releases/latest/download/LLMBench-Scanner.exe` |
| `SCANNER_SHA256` | SHA-256 hash of the release scanner executable | `<64-hex-chars>` |
| `SCANNER_SIZE_MB` | File size of the release scanner executable in MB | `14.2` |
| `PORT` | HTTP port assigned by Render | `8000` |

### Scanner Download in Production
When `SCANNER_DOWNLOAD_URL` is set:
- **With a valid pending token**: The backend downloads the scanner release asset once into its local temporary cache (e.g. `/tmp/llmbench-scanner.exe`) and streams it directly to the browser with `Content-Disposition: attachment; filename="LLMBench-Scanner-<token>.exe"`. This preserves the auto-token discovery mechanism when the scanner launches on the user's PC.
- **Without a token (generic download)**: The backend issues an HTTP 307 redirect directly to `SCANNER_DOWNLOAD_URL`.
- **Metadata `/api/scanner/info`**: Reads `size_mb` and `sha256` directly from the cached file, or falls back to `SCANNER_SHA256` and `SCANNER_SIZE_MB` from the environment if no file has been cached yet.

---

## 3. Frontend Deployment (Vercel / Cloudflare)

### Build Settings
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Environment Variables
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Production FastAPI backend URL | `https://api.llmbench.com` |
| `VITE_SITE_URL` | Production frontend website URL | `https://llmbench.com` |
| `VITE_ADSENSE_CLIENT` | *(Optional)* Google AdSense Publisher ID | `ca-pub-XXXXXXXXXXXXXXXX` |

---

## 4. Hardware Scanner Release Build (CI)

In GitHub Actions (`.github/workflows/ci.yml`), the scanner is compiled on `windows-latest` using PyInstaller with:

```bash
# 1. Patch production backend and site URLs into scanner/scanner_core.py
sed -i 's|http://127.0.0.1:8000|https://api.llmbench.com|g' scanner/scanner_core.py
sed -i 's|http://localhost:5173|https://llmbench.com|g' scanner/scanner_core.py

# 2. Build single-file GUI executable
pyinstaller --onefile --noconsole --name LLMBench-Scanner \
  --icon assets/icon.ico --version-file version_info.txt \
  --collect-all customtkinter scanner_gui.py

# 3. Compute release hash and size
certutil -hashfile dist/LLMBench-Scanner.exe SHA256
```

The resulting executable is published as an asset on GitHub Releases, and its SHA-256 and size in MB are documented in the release notes and configured on Render as `SCANNER_SHA256` and `SCANNER_SIZE_MB`.
