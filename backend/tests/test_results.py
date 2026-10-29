"""
Unit tests for the Results API (/api/results/{token}) and tier classification logic.
Uses SQLite in-memory temporary database.
"""
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from models import HardwareSession, Model, ModelQuant
from utils_time import utcnow
from main import app

# In-memory SQLite setup
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Seed models
    # 0. Tiny 0.5B Model (fits fully in GPU even on 4GB GPU with 1.85 GB reserve)
    m05b = Model(
        id=4,
        name="Qwen 2.5 0.5B",
        ollama_tag="qwen2.5:0.5b",
        family="qwen",
        params_b=0.5,
        context_length=32768,
        tasks='["chat"]',
        description="Alibaba ultra-lightweight 0.5B model",
        quality_score=0.60,
        downloads_last_month=10000,
    )
    # 1. Small 3B Model (Llama 3.2 3B)
    m3b = Model(
        id=1,
        name="Llama 3.2 3B",
        ollama_tag="llama3.2:3b",
        family="llama",
        params_b=3.0,
        context_length=128000,
        tasks='["chat", "coding"]',
        description="Meta lightweight 3B model",
        quality_score=0.75,
        downloads_last_month=15000,
    )
    # 2. 7B Model (Mistral 7B)
    m7b = Model(
        id=2,
        name="Mistral 7B",
        ollama_tag="mistral:7b",
        family="mistral",
        params_b=7.0,
        context_length=32768,
        tasks='["general", "reasoning"]',
        description="Mistral AI 7B foundation model",
        quality_score=0.82,
        downloads_last_month=25000,
    )
    # 3. 14B Model (Phi 4 14B)
    m14b = Model(
        id=3,
        name="Phi 4",
        ollama_tag="phi4",
        family="phi",
        params_b=14.0,
        context_length=16384,
        tasks='["coding", "math"]',
        description="Microsoft Phi 4 14B model",
        quality_score=0.89,
        downloads_last_month=30000,
    )

    db.add_all([m05b, m3b, m7b, m14b])
    db.commit()

    # Seed quants
    # 0.5B: Q4_K_M (0.4 GB)
    q05b = ModelQuant(
        model_id=4,
        quant="Q4_K_M",
        size_gb=0.4,
        min_vram_gb=1.0,
        rec_vram_gb=2.0,
        min_ram_gb=4.0,
        rec_ram_gb=8.0,
    )
    # 3B: Q4_K_M (1.8 GB)
    q3b = ModelQuant(
        model_id=1,
        quant="Q4_K_M",
        size_gb=1.8,
        min_vram_gb=2.0,
        rec_vram_gb=3.5,
        min_ram_gb=4.0,
        rec_ram_gb=8.0,
    )
    # 7B: Q4_K_M (4.1 GB)
    q7b = ModelQuant(
        model_id=2,
        quant="Q4_K_M",
        size_gb=4.1,
        min_vram_gb=4.5,
        rec_vram_gb=6.0,
        min_ram_gb=8.0,
        rec_ram_gb=16.0,
    )
    # 14B: Q4_K_M (8.5 GB)
    q14b = ModelQuant(
        model_id=3,
        quant="Q4_K_M",
        size_gb=8.5,
        min_vram_gb=8.0,
        rec_vram_gb=12.0,
        min_ram_gb=16.0,
        rec_ram_gb=32.0,
    )

    db.add_all([q05b, q3b, q7b, q14b])
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def test_results_unknown_token_404():
    res = client.get("/api/results/unknown_xyz")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_results_pending_token_202(setup_db):
    db = setup_db
    now = utcnow()
    session = HardwareSession(
        token="pending_tok_1",
        status="pending",
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    res = client.get("/api/results/pending_tok_1")
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "pending"
    assert "expires_at" in data


def test_results_expired_token_410(setup_db):
    db = setup_db
    now = utcnow()
    session = HardwareSession(
        token="expired_tok_1",
        status="complete",
        expires_at=now - timedelta(minutes=5),
        created_at=now - timedelta(minutes=35),
    )
    db.add(session)
    db.commit()

    res = client.get("/api/results/expired_tok_1")
    assert res.status_code == 410
    assert "expired" in res.json()["detail"].lower()


def test_results_complete_flow_and_no_7b_on_4gb_gpu(setup_db):
    """
    On a 4 GB GPU (RTX 2050 with 4.0 GB VRAM, 11.8 GB RAM):
    - 3B model (footprint ~2.1 GB) should fit fully on GPU ('gpu')
    - 7B model (footprint ~4.6 GB) must NOT be in 'gpu' (should be 'offload')
    - 14B model (footprint ~9.5 GB) should be 'heavy' or 'too_large'
    """
    db = setup_db
    now = utcnow()
    session = HardwareSession(
        token="valid_rtx2050",
        status="complete",
        gpu_name="NVIDIA GeForce RTX 2050",
        vram_gb=4.0,
        ram_gb=11.8,
        cpu_name="12th Gen Intel(R) Core(TM) i5-12450HX",
        cpu_cores=8,
        os="Windows 11",
        disk_total_gb=474.7,
        disk_free_gb=170.3,
        vram_source="scanner",
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    res = client.get("/api/results/valid_rtx2050")
    assert res.status_code == 200
    data = res.json()

    assert data["token"] == "valid_rtx2050"
    assert data["hardware"]["gpu_name"] == "NVIDIA GeForce RTX 2050"
    assert data["hardware"]["vram_gb"] == 4.0

    tier_counts = data["tier_counts"]
    assert "gpu" in tier_counts
    assert "offload" in tier_counts
    assert "heavy" in tier_counts
    assert "too_large" in tier_counts
    assert tier_counts["total"] == 4

    models = data["models"]
    assert len(models) == 4

    # Check 0.5B model (fits fully in GPU)
    model_05b = next(m for m in models if m["params_b"] == 0.5)
    assert model_05b["tier"] == "gpu"
    assert model_05b["offload_fraction"] >= 0.95

    # Check 7B model specifically
    model_7b = next(m for m in models if m["params_b"] == 7.0)
    assert model_7b["tier"] != "gpu", "CRITICAL: 7B model must never be in 'gpu' on a 4 GB GPU!"
    assert model_7b["tier"] == "offload"

    # Check 3B model (on 4 GB GPU with fitted reserve, offload ~90%, lands in offload)
    model_3b = next(m for m in models if m["params_b"] == 3.0)
    assert model_3b["tier"] == "offload"
    assert model_3b["offload_fraction"] >= 0.80

    # Check ordering: GPU first
    assert models[0]["tier"] == "gpu"

    # Check fields present
    for m in models:
        assert "best_quant" in m
        assert "footprint_gb" in m
        assert "speed_basis" in m
        assert "ollama_command" in m
        assert "reason" in m
        if not m["in_range"]:
            assert m["tps"] is None, "When in_range is false, tps must be null/None"


def test_model_result_details(setup_db):
    db = setup_db
    now = utcnow()
    session = HardwareSession(
        token="valid_detail_tok",
        status="complete",
        gpu_name="NVIDIA GeForce RTX 2050",
        vram_gb=4.0,
        ram_gb=16.0,
        cpu_name="12th Gen Intel(R) Core(TM) i5-12450HX",
        cpu_cores=8,
        os="Windows 11",
        disk_total_gb=500.0,
        disk_free_gb=150.0,
        vram_source="scanner",
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    res = client.get("/api/results/valid_detail_tok/model/2")
    assert res.status_code == 200
    data = res.json()

    assert data["model_id"] == 2
    assert data["name"] == "Mistral 7B"
    assert "quants" in data
    assert "comparison" in data

    rows = data["comparison"]
    keys = [r["key"] for r in rows]
    assert "vram" in keys
    assert "ram" in keys
    assert "disk" in keys
    assert "cpu" in keys
    assert "os" in keys

    for r in rows:
        assert "minimum" in r
        assert "recommended" in r
        assert "you_have" in r
        assert r["status"] in ("ok", "warn", "fail", "info")


def test_update_session_vram(setup_db):
    db = setup_db
    now = utcnow()
    session = HardwareSession(
        token="vram_update_tok",
        status="complete",
        gpu_name="Intel Iris Xe Graphics",
        vram_gb=0.0,
        ram_gb=16.0,
        vram_source="database",
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    patch_res = client.patch("/api/results/vram_update_tok/vram", json={"vram_gb": 4.0})
    assert patch_res.status_code == 200
    assert patch_res.json()["vram_gb"] == 4.0
    assert patch_res.json()["vram_source"] == "user"


def test_best_quant_rule_on_4gb_gpu_picks_q4km_never_q80(setup_db):
    """
    User rule verification:
    On a 4 GB GPU (e.g. RTX 2050 with 4 GB VRAM, 11.8 GB RAM),
    llama3.2 3B must pick Q4_K_M, never Q8_0.
    """
    db = setup_db
    now = utcnow()

    # Create Llama 3.2 3B with multiple quants
    m_llama = Model(
        id=99,
        name="Llama 3.2 3B Multi-Quant",
        ollama_tag="llama3.2:3b",
        family="llama",
        params_b=3.0,
        context_length=128000,
        tasks='["chat"]',
        description="Llama 3.2 3B with varied quantizations",
        quality_score=0.78,
        downloads_last_month=50000,
    )
    db.add(m_llama)
    db.commit()

    q_q4 = ModelQuant(model_id=99, quant="Q4_K_M", size_gb=2.0)
    q_q5 = ModelQuant(model_id=99, quant="Q5_K_M", size_gb=2.5)
    q_q8 = ModelQuant(model_id=99, quant="Q8_0", size_gb=3.3)
    db.add_all([q_q4, q_q5, q_q8])
    db.commit()

    session = HardwareSession(
        token="test_best_quant_4gb",
        status="complete",
        gpu_name="NVIDIA GeForce RTX 2050",
        vram_gb=4.0,
        ram_gb=11.8,
        cpu_name="12th Gen Intel(R) Core(TM) i5-12450HX",
        cpu_cores=8,
        os="Windows 11",
        disk_total_gb=474.7,
        disk_free_gb=170.3,
        vram_source="scanner",
        expires_at=now + timedelta(minutes=25),
        created_at=now,
    )
    db.add(session)
    db.commit()

    res = client.get("/api/results/test_best_quant_4gb")
    assert res.status_code == 200
    data = res.json()

    llama_res = next(m for m in data["models"] if m["model_id"] == 99)
    assert llama_res["best_quant"] == "Q4_K_M", f"Expected Q4_K_M but got {llama_res['best_quant']}"
    assert llama_res["best_quant"] != "Q8_0", "Must never pick Q8_0 on a 4 GB GPU!"
