"""
Router for Hardware Scanning and Verdict API endpoints.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import HardwareSession, Model, ModelQuant
import schemas
from services.verdict import get_verdict, get_best_quant_for_hardware

router = APIRouter()

@router.get("/gpus", summary="Get GPU List", description="Returns list of available GPUs with VRAM specs sorted by name")
def get_gpus():
    """Returns sorted list of GPUs from gpu_database.json."""
    import json
    import os
    gpu_file = os.path.join(
        os.path.dirname(__file__),
        "..", "data", "gpu_database.json"
    )
    if not os.path.exists(gpu_file):
        return []
    with open(gpu_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    gpus_dict = data.get("gpus", {})
    gpu_list = [{"name": name, "vram_gb": vram} for name, vram in gpus_dict.items()]
    gpu_list.sort(key=lambda x: x["name"].lower())
    return gpu_list

@router.get("/scanner/download", summary="Download Scanner EXE", description="Serves the scanner EXE file for download.")
def download_scanner():
    """Serves the scanner EXE file for download."""
    from fastapi.responses import FileResponse
    import os
    exe_path = os.path.join(
        os.path.dirname(__file__),
        "..", "static", "LLMBench-Scanner.exe"
    )
    if not os.path.exists(exe_path):
        raise HTTPException(404, "Scanner not available")
    return FileResponse(
        exe_path,
        media_type="application/octet-stream",
        filename="LLMBench-Scanner.exe"
    )

@router.post("/hardware-scan", response_model=schemas.HardwareScanResponse, summary="Submit Hardware Scan", description="Saves user hardware specs and returns a session token")
def submit_hardware_scan(scan_data: schemas.HardwareScanRequest, db: Session = Depends(get_db)):
    """Creates a new hardware session."""
    # 1. Generate a UUID token
    token = str(uuid.uuid4())
    
    # 2. Create HardwareSession row
    new_session = HardwareSession(
        token=token,
        gpu_name=scan_data.gpu_name,
        vram_gb=scan_data.vram_gb,
        ram_gb=scan_data.ram_gb,
        cpu_name=scan_data.cpu_name,
        cpu_cores=scan_data.cpu_cores,
        os=scan_data.os,
        disk_total_gb=scan_data.disk_total_gb,
        disk_free_gb=scan_data.disk_free_gb
    )
    
    try:
        db.add(new_session)
        # 3. Commit to DB
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error saving hardware session")
        
    # 4. Return token
    return {"token": token}


@router.get("/hardware-scan/{token}", response_model=schemas.HardwareScanDetailResponse, summary="Get Hardware Scan", description="Retrieve hardware session details by token")
def get_hardware_scan(token: str, db: Session = Depends(get_db)):
    """Retrieves an existing hardware session."""
    # 1. Query hardware_sessions by token
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    
    # 2. If not found -> 404
    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    # 3. Check if session is expired (created_at older than 1 hour)
    if hw_session.created_at < datetime.utcnow() - timedelta(hours=1):
        db.delete(hw_session)
        db.commit()
        raise HTTPException(status_code=410, detail="Scan expired")
        
    # 4. Return the session data
    return hw_session


@router.get("/verdict/{model_id}", response_model=schemas.ExtendedVerdictResponse, summary="Get Model Verdict", description="Evaluate a specific model against user hardware")
def get_model_verdict(
    model_id: int, 
    token: str = Query(..., description="Hardware session token"), 
    quant: Optional[str] = Query(None, description="Specific quant to evaluate"),
    db: Session = Depends(get_db)
):
    """Evaluates user hardware compatibility with a specific model/quant."""
    # 1. Get hardware session by token
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    # 2. Get model by model_id
    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    # 3. Get model quants from DB
    quants = db.query(ModelQuant).filter(ModelQuant.model_id == model_id).all()
    
    selected_quant = None
    # 4. Find specific quant or best fitting quant
    if quant:
        selected_quant = next((q for q in quants if q.quant == quant), None)
        if not selected_quant:
            raise HTTPException(status_code=404, detail="Quant not found for this model")
    else:
        selected_quant = get_best_quant_for_hardware(quants, hw_session.vram_gb, hw_session.ram_gb)
        
    # 5. If no quant fits at all
    if not selected_quant:
        return {
            "verdict": "not_recommended",
            "reason": "No quantization of this model fits your hardware.",
            "user_hw": {"vram_gb": hw_session.vram_gb, "ram_gb": hw_session.ram_gb},
            "model_req": {"min_vram_gb": 0, "rec_vram_gb": 0, "min_ram_gb": 0, "rec_ram_gb": 0},
            "recommended_quant": "None",
            "est_tps": 0.0,
            "ollama_command": ""
        }
        
    # 6. Call get_verdict()
    verdict_data = get_verdict(
        user_vram=hw_session.vram_gb,
        user_ram=hw_session.ram_gb,
        min_vram=selected_quant.min_vram_gb,
        rec_vram=selected_quant.rec_vram_gb,
        min_ram=selected_quant.min_ram_gb,
        rec_ram=selected_quant.rec_ram_gb
    )
    
    # 7. Add extra response fields
    verdict_data["recommended_quant"] = selected_quant.quant
    verdict_data["est_tps"] = selected_quant.est_tps_low
    verdict_data["ollama_command"] = selected_quant.ollama_url
    
    # 8. Return extended VerdictResponse
    return verdict_data
