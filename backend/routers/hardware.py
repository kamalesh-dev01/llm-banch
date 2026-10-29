"""
Router for Hardware Scanning and Verdict API endpoints.
"""
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import os
import json
import tempfile
import urllib.request
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import HardwareSession, Model, ModelQuant
import schemas
from services.verdict import get_verdict, get_best_quant_for_hardware
from services.ml_predict import predict_for_session_and_quant
from ml.config import ARTIFACT_DIR
from utils_time import utcnow

router = APIRouter()
logger = logging.getLogger(__name__)

CACHE_SCANNER_PATH = os.path.join(tempfile.gettempdir(), "llmbench-scanner.exe")

def _get_or_download_cached_scanner(url: str) -> str:
    """Downloads the release asset once into a temp cache file and returns the path."""
    if os.path.exists(CACHE_SCANNER_PATH) and os.path.getsize(CACHE_SCANNER_PATH) > 0:
        return CACHE_SCANNER_PATH

    temp_download = CACHE_SCANNER_PATH + f".tmp.{os.getpid()}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "LLMBench-Backend"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp, open(temp_download, "wb") as out_f:
            while chunk := resp.read(65536):
                out_f.write(chunk)
        if os.path.exists(CACHE_SCANNER_PATH):
            try:
                os.remove(CACHE_SCANNER_PATH)
            except OSError:
                pass
        os.rename(temp_download, CACHE_SCANNER_PATH)
        return CACHE_SCANNER_PATH
    except Exception as e:
        logger.error("Failed to download scanner asset from %s: %s", url, e)
        if os.path.exists(temp_download):
            try:
                os.remove(temp_download)
            except OSError:
                pass
        raise HTTPException(502, f"Failed to download scanner asset: {e}")

def resolve_gpu_vram(gpu_name: str) -> tuple[Optional[float], str]:
    """Matches gpu_name against gpu_database.json using longest-substring match."""
    if not gpu_name:
        return None, "scanner"
    gpu_file = os.path.join(
        os.path.dirname(__file__),
        "..", "data", "gpu_database.json"
    )
    if not os.path.exists(gpu_file):
        return None, "scanner"
    try:
        with open(gpu_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        gpus_dict = data.get("gpus", {})
        name_lower = gpu_name.lower()
        matches = []
        for db_name, vram in gpus_dict.items():
            if db_name.lower() in name_lower:
                matches.append((len(db_name), float(vram)))
        if matches:
            matches.sort(key=lambda x: x[0], reverse=True)
            return matches[0][1], "database"
    except Exception:
        pass
    return None, "scanner"

@router.get("/gpus", summary="Get GPU List", description="Returns list of available GPUs with VRAM specs sorted by name")
def get_gpus():
    """Returns sorted list of GPUs from gpu_database.json."""
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

@router.post("/scan-sessions", response_model=schemas.ScanSessionCreateResponse, status_code=201, summary="Create Scan Session", description="Creates a pending scan session and returns token and expiry")
def create_scan_session(db: Session = Depends(get_db)):
    """Creates a pending hardware scan session."""
    # Delete rows older than 1 hour on each call
    one_hour_ago = utcnow() - timedelta(hours=1)
    try:
        db.query(HardwareSession).filter(HardwareSession.created_at < one_hour_ago).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

    token = secrets.token_urlsafe(9)
    now = utcnow()
    expires_at = now + timedelta(minutes=30)

    new_session = HardwareSession(
        token=token,
        status="pending",
        expires_at=expires_at,
        created_at=now
    )
    try:
        db.add(new_session)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error creating scan session")

    return {"token": token, "status": "pending", "expires_at": expires_at}

@router.api_route("/scanner/download", methods=["GET", "HEAD"], summary="Download Scanner EXE", description="Serves the scanner EXE file for download.")
def download_scanner(token: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Serves the scanner EXE file for download."""
    redirect_url = os.getenv("SCANNER_DOWNLOAD_URL")

    is_valid_pending = False
    if token:
        hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
        now = utcnow()
        if hw_session and hw_session.status == "pending" and (not hw_session.expires_at or hw_session.expires_at > now):
            is_valid_pending = True

    if redirect_url:
        if is_valid_pending:
            cached_exe = _get_or_download_cached_scanner(redirect_url)
            return FileResponse(
                cached_exe,
                media_type="application/octet-stream",
                filename=f"LLMBench-Scanner-{token}.exe"
            )
        else:
            # Without a token, 307-redirect
            return RedirectResponse(url=redirect_url, status_code=307)

    exe_path = os.path.join(
        os.path.dirname(__file__),
        "..", "static", "LLMBench-Scanner.exe"
    )
    if not os.path.exists(exe_path):
        raise HTTPException(404, "Scanner not available")

    filename = f"LLMBench-Scanner-{token}.exe" if is_valid_pending else "LLMBench-Scanner.exe"

    return FileResponse(
        exe_path,
        media_type="application/octet-stream",
        filename=filename
    )

@router.get("/scanner/info", summary="Get Scanner Info", description="Returns metadata for the downloadable scanner EXE")
def get_scanner_info():
    """Returns metadata for the downloadable scanner."""
    exe_path = os.path.join(
        os.path.dirname(__file__),
        "..", "static", "LLMBench-Scanner.exe"
    )
    target_file = None
    if os.path.exists(exe_path) and os.path.getsize(exe_path) > 0:
        target_file = exe_path
    elif os.path.exists(CACHE_SCANNER_PATH) and os.path.getsize(CACHE_SCANNER_PATH) > 0:
        target_file = CACHE_SCANNER_PATH

    if target_file:
        try:
            stat = os.stat(target_file)
            size_mb = round(stat.st_size / (1024 * 1024), 2)
            mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

            hasher = hashlib.sha256()
            with open(target_file, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            sha256_hash = hasher.hexdigest()

            return {
                "available": True,
                "version": "1.1.0",
                "size_mb": size_mb,
                "sha256": sha256_hash,
                "updated_at": mtime
            }
        except Exception as e:
            logger.error("Error reading scanner file info: %s", e)

    # When only the URL exists (no local or cached file on disk)
    scanner_url = os.getenv("SCANNER_DOWNLOAD_URL")
    if scanner_url:
        env_sha = os.getenv("SCANNER_SHA256")
        env_size = os.getenv("SCANNER_SIZE_MB")
        try:
            size_mb = float(env_size) if env_size else 0.0
        except ValueError:
            size_mb = 0.0

        return {
            "available": True,
            "version": "1.1.0",
            "size_mb": size_mb,
            "sha256": env_sha,
            "updated_at": None
        }

    return {
        "available": False,
        "version": None,
        "size_mb": 0.0,
        "sha256": None,
        "updated_at": None
    }

@router.post("/hardware-scan", response_model=schemas.HardwareScanResponse, summary="Submit Hardware Scan", description="Saves user hardware specs and returns a session token")
def submit_hardware_scan(
    scan_data: schemas.HardwareScanRequest,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Submits hardware scan data, updating a pending session or creating a new one."""
    active_token = scan_data.token or token

    vram_gb = scan_data.vram_gb
    vram_source = "scanner"

    if (vram_gb is None or vram_gb <= 0) and scan_data.gpu_name:
        db_vram, db_source = resolve_gpu_vram(scan_data.gpu_name)
        if db_vram is not None and db_vram > 0:
            vram_gb = db_vram
            vram_source = db_source

    if active_token:
        hw_session = db.query(HardwareSession).filter(HardwareSession.token == active_token).first()
        if not hw_session:
            raise HTTPException(status_code=404, detail="Scan session not found")

        now = utcnow()
        if hw_session.expires_at and hw_session.expires_at < now:
            raise HTTPException(status_code=410, detail="Scan session expired")

        if hw_session.status == "complete":
            raise HTTPException(status_code=409, detail="Scan session already completed")

        hw_session.gpu_name = scan_data.gpu_name
        hw_session.vram_gb = vram_gb
        hw_session.vram_source = vram_source
        hw_session.ram_gb = scan_data.ram_gb
        hw_session.cpu_name = scan_data.cpu_name
        hw_session.cpu_cores = scan_data.cpu_cores
        hw_session.os = scan_data.os
        hw_session.disk_total_gb = scan_data.disk_total_gb
        hw_session.disk_free_gb = scan_data.disk_free_gb
        hw_session.status = "complete"

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Database error updating hardware session")

        return {"token": active_token}

    # Legacy no-token path
    gen_token = str(uuid.uuid4())
    new_session = HardwareSession(
        token=gen_token,
        status="complete",
        vram_source=vram_source,
        gpu_name=scan_data.gpu_name,
        vram_gb=vram_gb,
        ram_gb=scan_data.ram_gb,
        cpu_name=scan_data.cpu_name,
        cpu_cores=scan_data.cpu_cores,
        os=scan_data.os,
        disk_total_gb=scan_data.disk_total_gb,
        disk_free_gb=scan_data.disk_free_gb,
        created_at=utcnow()
    )
    try:
        db.add(new_session)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error saving hardware session")

    return {"token": gen_token}


@router.get("/hardware-scan/{token}", summary="Get Hardware Scan", description="Retrieve hardware session details by token")
def get_hardware_scan(token: str, db: Session = Depends(get_db)):
    """Retrieves an existing hardware session. Returns 202 if pending, 200 if complete, 410 if expired."""
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()

    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan not found")

    now = utcnow()
    if (hw_session.expires_at and hw_session.expires_at < now) or (hw_session.created_at and hw_session.created_at < now - timedelta(hours=1)):
        db.delete(hw_session)
        db.commit()
        raise HTTPException(status_code=410, detail="Scan expired")

    if hw_session.status == "pending":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending",
                "expires_at": hw_session.expires_at.isoformat() if hw_session.expires_at else None
            }
        )

    return schemas.HardwareScanDetailResponse.model_validate(hw_session)



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

    # ML performance prediction
    ml_pred = predict_for_session_and_quant(selected_quant, hw_session, model.params_b)
    if ml_pred:
        est_tps_ml = float(ml_pred["tps"])
        offload_fraction_ml = float(ml_pred["offload_fraction"])
        verdict_data["est_tps"] = est_tps_ml
        verdict_data["est_tps_ml"] = est_tps_ml
        verdict_data["tps_range"] = [float(ml_pred["tps_min"]), float(ml_pred["tps_max"])]
        verdict_data["offload_fraction_ml"] = offload_fraction_ml
        verdict_data["prediction_source"] = "ml"
        verdict_data["in_range"] = ml_pred.get("in_range", True)

        # Downward-only verdict adjustment
        current_v = verdict_data["verdict"]
        if current_v == "recommended":
            if offload_fraction_ml < 0.9 or est_tps_ml < 10.0:
                verdict_data["verdict"] = "minimum"
                verdict_data["reason"] += " (Adjusted to minimum by performance model: partial GPU offload or speed < 10 tps)"
            if est_tps_ml < 3.0:
                verdict_data["verdict"] = "not_recommended"
                verdict_data["reason"] += " (Adjusted to not recommended by performance model: speed < 3 tps)"
        elif current_v == "minimum":
            if est_tps_ml < 3.0:
                verdict_data["verdict"] = "not_recommended"
                verdict_data["reason"] += " (Adjusted to not recommended by performance model: speed < 3 tps)"
    else:
        verdict_data["prediction_source"] = "heuristic"
        verdict_data["est_tps_ml"] = None
        verdict_data["tps_range"] = None
        verdict_data["offload_fraction_ml"] = None
        verdict_data["in_range"] = True

    # 8. Return extended VerdictResponse
    return verdict_data


@router.get("/predict", summary="Predict Model Speed", description="Returns standalone ML performance prediction for a (model, quant, hardware) triplet")
def predict_speed(
    model_id: int = Query(..., description="Model ID"),
    quant: Optional[str] = Query(None, description="Quantization tag"),
    token: Optional[str] = Query(None, description="Hardware session token"),
    db: Session = Depends(get_db)
):
    if not token:
        raise HTTPException(status_code=400, detail="Hardware session token is required")

    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    if not hw_session:
        raise HTTPException(status_code=404, detail="Hardware session not found")

    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    quants = db.query(ModelQuant).filter(ModelQuant.model_id == model_id).all()
    if not quants:
        raise HTTPException(status_code=404, detail="No quantizations found for model")

    selected_quant = None
    if quant:
        selected_quant = next((q for q in quants if q.quant == quant), None)
        if not selected_quant:
            raise HTTPException(status_code=404, detail="Specified quant not found for this model")
    else:
        selected_quant = get_best_quant_for_hardware(quants, hw_session.vram_gb, hw_session.ram_gb)
        if not selected_quant:
            selected_quant = quants[0]

    prediction = predict_for_session_and_quant(selected_quant, hw_session, model.params_b)
    if not prediction:
        raise HTTPException(status_code=422, detail="Could not generate prediction (GPU specs or model weights missing)")

    return prediction


@router.get("/ml/info", summary="Get ML Predictor Info", description="Returns metrics, model card info, and training history")
def get_ml_info():
    metrics_file = ARTIFACT_DIR / "metrics.json"
    if not metrics_file.exists():
        return {
            "status": "not_trained",
            "message": "Model artifacts not found. Train the model using python -m ml.train"
        }

    try:
        with open(metrics_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read ML metrics: {e}")
