# LLM Bench

**Find the right local LLM for your hardware.**

LLM Bench is a platform that helps you choose, evaluate, and monitor
local large language models based on your actual hardware — not
generic cloud benchmarks.

## What it does

- Browse 20+ local LLM models with real hardware requirements
- Download a lightweight scanner that detects your GPU and RAM
- Get a compatibility verdict (Recommended / Minimum /
  Not Recommended) for every model and quantization
- See a real-time overlay showing GPU%, VRAM, tokens/sec
  while a model is running

## Tech stack

| Layer | Technology |
|-------|-----------|
| Website | React + Vite + TailwindCSS |
| Backend | FastAPI + SQLAlchemy |
| Database | Supabase PostgreSQL |
| Scanner | Python + PyInstaller |
| Overlay | Tauri + React + Python sidecar |

## Project structure

llm-bench/
├── backend/      FastAPI backend + database
├── frontend/     React website
├── scanner/      Hardware scanner EXE
├── overlay/      Tauri overlay app
└── scraper/      Data pipeline

## Running locally

### Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000

### Frontend
cd frontend
npm install
npm run dev

### Scanner
cd scanner
pip install -r requirements.txt
python test_scanner.py
build.bat

### Overlay
cd overlay
npm install
npm run tauri dev

## API

Base URL: http://localhost:8000
Docs: http://localhost:8000/docs

Key endpoints:
GET  /api/models              Browse all models
GET  /api/models/{id}         Model detail with quants
POST /api/hardware-scan       Submit hardware scan
GET  /api/verdict/{id}        Compatibility verdict
GET  /api/recommend           Recommended models for your hardware
GET  /api/leaderboard         Rankings by quality/speed/efficiency
GET  /api/scanner/download    Download the scanner EXE