"""
Unit tests for scanner_core.py hardware detection, token parsing, and network logic.
"""
import os
import pytest
from unittest.mock import patch, MagicMock

import scanner_core


def test_parse_token_from_filename(monkeypatch):
    monkeypatch.delenv("LLMBENCH_TOKEN", raising=False)
    # Direct filename
    assert scanner_core.parse_token(exe_path="C:\\Downloads\\LLMBench-Scanner-k9aBcD123.exe", argv=[]) == "k9aBcD123"
    # Browser duplicate filename with (1)
    assert scanner_core.parse_token(exe_path="C:\\Downloads\\LLMBench-Scanner-mZ_98-1122 (1).exe", argv=[]) == "mZ_98-1122"
    # Standard non-token filename
    assert scanner_core.parse_token(exe_path="C:\\Downloads\\LLMBench-Scanner.exe", argv=[]) is None



def test_parse_token_from_argv(monkeypatch):
    monkeypatch.delenv("LLMBENCH_TOKEN", raising=False)
    token = scanner_core.parse_token(
        exe_path="scanner.py",
        argv=["scanner.py", "token-from-cli-99"]
    )
    assert token == "token-from-cli-99"


def test_parse_token_from_env(monkeypatch):
    monkeypatch.setenv("LLMBENCH_TOKEN", "token-from-env-777")
    token = scanner_core.parse_token(exe_path="scanner.py", argv=["scanner.py"])
    assert token == "token-from-env-777"


def test_detect_cpu():
    cpu = scanner_core.detect_cpu()
    assert "cpu_name" in cpu
    assert "cpu_cores" in cpu
    assert isinstance(cpu["cpu_cores"], int)
    assert cpu["cpu_cores"] >= 1
    assert len(cpu["cpu_name"]) > 0


def test_detect_ram():
    ram = scanner_core.detect_ram()
    assert "ram_gb" in ram
    assert isinstance(ram["ram_gb"], float)
    assert ram["ram_gb"] > 0


def test_detect_os():
    os_info = scanner_core.detect_os()
    assert "os" in os_info
    assert len(os_info["os"]) > 0


def test_detect_disk():
    disk = scanner_core.detect_disk()
    assert "disk_total_gb" in disk
    assert "disk_free_gb" in disk
    assert isinstance(disk["disk_total_gb"], float)
    assert isinstance(disk["disk_free_gb"], float)


def test_detect_gpu():
    gpu = scanner_core.detect_gpu()
    assert "gpu_name" in gpu
    assert "vram_gb" in gpu
    assert isinstance(gpu["vram_gb"], float)


def test_send_success():
    hw_data = {
        "gpu_name": "RTX 2050",
        "vram_gb": 4.0,
        "ram_gb": 16.0,
        "cpu_name": "Test CPU",
        "cpu_cores": 8,
        "os": "Windows 11",
        "disk_total_gb": 500.0,
        "disk_free_gb": 200.0,
    }
    with patch("scanner_core.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"token": "test-tok"}
        mock_post.return_value = mock_resp

        tok = scanner_core.send(hw_data, token="test-tok", backend_url="http://localhost:8000")
        assert tok == "test-tok"
        assert mock_post.call_count == 1


def test_send_client_error_no_retry():
    hw_data = {"gpu_name": "RTX 2050", "vram_gb": 4.0, "ram_gb": 16.0}
    with patch("scanner_core.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.json.return_value = {"detail": "Scan session not found"}
        mock_post.return_value = mock_resp

        with pytest.raises(RuntimeError, match="Scan session not found"):
            scanner_core.send(hw_data, token="invalid-tok", max_retries=3)
        assert mock_post.call_count == 1
