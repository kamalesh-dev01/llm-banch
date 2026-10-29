"""
Unit tests for UI-4 Catalog Filters, Advanced Model Search, and Leaderboard.
Uses in-memory SQLite fixture.
"""
from datetime import datetime, timedelta, timezone
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from models import BenchmarkResult, Model, ModelQuant
from utils_time import utcnow
from main import app

# In-memory SQLite for testing
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_catalog_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    def override_get_db():
        s = TestingSessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db

    # Clear tables
    db.query(BenchmarkResult).delete()
    db.query(ModelQuant).delete()
    db.query(Model).delete()

    now = utcnow()

    # Model 1: Llama 3.2 3B
    m1 = Model(
        id=1,
        name="Llama 3.2 3B",
        ollama_tag="llama3.2:3b",
        family="llama",
        params_b=3.2,
        context_length=128000,
        licence="llama3.2",
        tasks='["chat", "coding"]',
        description="Meta small model",
        quality_score=0.75,
        downloads_last_month=60000,
        likes=1500,
        publisher="Meta Llama",
        tagline="Llama 3.2 lightweight multimodal model.",
        capabilities='["tools"]',
        released_at=now - timedelta(days=30),
        quality_source="size_estimate",
    )
    # Model 2: Qwen 2.5 7B
    m2 = Model(
        id=2,
        name="Qwen 2.5 7B",
        ollama_tag="qwen2.5:7b",
        family="qwen",
        params_b=7.0,
        context_length=32768,
        licence="Apache 2.0",
        tasks='["coding", "reasoning"]',
        description="Alibaba flagship coding model",
        quality_score=0.88,
        downloads_last_month=95000,
        likes=2800,
        publisher="Qwen",
        tagline="Qwen2.5 open foundation model.",
        capabilities='["tools", "thinking"]',
        released_at=now - timedelta(days=10),
        quality_source="size_estimate",
    )
    # Model 3: LLaVA 7B (Vision)
    m3 = Model(
        id=3,
        name="LLaVA 7B",
        ollama_tag="llava:7b",
        family="llava",
        params_b=7.1,
        context_length=8192,
        licence="Apache 2.0",
        tasks='["vision", "chat"]',
        description="Multimodal visual assistant",
        quality_score=0.70,
        downloads_last_month=25000,
        likes=800,
        publisher="Haotian Liu",
        tagline="Visual instruction tuning for multimodal AI.",
        capabilities='["vision"]',
        released_at=now - timedelta(days=90),
        quality_source="size_estimate",
    )

    db.add_all([m1, m2, m3])
    db.commit()

    # Quants
    q1 = ModelQuant(
        id=1, model_id=1, quant="Q4_K_M", size_gb=2.0, min_vram_gb=2.5,
        rec_vram_gb=3.5, min_ram_gb=8.0, rec_ram_gb=16.0,
        est_tps_low=35.0, est_tps_mid=50.0, est_tps_cpu=10.0,
        ollama_url="url", hf_url="url", gguf_url="url"
    )
    q2 = ModelQuant(
        id=2, model_id=2, quant="Q4_K_M", size_gb=4.4, min_vram_gb=5.0,
        rec_vram_gb=6.5, min_ram_gb=16.0, rec_ram_gb=32.0,
        est_tps_low=20.0, est_tps_mid=30.0, est_tps_cpu=5.0,
        ollama_url="url", hf_url="url", gguf_url="url"
    )
    q3 = ModelQuant(
        id=3, model_id=3, quant="Q4_K_M", size_gb=4.5, min_vram_gb=5.5,
        rec_vram_gb=7.0, min_ram_gb=16.0, rec_ram_gb=32.0,
        est_tps_low=18.0, est_tps_mid=26.0, est_tps_cpu=4.0,
        ollama_url="url", hf_url="url", gguf_url="url"
    )
    db.add_all([q1, q2, q3])
    db.commit()

    # Measured benchmark result for m2
    b1 = BenchmarkResult(
        id=1,
        model_id=2,
        machine_label="desktop-rtx4090",
        gpu_name="NVIDIA GeForce RTX 4090",
        vram_gb=24.0,
        ram_gb=64.0,
        quant="Q4_K_M",
        tokens_per_sec=74.5,
        ttft_ms=120,
        offload_fraction=1.0,
        peak_vram_gb=5.2,
        source="measured",
        measured_at=now - timedelta(days=2),
        ac_plugged=True,
        n_runs=5,
    )
    db.add(b1)
    db.commit()

    yield db
    db.close()


def test_get_filters_endpoint():
    client = TestClient(app)
    resp = client.get("/api/filters")
    assert resp.status_code == 200
    data = resp.json()

    assert "families" in data
    assert "tasks" in data
    assert "capabilities" in data
    assert "licenses" in data
    assert "params" in data
    assert "vram" in data

    # Verify families
    fam_values = [f["value"] for f in data["families"]]
    assert "llama" in fam_values
    assert "qwen" in fam_values
    assert "llava" in fam_values

    # Verify tasks with counts
    task_map = {t["value"]: t["count"] for t in data["tasks"]}
    assert task_map.get("coding") == 2
    assert task_map.get("chat") == 2
    assert task_map.get("vision") == 1

    # Verify capabilities
    assert "tools" in data["capabilities"]
    assert "vision" in data["capabilities"]
    assert "thinking" in data["capabilities"]

    # Verify licenses
    assert "Apache 2.0" in data["licenses"]
    assert "llama3.2" in data["licenses"]

    # Verify ranges
    assert data["params"]["min"] <= 3.2
    assert data["params"]["max"] >= 7.1
    assert data["vram"]["min"] <= 2.5
    assert data["vram"]["max"] >= 5.5


def test_list_models_fields():
    client = TestClient(app)
    resp = client.get("/api/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 3

    m = models[0]
    # Check all UI-4 required fields on list item
    assert "tagline" in m
    assert "capabilities" in m
    assert "publisher" in m
    assert "released_at" in m
    assert "quality_score" in m
    assert "min_vram" in m
    assert "quality_source" in m
    assert "quality_n" in m
    assert "quality_ci" in m


def test_list_models_filters():
    client = TestClient(app)

    # Filter by capability
    r = client.get("/api/models?capability=vision")
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["name"] == "LLaVA 7B"

    # Filter by license
    r = client.get("/api/models?license=Apache 2.0")
    assert r.status_code == 200
    assert len(r.json()) == 2

    # Filter by min_params and max_params
    r = client.get("/api/models?min_params=4.0&max_params=8.0")
    assert r.status_code == 200
    assert len(r.json()) == 2

    # Filter by max_vram
    r = client.get("/api/models?max_vram=3.0")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Llama 3.2 3B"


def test_list_models_sorting():
    client = TestClient(app)

    # Sort by quality (default)
    r = client.get("/api/models?sort=quality")
    names = [m["name"] for m in r.json()]
    assert names[0] == "Qwen 2.5 7B"  # 0.88 > 0.75 > 0.70

    # Sort by downloads
    r = client.get("/api/models?sort=downloads")
    names = [m["name"] for m in r.json()]
    assert names[0] == "Qwen 2.5 7B"  # 95k > 60k > 25k

    # Sort by params_asc
    r = client.get("/api/models?sort=params_asc")
    names = [m["name"] for m in r.json()]
    assert names[0] == "Llama 3.2 3B"  # 3.2 < 7.0 < 7.1

    # Sort by params_desc
    r = client.get("/api/models?sort=params_desc")
    names = [m["name"] for m in r.json()]
    assert names[0] == "LLaVA 7B"  # 7.1 > 7.0 > 3.2

    # Sort by newest
    r = client.get("/api/models?sort=newest")
    names = [m["name"] for m in r.json()]
    assert names[0] == "Qwen 2.5 7B"  # released 10 days ago vs 30 vs 90


def test_leaderboard_measured_speed():
    client = TestClient(app)

    # Speed tab: must only return measured rows with GPU and date (tests 1-row podium)
    r = client.get("/api/leaderboard?metric=speed")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    top = items[0]
    assert top["name"] == "Qwen 2.5 7B"
    assert top["gpu_name"] == "NVIDIA GeForce RTX 4090"
    assert top["metric_value"] == 74.5
    assert top["measured_at"] is not None

    # Quality tab: when quality_source == 'size_estimate', returns []
    r_qual = client.get("/api/leaderboard?metric=quality")
    assert r_qual.status_code == 200
    assert r_qual.json() == []

    # Efficiency tab: when quality_source == 'size_estimate', returns []
    r_eff = client.get("/api/leaderboard?metric=efficiency")
    assert r_eff.status_code == 200
    assert r_eff.json() == []

    # If real quality evaluations exist (quality_source != 'size_estimate')
    db = TestingSessionLocal()
    m2 = db.query(Model).filter(Model.id == 2).first()
    m2.quality_source = "model_card"
    m2.quality_n = 50
    m2.quality_ci = 0.02
    db.commit()

    r_qual_real = client.get("/api/leaderboard?metric=quality")
    assert r_qual_real.status_code == 200
    real_items = r_qual_real.json()
    assert len(real_items) == 1
    assert real_items[0]["name"] == "Qwen 2.5 7B"
    assert real_items[0]["quality_source"] == "model_card"
    assert real_items[0]["quality_n"] == 50
    assert real_items[0]["quality_ci"] == 0.02
