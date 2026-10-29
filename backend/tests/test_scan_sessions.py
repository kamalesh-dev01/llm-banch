import os
import io
import sys
import hashlib
import subprocess
from unittest.mock import patch
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import get_db, Base
from models import HardwareSession
from utils_time import utcnow

# Setup in-memory SQLite database for test isolation
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
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)



def test_pending_submit_complete_flow():
    """Test full session lifecycle: pending -> submit with token -> complete."""
    # 1. Create session
    resp = client.post("/api/scan-sessions")
    assert resp.status_code == 201
    data = resp.json()
    token = data["token"]
    assert data["status"] == "pending"
    assert "expires_at" in data

    # 2. Check pending returns 202
    resp_pending = client.get(f"/api/hardware-scan/{token}")
    assert resp_pending.status_code == 202
    assert resp_pending.json()["status"] == "pending"

    # 3. Submit hardware scan with token
    payload = {
        "token": token,
        "gpu_name": "NVIDIA GeForce RTX 3060",
        "vram_gb": 12.0,
        "ram_gb": 32.0,
        "cpu_name": "AMD Ryzen 7 5800X",
        "cpu_cores": 8,
        "os": "Windows 11",
        "disk_total_gb": 1000.0,
        "disk_free_gb": 500.0,
    }
    resp_submit = client.post("/api/hardware-scan", json=payload)
    assert resp_submit.status_code == 200
    assert resp_submit.json()["token"] == token

    # 4. Check completed session returns 200 with full data and status
    resp_complete = client.get(f"/api/hardware-scan/{token}")
    assert resp_complete.status_code == 200
    comp_data = resp_complete.json()
    assert comp_data["token"] == token
    assert comp_data["status"] == "complete"
    assert comp_data["vram_source"] == "scanner"
    assert comp_data["gpu_name"] == "NVIDIA GeForce RTX 3060"
    assert comp_data["vram_gb"] == 12.0
    assert comp_data["ram_gb"] == 32.0


def test_wrong_token_404():
    """Test nonexistent token returns 404 for both GET and POST."""
    get_res = client.get("/api/hardware-scan/nonexistent-token-123")
    assert get_res.status_code == 404

    payload = {
        "token": "nonexistent-token-123",
        "gpu_name": "RTX 3060",
        "vram_gb": 12.0,
        "ram_gb": 16.0,
        "cpu_name": "Intel i5",
        "cpu_cores": 6,
        "os": "Windows",
    }
    post_res = client.post("/api/hardware-scan", json=payload)
    assert post_res.status_code == 404


def test_double_submit_409():
    """Test submitting twice with the same token returns 409 Conflict."""
    # Create pending session
    resp = client.post("/api/scan-sessions")
    token = resp.json()["token"]

    payload = {
        "token": token,
        "gpu_name": "RTX 2050",
        "vram_gb": 4.0,
        "ram_gb": 16.0,
        "cpu_name": "Intel i5",
        "cpu_cores": 6,
        "os": "Windows",
    }
    # First submit -> 200
    first = client.post("/api/hardware-scan", json=payload)
    assert first.status_code == 200

    # Second submit -> 409
    second = client.post("/api/hardware-scan", json=payload)
    assert second.status_code == 409
    assert "already completed" in second.json()["detail"]


def test_legacy_no_token_path():
    """Test legacy POST /api/hardware-scan without a token creates complete session."""
    payload = {
        "gpu_name": "Apple M2 Pro",
        "vram_gb": 16.0,
        "ram_gb": 16.0,
        "cpu_name": "Apple M2 Pro",
        "cpu_cores": 10,
        "os": "macOS",
    }
    resp = client.post("/api/hardware-scan", json=payload)
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert token

    # Verify session details
    get_res = client.get(f"/api/hardware-scan/{token}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["status"] == "complete"
    assert data["vram_source"] == "scanner"
    assert data["gpu_name"] == "Apple M2 Pro"


def test_vram_resolved_from_database():
    """When vram_gb <= 0 and gpu_name matches database, resolves VRAM and sets vram_source='database'."""
    payload = {
        "gpu_name": "NVIDIA GeForce RTX 4080 16GB",
        "vram_gb": 0.0,
        "ram_gb": 32.0,
        "cpu_name": "Intel Core i9",
        "cpu_cores": 16,
        "os": "Windows 11",
    }
    resp = client.post("/api/hardware-scan", json=payload)
    assert resp.status_code == 200
    token = resp.json()["token"]

    get_res = client.get(f"/api/hardware-scan/{token}")
    assert get_res.status_code == 200
    data = get_res.json()
    # RTX 4080 in gpu_database.json is 16 GB
    assert data["vram_gb"] == 16.0
    assert data["vram_source"] == "database"


def test_expired_session_410():
    """Test expired session returns 410."""
    db = TestingSessionLocal()
    expired_token = "expired-token-xyz"
    expired_session = HardwareSession(
        token=expired_token,
        status="pending",
        expires_at=utcnow() - timedelta(minutes=5),
        created_at=utcnow() - timedelta(minutes=35),
    )
    db.add(expired_session)
    db.commit()
    db.close()

    resp = client.get(f"/api/hardware-scan/{expired_token}")
    assert resp.status_code == 410


def test_download_scanner():
    """Test GET /api/scanner/download serves token-customized and generic filenames."""
    # 1. Create pending session
    resp = client.post("/api/scan-sessions")
    token = resp.json()["token"]

    # 2. Download with pending token
    res_token = client.get(f"/api/scanner/download?token={token}")
    assert res_token.status_code == 200
    assert f'filename="LLMBench-Scanner-{token}.exe"' in res_token.headers.get("content-disposition", "")

    # 3. Download without token or with nonexistent token
    res_generic = client.get("/api/scanner/download")
    assert res_generic.status_code == 200
    assert 'filename="LLMBench-Scanner.exe"' in res_generic.headers.get("content-disposition", "")


def test_download_scanner_production_with_mocked_url(monkeypatch, tmp_path):
    """Test production scanner download with SCANNER_DOWNLOAD_URL and pending token."""
    mock_cache = str(tmp_path / "mock_cached_scanner.exe")
    monkeypatch.setattr("routers.hardware.CACHE_SCANNER_PATH", mock_cache)
    monkeypatch.setenv("SCANNER_DOWNLOAD_URL", "https://releases.llmbench.com/LLMBench-Scanner.exe")

    mock_bytes = b"MZ_MOCK_PE_HEADER_LLMBENCH_BINARY_CONTENT"

    class MockResponse:
        def __init__(self, data):
            self.stream = io.BytesIO(data)
        def read(self, chunk_size=65536):
            return self.stream.read(chunk_size)
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    with patch("urllib.request.urlopen", return_value=MockResponse(mock_bytes)):
        # 1. Create a pending session
        resp = client.post("/api/scan-sessions")
        assert resp.status_code == 201
        token = resp.json()["token"]

        # 2. Download with valid pending token -> streams cached file with tokenized filename
        res = client.get(f"/api/scanner/download?token={token}")
        assert res.status_code == 200
        assert f'filename="LLMBench-Scanner-{token}.exe"' in res.headers.get("content-disposition", "")
        assert res.content == mock_bytes
        assert os.path.exists(mock_cache)

        # 3. /api/scanner/info reads size and sha256 from cached file
        orig_exists = os.path.exists
        def mock_exists_cache(p):
            if str(p) == mock_cache:
                return True
            if "static" in str(p) and "LLMBench-Scanner.exe" in str(p):
                return False
            return orig_exists(p)

        with patch("os.path.exists", side_effect=mock_exists_cache):
            info_res = client.get("/api/scanner/info")
            assert info_res.status_code == 200
            info_data = info_res.json()
            assert info_data["available"] is True
            assert info_data["sha256"] == hashlib.sha256(mock_bytes).hexdigest()
            assert info_data["size_mb"] >= 0.0


def test_download_scanner_production_without_token_redirect(monkeypatch):
    """When SCANNER_DOWNLOAD_URL is set, download without token or with invalid token returns 307 redirect."""
    monkeypatch.setenv("SCANNER_DOWNLOAD_URL", "https://releases.llmbench.com/LLMBench-Scanner.exe")

    # No token -> 307
    res = client.get("/api/scanner/download", follow_redirects=False)
    assert res.status_code == 307
    assert res.headers.get("location") == "https://releases.llmbench.com/LLMBench-Scanner.exe"

    # Non-existent token -> 307
    res_invalid = client.get("/api/scanner/download?token=nonexistent123", follow_redirects=False)
    assert res_invalid.status_code == 307
    assert res_invalid.headers.get("location") == "https://releases.llmbench.com/LLMBench-Scanner.exe"


def test_scanner_info_env_fallback(monkeypatch, tmp_path):
    """When only SCANNER_DOWNLOAD_URL exists (no cached file), reads size and sha256 from env."""
    non_existent = str(tmp_path / "does_not_exist.exe")
    monkeypatch.setattr("routers.hardware.CACHE_SCANNER_PATH", non_existent)
    monkeypatch.setenv("SCANNER_DOWNLOAD_URL", "https://releases.llmbench.com/LLMBench-Scanner.exe")
    monkeypatch.setenv("SCANNER_SHA256", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
    monkeypatch.setenv("SCANNER_SIZE_MB", "14.5")

    orig_exists = os.path.exists
    def mock_exists_none(p):
        if "LLMBench-Scanner.exe" in str(p):
            return False
        return orig_exists(p)

    with patch("os.path.exists", side_effect=mock_exists_none):
        res = client.get("/api/scanner/info")
        assert res.status_code == 200
        data = res.json()
        assert data["available"] is True
        assert data["sha256"] == "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        assert data["size_mb"] == 14.5


def test_seed_guard_without_allow_drop():
    """seed.py must refuse to run and exit with code 1 unless ALLOW_DROP=1."""
    env = os.environ.copy()
    env.pop("ALLOW_DROP", None)
    seed_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed.py")
    res = subprocess.run([sys.executable, seed_path], capture_output=True, text=True, env=env)
    assert res.returncode == 1
    assert "ALLOW_DROP=1" in res.stdout or "ALLOW_DROP=1" in res.stderr


