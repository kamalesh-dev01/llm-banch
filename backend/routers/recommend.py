"""
Router for Model Recommendations and Leaderboard API endpoints.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import BenchmarkResult, HardwareSession, Model, ModelQuant
import schemas
from services.recommender import get_recommendations

router = APIRouter()

@router.get("/recommend", summary="Get Recommendations", description="Get model recommendations based on user hardware")
def recommend_models(
    token: str = Query(..., description="Hardware session token"),
    task: Optional[str] = Query(None, description="Optional task filter (e.g. chat, coding)"),
    limit: int = Query(5, le=10, description="Max number of recommendations to return"),
    db: Session = Depends(get_db)
):
    """Returns top recommended models for a user's hardware."""
    # 1. Get hardware session by token
    hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()
    if not hw_session:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    # 2. Call get_recommendations
    recs = get_recommendations(
        db=db, 
        user_vram=hw_session.vram_gb, 
        user_ram=hw_session.ram_gb, 
        task=task, 
        limit=limit
    )
    
    # 3. Return list of recommendation dicts
    return recs


@router.get("/leaderboard", response_model=List[schemas.LeaderboardItem], summary="Get Leaderboard", description="Get a ranked list of models by metric")
def get_leaderboard(
    metric: str = Query("quality", description="Metric to rank by: speed, quality, efficiency"),
    limit: int = Query(20, description="Max number of models to return"),
    db: Session = Depends(get_db)
):
    """Returns the top models ranked by a specific metric. Speed only uses verified measured benchmarks."""
    results = []
    
    if metric == "speed":
        # Only return real measured rows from benchmark_results
        benchmarks = (
            db.query(BenchmarkResult)
            .filter(BenchmarkResult.source == "measured")
            .order_by(BenchmarkResult.tokens_per_sec.desc())
            .all()
        )
        if not benchmarks:
            return []

        seen_models = set()
        for b in benchmarks:
            model = db.query(Model).filter(Model.id == b.model_id).first()
            if not model or model.id in seen_models:
                continue
            seen_models.add(model.id)

            min_vram = b.vram_gb
            if not min_vram and model.quants:
                min_vram = min(q.min_vram_gb for q in model.quants)

            results.append(
                schemas.LeaderboardItem(
                    id=model.id,
                    name=model.name,
                    ollama_tag=model.ollama_tag,
                    family=model.family,
                    params_b=model.params_b,
                    quality_score=model.quality_score,
                    min_vram_gb=min_vram or 4.0,
                    avg_tps_low=b.tokens_per_sec,
                    metric_value=round(float(b.tokens_per_sec), 1),
                    gpu_name=b.gpu_name,
                    quant=b.quant,
                    measured_at=b.measured_at,
                    n_runs=b.n_runs,
                    quality_source=model.quality_source,
                    quality_n=model.quality_n,
                    quality_ci=model.quality_ci,
                )
            )
        return results[:limit]

    # For quality or efficiency: rank ONLY rows whose quality_source != 'size_estimate'
    models = (
        db.query(Model)
        .filter(Model.quality_source.isnot(None), Model.quality_source != "size_estimate")
        .all()
    )
    if not models:
        return []

    for model in models:
        quants = db.query(ModelQuant).filter(ModelQuant.model_id == model.id).all()
        min_vram_gb = min(q.min_vram_gb for q in quants) if quants else 4.0
        avg_tps_low = (sum(q.est_tps_low for q in quants) / len(quants)) if quants else 10.0
        
        if metric == "efficiency":
            safe_vram = min_vram_gb if min_vram_gb > 0 else 0.5
            metric_value = round((float(model.quality_score or 0.5) * 100) / safe_vram, 1)
        else:  # default quality
            metric_value = round(float(model.quality_score or 0.0), 3)

        results.append(
            schemas.LeaderboardItem(
                id=model.id,
                name=model.name,
                ollama_tag=model.ollama_tag,
                family=model.family,
                params_b=model.params_b,
                quality_score=model.quality_score,
                min_vram_gb=min_vram_gb,
                avg_tps_low=avg_tps_low,
                metric_value=metric_value,
                quality_source=model.quality_source,
                quality_n=model.quality_n,
                quality_ci=model.quality_ci,
            )
        )

    results.sort(key=lambda x: x.metric_value, reverse=True)
    return results[:limit]
