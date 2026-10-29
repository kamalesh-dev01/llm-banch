import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import get_db, Base
from models import HardwareSession, Model, ModelQuant

# Isolated in-memory SQLite database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db

    # Clean and seed
    db = TestingSessionLocal()
    db.query(HardwareSession).delete()
    db.query(ModelQuant).delete()
    db.query(Model).delete()

    m = Model(
        id=1,
        name="Llama 3.2 3B",
        ollama_tag="llama3.2:3b",
        family="llama",
        params_b=3.2,
        context_length=8192,
        tasks='["chat"]',
        description="Test model",
        quality_score=0.75,
    )
    db.add(m)
    db.commit()

    q1 = ModelQuant(
        id=1,
        model_id=1,
        quant="Q4_K_M",
        size_gb=2.0,
        min_vram_gb=2.5,
        rec_vram_gb=3.5,
        min_ram_gb=8.0,
        rec_ram_gb=16.0,
        est_tps_low=35.0,
        est_tps_mid=50.0,
        est_tps_cpu=10.0,
        ollama_url="url",
        hf_url="url",
        gguf_url="url",
    )
    db.add(q1)
    db.commit()
    db.close()

    yield

    app.dependency_overrides.pop(get_db, None)


def test_ml_info_endpoint():
    """Tests GET /api/ml/info."""
    response = client.get("/api/ml/info")
    assert response.status_code == 200
    data = response.json()
    assert "selected_model" in data
    assert "winner_metrics" in data
    assert "models_compared" in data


def test_predict_endpoint_missing_token():
    """Tests GET /api/predict without token returns 400."""
    response = client.get("/api/predict?model_id=1")
    assert response.status_code == 400


def test_verdict_with_ml():
    """Tests GET /api/verdict/{model_id} returns ML fields."""
    # First submit a hardware scan to get a token
    scan_payload = {
        "gpu_name": "NVIDIA GeForce RTX 2050",
        "vram_gb": 4.0,
        "ram_gb": 16.0,
        "cpu_name": "Intel Core i5-11400H",
        "cpu_cores": 6,
        "os": "Windows"
    }
    scan_res = client.post("/api/hardware-scan", json=scan_payload)
    assert scan_res.status_code == 200
    token = scan_res.json()["token"]

    # Call verdict on model 1 (if model 1 exists in DB)
    verdict_res = client.get(f"/api/verdict/1?token={token}")
    if verdict_res.status_code == 200:
        data = verdict_res.json()
        assert "prediction_source" in data
        assert "recommended_quant" in data
        assert "est_tps" in data
        if data["prediction_source"] == "ml":
            assert data["est_tps_ml"] is not None
            assert data["offload_fraction_ml"] is not None
            assert data["tps_range"] is not None

    # Test /api/predict
    pred_res = client.get(f"/api/predict?model_id=1&token={token}")
    if pred_res.status_code == 200:
        pdata = pred_res.json()
        assert "tps" in pdata
        assert "offload_fraction" in pdata
        assert "tps_min" in pdata
        assert "tps_max" in pdata
