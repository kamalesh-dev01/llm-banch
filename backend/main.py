"""
This is the main entry point for the FastAPI backend.
It sets up the app, configures CORS, creates database tables, and registers routers.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager

# Ensure backend directory is in sys.path so modules resolve whether executed from root or backend/
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import Model, ModelQuant
from routers import models_router, hardware, recommend, benchmark, results_router

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager to handle startup and shutdown events.
    Creates all database tables in Supabase automatically on startup.
    """
    logger.info("Starting up LLM Bench API...")
    # Create all tables in the database if they don't exist
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")

    # Verify expected production migration columns exist
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        expected_schema = {
            "hardware_sessions": ["status", "expires_at", "vram_source"],
            "models": [
                "tagline", "about", "publisher", "released_at",
                "hf_updated_at", "languages", "capabilities", "hf_tags",
                "hf_url", "ollama_library_url", "enriched_at", "enriched_from",
                "quality_source", "quality_n", "quality_ci"
            ],
            "benchmark_results": [
                "machine_label", "ram_gb", "offload_fraction",
                "peak_vram_gb", "measured_at", "ac_plugged", "n_runs"
            ]
        }
        tables = inspector.get_table_names()
        for table, expected_cols in expected_schema.items():
            if table in tables:
                existing_cols = {c["name"] for c in inspector.get_columns(table)}
                missing = [col for col in expected_cols if col not in existing_cols]
                if missing:
                    logger.warning(
                        f"[SCHEMA WARNING] Table '{table}' is missing expected columns: {missing}. "
                        "Run migrations in order against DATABASE_URL: "
                        "1) migrate_scan_sessions.py, 2) migrate_model_fields.py, 3) migrate_quality_source.py"
                    )
    except Exception as e:
        logger.warning(f"Could not verify database schema columns on startup: {e}")

    yield
    logger.info("Shutting down LLM Bench API...")

# Initialize FastAPI app
app = FastAPI(
    title="LLM Bench API",
    version="1.0.0",
    description="Local LLM benchmarking and hardware compatibility platform",
    lifespan=lifespan
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open for development
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(models_router.router, prefix="/api", tags=["models"])
app.include_router(hardware.router, prefix="/api", tags=["hardware"])
app.include_router(results_router.router, prefix="/api", tags=["results"])
app.include_router(recommend.router, prefix="/api", tags=["recommend"])
app.include_router(benchmark.router, prefix="/api", tags=["benchmark"])

@app.get("/api/health", tags=["health"])
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint to verify the API is running and database is connected.
    
    Returns:
        dict: Status information.
    """
    model_count = db.query(Model).count()
    quant_count = db.query(ModelQuant).count()
    return {
        "status": "ok",
        "message": "LLM Bench API running",
        "database": "connected",
        "models": model_count,
        "quants": quant_count,
        "version": "1.0.0"
    }
