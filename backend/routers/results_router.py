"""
Results API Router for LLM Bench.
Exposes:
- GET /api/results/{token}
- GET /api/results/{token}/model/{model_id}
- PATCH /api/results/{token}/vram
"""
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from models import HardwareSession, Model
from utils_time import utcnow
from services.results import get_all_results_for_session, get_model_result_details

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/results", tags=["results"])


class UpdateVramRequest(BaseModel):
    vram_gb: float = Field(..., ge=0, le=128)


def get_verified_hardware_session(token: str, db: Session) -> HardwareSession:
    """
    Validates token state:
    - 404 if not found
    - 410 if expired
    - 202 JSON Response if pending
    Returns HardwareSession if complete.
    """
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan session not found")

    now = utcnow()
    if hw_session.expires_at and hw_session.expires_at < now:
        raise HTTPException(status_code=410, detail="Scan session expired")

    if hw_session.status == "pending":
        exp = hw_session.expires_at.isoformat() if hw_session.expires_at else None
        raise HTTPException(
            status_code=202,
            detail={"status": "pending", "expires_at": exp}
        )

    return hw_session


@router.get("/{token}", summary="Get Complete Hardware Scan Results")
def get_results_for_token(token: str, db: Session = Depends(get_db)):
    """
    Returns server-computed compatibility results and ML tok/s predictions
    for all database models against the user's hardware.
    """
    try:
        hw_session = get_verified_hardware_session(token, db)
    except HTTPException as e:
        if e.status_code == 202:
            return Response(
                content=json.dumps(e.detail),
                media_type="application/json",
                status_code=202
            )
        raise e

    return get_all_results_for_session(hw_session, db)


@router.get("/{token}/model/{model_id}", summary="Get Detailed Compatibility For One Model")
def get_model_result_for_token(token: str, model_id: int, db: Session = Depends(get_db)):
    """
    Returns per-quant results and a minimum vs recommended system requirements
    comparison for a specific model against the user's hardware.
    """
    try:
        hw_session = get_verified_hardware_session(token, db)
    except HTTPException as e:
        if e.status_code == 202:
            return Response(
                content=json.dumps(e.detail),
                media_type="application/json",
                status_code=202
            )
        raise e

    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    return get_model_result_details(hw_session, model, db)


@router.patch("/{token}/vram", summary="Update VRAM on Hardware Session")
def update_session_vram(token: str, req: UpdateVramRequest, db: Session = Depends(get_db)):
    """Allows updating VRAM when GPU VRAM is 0 or user overrides."""
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan session not found")

    hw_session.vram_gb = req.vram_gb
    hw_session.vram_source = "user"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error updating VRAM: {e}")

    return {
        "token": token,
        "vram_gb": hw_session.vram_gb,
        "vram_source": hw_session.vram_source,
    }
