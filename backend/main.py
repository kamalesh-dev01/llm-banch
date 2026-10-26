"""
This is the main entry point for the FastAPI backend.
It sets up the app, configures CORS, creates database tables, and registers routers.
"""

import logging
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import Model, ModelQuant
from routers import models_router, hardware, recommend, benchmark

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
