"""
This file defines Pydantic schemas for request and response validation.
It imports BaseModel and ConfigDict from pydantic.
These schemas ensure data sent to and from the API is correctly formatted.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ModelQuantResponse(BaseModel):
    """Schema for returning model quantization data."""
    id: int
    model_id: int
    quant: str
    size_gb: float
    min_vram_gb: float
    rec_vram_gb: float
    min_ram_gb: float
    rec_ram_gb: float
    est_tps_low: float
    est_tps_mid: float
    est_tps_cpu: float
    ollama_url: str
    hf_url: str
    gguf_url: str

    model_config = ConfigDict(from_attributes=True)


class ModelBase(BaseModel):
    """Base schema for an LLM model containing core attributes."""
    id: int
    name: str
    ollama_tag: str
    family: str
    params_b: float
    context_length: int
    licence: str
    tasks: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class ModelListItem(ModelBase):
    """Schema for returning model list (lightweight)."""
    quality_score: float
    downloads_last_month: int
    likes: int
    min_vram: float
    quant_count: int
    tagline: Optional[str] = None
    capabilities: Optional[str] = None
    publisher: Optional[str] = None
    released_at: Optional[datetime] = None
    quality_source: Optional[str] = None
    quality_n: Optional[int] = None
    quality_ci: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ModelResponse(ModelBase):
    """Schema for returning a model along with its quantizations and rich metadata."""
    quality_score: float
    downloads_last_month: int
    likes: int
    tagline: Optional[str] = None
    about: Optional[str] = None
    publisher: Optional[str] = None
    released_at: Optional[datetime] = None
    hf_updated_at: Optional[datetime] = None
    languages: Optional[str] = None
    capabilities: Optional[str] = None
    hf_tags: Optional[str] = None
    hf_url: Optional[str] = None
    ollama_library_url: Optional[str] = None
    enriched_at: Optional[datetime] = None
    enriched_from: Optional[str] = None
    quality_source: Optional[str] = None
    quality_n: Optional[int] = None
    quality_ci: Optional[float] = None
    quants: List[ModelQuantResponse] = []

    model_config = ConfigDict(from_attributes=True)


class BenchmarkResultResponse(BaseModel):
    """Schema for returning measured benchmark data."""
    id: int
    model_id: int
    machine_label: Optional[str] = None
    gpu_name: Optional[str] = None
    vram_gb: Optional[float] = None
    ram_gb: Optional[float] = None
    quant: str
    tokens_per_sec: float
    ttft_ms: Optional[int] = None
    offload_fraction: Optional[float] = None
    peak_vram_gb: Optional[float] = None
    source: str = "measured"
    measured_at: Optional[datetime] = None
    n_runs: Optional[int] = 1

    model_config = ConfigDict(from_attributes=True)


class HardwareScanRequest(BaseModel):
    """Schema for submitting hardware scan results."""
    token: Optional[str] = None
    gpu_name: str
    vram_gb: float
    ram_gb: float
    cpu_name: str
    cpu_cores: int
    os: str
    disk_total_gb: float = 0.0
    disk_free_gb: float = 0.0


class ScanSessionCreateResponse(BaseModel):
    """Schema for creating a pending hardware scan session."""
    token: str
    status: str = "pending"
    expires_at: datetime


class HardwareScanResponse(BaseModel):
    """Schema for responding with a session token after a hardware scan."""
    token: str


class VerdictResponse(BaseModel):
    """Schema for returning a compatibility verdict."""
    verdict: str  # "recommended", "minimum", or "not_recommended"
    reason: str
    user_hw: Dict[str, Any]
    model_req: Dict[str, Any]


class BenchmarkResultCreate(BaseModel):
    """Schema for submitting a new benchmark result."""
    model_id: int
    quant: str
    gpu_name: str
    vram_gb: float
    tokens_per_sec: float
    ttft_ms: int
    source: str


class HardwareScanDetailResponse(BaseModel):
    """Schema for returning detailed hardware scan session data."""
    token: str
    gpu_name: Optional[str] = None
    vram_gb: Optional[float] = None
    ram_gb: Optional[float] = None
    cpu_name: Optional[str] = None
    cpu_cores: Optional[int] = None
    os: Optional[str] = None
    disk_total_gb: Optional[float] = 0.0
    disk_free_gb: Optional[float] = 0.0
    status: Optional[str] = "complete"
    vram_source: Optional[str] = "scanner"
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExtendedVerdictResponse(VerdictResponse):
    """Schema for returning an extended compatibility verdict with quant info."""
    recommended_quant: str
    est_tps: float
    ollama_command: str
    est_tps_ml: Optional[float] = None
    tps_range: Optional[List[float]] = None
    offload_fraction_ml: Optional[float] = None
    prediction_source: str = "heuristic"
    in_range: Optional[bool] = True


class FilterCountItem(BaseModel):
    value: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class RangeItem(BaseModel):
    min: float
    max: float

    model_config = ConfigDict(from_attributes=True)


class FiltersResponse(BaseModel):
    families: List[FilterCountItem]
    tasks: List[FilterCountItem]
    capabilities: List[str]
    licenses: List[str]
    params: RangeItem
    vram: RangeItem

    model_config = ConfigDict(from_attributes=True)


class LeaderboardItem(BaseModel):
    """Schema for returning an item in the leaderboard."""
    id: int
    name: str
    ollama_tag: str
    family: str
    params_b: float
    quality_score: float
    min_vram_gb: float
    avg_tps_low: float
    metric_value: float
    quality_source: Optional[str] = None
    quality_n: Optional[int] = None
    quality_ci: Optional[float] = None
    gpu_name: Optional[str] = None
    quant: Optional[str] = None
    measured_at: Optional[datetime] = None
    n_runs: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
