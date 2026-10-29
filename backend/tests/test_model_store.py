"""
Unit tests for the UI-3 Store-Style Model Page API endpoints.
Tests with in-memory SQLite database:
- GET /api/models/{ref} (by ID, by exact tag, by tag with colon)
- GET /api/models/{id}/benchmarks (real measured rows only)
- GET /api/models/{id}/requirements (minimum & recommended rules, standalone & with scan token)
- GET /api/models/{id}/similar (same family first, overlapping tasks, limit)
"""
from datetime import datetime, timedelta
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from models import BenchmarkResult, HardwareSession, Model, ModelQuant
from utils_time import utcnow
from main import app

# SQLite in-memory DB
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_store_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Seed 3 models
    # 1. Llama 3.2 3B
    m1 = Model(
        id=1,
        name="Llama 3.2 3B",
        ollama_tag="llama3.2",
        family="llama",
        params_b=3.0,
        context_length=128000,
        licence="llama3.2",
        tasks='["chat", "coding"]',
        description="Meta lightweight 3B model",
        quality_score=0.78,
        downloads_last_month=50000,
        likes=1200,
        publisher="meta-llama",
        tagline="Meta's Llama 3.2 goes small with 1B and 3B models.",
        about="Llama 3.2 collection of multilingual large language models.",
        capabilities='["tools"]',
        languages='["en", "de", "fr", "it", "pt", "hi", "es", "th"]',
        released_at=utcnow() - timedelta(days=60),
        hf_updated_at=utcnow() - timedelta(days=10),
        hf_url="https://huggingface.co/meta-llama/Llama-3.2-3B",
        ollama_library_url="https://ollama.com/library/llama3.2",
    )

    # 2. Llama 3.1 8B (same family)
    m2 = Model(
        id=2,
        name="Llama 3.1 8B",
        ollama_tag="llama3.1",
        family="llama",
        params_b=8.0,
        context_length=128000,
        licence="llama3.1",
        tasks='["general", "reasoning"]',
        description="Meta 8B flagship model",
        quality_score=0.85,
        downloads_last_month=90000,
        likes=3400,
        publisher="meta-llama",
        tagline="The Meta Llama 3.1 collection of multilingual models.",
        about="Llama 3.1 is an open-source instruction-tuned model.",
        capabilities='["tools"]',
        languages='["en"]',
    )

    # 3. Qwen 2.5 7B (different family, overlapping task: coding)
    m3 = Model(
        id=3,
        name="Qwen 2.5 7B",
        ollama_tag="qwen2.5",
        family="qwen",
        params_b=7.0,
        context_length=32768,
        licence="apache-2.0",
        tasks='["chat", "coding"]',
        description="Alibaba flagship 7B model",
        quality_score=0.88,
        downloads_last_month=80000,
        likes=2800,
        publisher="Qwen",
        tagline="Qwen2.5 is the latest series of Qwen large language models.",
        about="Qwen2.5 brings significant improvements in coding and reasoning.",
        capabilities='["tools"]',
        languages='["en", "zh"]',
    )

    db.add_all([m1, m2, m3])
    db.commit()

    # Seed quants for Llama 3.2
    q1_q4 = ModelQuant(
        model_id=1,
        quant="Q4_K_M",
        size_gb=2.0,
        min_vram_gb=2.5,
        rec_vram_gb=4.0,
        min_ram_gb=4.0,
        rec_ram_gb=8.0,
        est_tps_low=20.0,
        est_tps_mid=40.0,
        est_tps_cpu=5.0,
        ollama_url="ollama run llama3.2",
        hf_url="https://huggingface.co/meta-llama/Llama-3.2-3B",
        gguf_url="https://huggingface.co/meta-llama/Llama-3.2-3B-GGUF",
    )
    q1_q8 = ModelQuant(
        model_id=1,
        quant="Q8_0",
        size_gb=3.3,
        min_vram_gb=4.0,
        rec_vram_gb=6.0,
        min_ram_gb=8.0,
        rec_ram_gb=16.0,
        est_tps_low=15.0,
        est_tps_mid=30.0,
        est_tps_cpu=3.0,
        ollama_url="ollama run llama3.2:3b-q8_0",
        hf_url="https://huggingface.co/meta-llama/Llama-3.2-3B",
        gguf_url="https://huggingface.co/meta-llama/Llama-3.2-3B-GGUF",
    )

    # Seed quant for Qwen
    q3_q4 = ModelQuant(
        model_id=3,
        quant="Q4_K_M",
        size_gb=4.7,
        min_vram_gb=5.5,
        rec_vram_gb=8.0,
        min_ram_gb=8.0,
        rec_ram_gb=16.0,
        est_tps_low=10.0,
        est_tps_mid=25.0,
        est_tps_cpu=2.0,
        ollama_url="ollama run qwen2.5",
        hf_url="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
        gguf_url="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF",
    )

    db.add_all([q1_q4, q1_q8, q3_q4])
    db.commit()

    # Seed real benchmark measurement for Model 1
    bench1 = BenchmarkResult(
        model_id=1,
        machine_label="laptop-rtx2050",
        gpu_name="NVIDIA GeForce RTX 2050",
        vram_gb=4.0,
        ram_gb=11.8,
        quant="Q4_K_M",
        tokens_per_sec=36.3,
        ttft_ms=283,
        offload_fraction=0.802,
        peak_vram_gb=3.14,
        source="measured",
        measured_at=utcnow(),
        ac_plugged=True,
        n_runs=4,
    )
    db.add(bench1)
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def test_get_model_by_numeric_id():
    res = client.get("/api/models/1")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert data["name"] == "Llama 3.2 3B"
    assert data["publisher"] == "meta-llama"
    assert data["tagline"] == "Meta's Llama 3.2 goes small with 1B and 3B models."
    assert "tools" in data["capabilities"]
    assert len(data["quants"]) == 2


def test_get_model_by_exact_tag():
    res = client.get("/api/models/llama3.2")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert data["name"] == "Llama 3.2 3B"


def test_get_model_by_tag_with_size_suffix():
    res = client.get("/api/models/llama3.2:3b")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert data["name"] == "Llama 3.2 3B"


def test_get_model_unknown_404():
    res = client.get("/api/models/non_existent_model_xyz")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_model_benchmarks_real_measured():
    res = client.get("/api/models/1/benchmarks")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    bench = data[0]
    assert bench["machine_label"] == "laptop-rtx2050"
    assert bench["gpu_name"] == "NVIDIA GeForce RTX 2050"
    assert bench["tokens_per_sec"] == 36.3
    assert bench["ttft_ms"] == 283
    assert bench["offload_fraction"] == 0.802
    assert bench["source"] == "measured"
    assert bench["n_runs"] == 4

    # Empty state for model without benchmarks
    res_empty = client.get("/api/models/2/benchmarks")
    assert res_empty.status_code == 200
    assert res_empty.json() == []


def test_get_model_requirements_standalone():
    res = client.get("/api/models/1/requirements?quant=Q4_K_M")
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == 1
    assert data["quant"] == "Q4_K_M"
    assert "rows" in data
    rows = {r["key"]: r for r in data["rows"]}

    assert "vram" in rows
    assert "ram" in rows
    assert "disk" in rows
    assert "cpu" in rows
    assert "os" in rows

    # Verify minimum and recommended values exist
    assert "GB" in rows["vram"]["minimum"]
    assert "GB" in rows["vram"]["recommended"]
    assert "cores" in rows["cpu"]["minimum"]


def test_get_model_requirements_with_hardware_scan(setup_store_db):
    db = setup_store_db
    now = utcnow()
    session = HardwareSession(
        token="test_req_scan_tok",
        status="complete",
        gpu_name="NVIDIA GeForce RTX 2050",
        vram_gb=4.0,
        ram_gb=11.8,
        cpu_name="Intel Core i5-12450HX",
        cpu_cores=8,
        os="Windows 11",
        disk_total_gb=500.0,
        disk_free_gb=150.0,
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    res = client.get("/api/models/1/requirements?quant=Q4_K_M&token=test_req_scan_tok")
    assert res.status_code == 200
    data = res.json()

    rows = {r["key"]: r for r in data["rows"]}
    # 'you_have' column is populated when scan token is provided
    assert rows["vram"]["you_have"] is not None
    assert "4.0 GB" in rows["vram"]["you_have"]
    assert rows["vram"]["status"] in ("ok", "warn", "fail")
    assert rows["cpu"]["you_have"] is not None


def test_get_similar_models_same_family_priority():
    # Model 1 is family "llama" and tasks ["chat", "coding"]
    # Model 2 is family "llama" and tasks ["general", "reasoning"]
    # Model 3 is family "qwen" and tasks ["chat", "coding"]
    res = client.get("/api/models/1/similar?limit=2")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2

    # Model 2 shares the same family ("llama"), so it must come first!
    assert data[0]["id"] == 2
    assert data[0]["family"] == "llama"

    # Model 3 comes second because of overlapping tasks ("chat", "coding")
    assert data[1]["id"] == 3
