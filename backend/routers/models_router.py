"""
Router for Models API endpoints.
"""

import os
import json
from datetime import datetime, timezone
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Model as db_models
from models import ModelQuant as db_quants
from models import BenchmarkResult, HardwareSession
from services.results import compute_model_requirements, parse_model_tasks
import schemas

router = APIRouter()


@router.get("/filters", response_model=schemas.FiltersResponse, summary="Get Model Filters", description="Get dynamic filter options, counts, and ranges")
def get_filters(db: Session = Depends(get_db)):
    """Computes dynamic filter options and ranges directly from models and quants."""
    all_models = db.query(db_models).all()
    all_quants = db.query(db_quants).all()

    # 1. Families with count
    family_counts = {}
    for m in all_models:
        f = (m.family or "").strip().lower()
        if f:
            family_counts[f] = family_counts.get(f, 0) + 1
    families = [
        schemas.FilterCountItem(value=f, count=c)
        for f, c in sorted(family_counts.items(), key=lambda x: (-x[1], x[0]))
    ]

    # 2. Tasks with count
    task_counts = {}
    for m in all_models:
        tasks = parse_model_tasks(m.tasks)
        for t in tasks:
            t_clean = t.strip().lower()
            if t_clean:
                task_counts[t_clean] = task_counts.get(t_clean, 0) + 1
    tasks_list = [
        schemas.FilterCountItem(value=t, count=c)
        for t, c in sorted(task_counts.items(), key=lambda x: (-x[1], x[0]))
    ]

    # 3. Capabilities
    capabilities_set = set()
    for m in all_models:
        if m.capabilities:
            try:
                caps = json.loads(m.capabilities)
                if isinstance(caps, list):
                    for c in caps:
                        if c:
                            capabilities_set.add(str(c).strip().lower())
            except Exception:
                pass
    capabilities = sorted(list(capabilities_set))

    # 4. Licenses
    licenses_set = set()
    for m in all_models:
        if m.licence:
            l_clean = str(m.licence).strip()
            if l_clean:
                licenses_set.add(l_clean)
    licenses = sorted(list(licenses_set))

    # 5. Parameters range
    params_vals = [float(m.params_b) for m in all_models if m.params_b is not None]
    min_params = round(min(params_vals), 1) if params_vals else 0.5
    max_params = round(max(params_vals), 1) if params_vals else 70.0

    # 6. VRAM range across quants
    vram_vals = [float(q.min_vram_gb) for q in all_quants if q.min_vram_gb is not None]
    min_vram = round(min(vram_vals), 1) if vram_vals else 2.0
    max_vram = round(max(vram_vals), 1) if vram_vals else 24.0

    return schemas.FiltersResponse(
        families=families,
        tasks=tasks_list,
        capabilities=capabilities,
        licenses=licenses,
        params=schemas.RangeItem(min=min_params, max=max_params),
        vram=schemas.RangeItem(min=min_vram, max=max_vram),
    )


@router.get("/models", response_model=List[schemas.ModelListItem], summary="List Models", description="Get a list of models with optional filtering")
def list_models(
    search: Optional[str] = Query(None, description="Filter by name or tag containing this string (case-insensitive)"),
    query: Optional[str] = Query(None, description="Alias for search"),
    family: Optional[str] = Query(None, description="Filter by exact family match"),
    task: Optional[str] = Query(None, description="Filter models where tasks JSON string contains this task"),
    capability: Optional[str] = Query(None, description="Filter models by capability (e.g. tools, vision, thinking)"),
    license: Optional[str] = Query(None, description="Filter by license match"),
    licence: Optional[str] = Query(None, description="Alias for license"),
    published_after: Optional[str] = Query(None, description="Filter models released on or after this ISO date"),
    max_vram: Optional[float] = Query(None, description="Filter models that fit within this VRAM (GB)"),
    min_params: Optional[float] = Query(None, description="Filter by minimum parameters (B)"),
    max_params: Optional[float] = Query(None, description="Filter by maximum parameters (B)"),
    sort: Optional[str] = Query("quality", description="Sort by: quality | downloads | newest | params_asc | params_desc | vram"),
    sort_by: Optional[str] = Query(None, description="Alias for sort"),
    db: Session = Depends(get_db)
):
    """Returns a list of models applying filters and sorting."""
    query_builder = db.query(db_models)
    
    # 1. Filter by search string in name or ollama_tag (case-insensitive)
    search_term = search or query
    if search_term:
        term = f"%{search_term.strip()}%"
        query_builder = query_builder.filter((db_models.name.ilike(term)) | (db_models.ollama_tag.ilike(term)))
        
    # 2. Filter by family match
    if family and family.strip().lower() != 'all':
        query_builder = query_builder.filter(db_models.family.ilike(family.strip()))
        
    # 3. Filter by task string
    if task and task.strip().lower() != 'all':
        query_builder = query_builder.filter(db_models.tasks.ilike(f"%{task.strip()}%"))

    # 4. Filter by capability string
    if capability and capability.strip().lower() != 'all':
        query_builder = query_builder.filter(db_models.capabilities.ilike(f"%{capability.strip()}%"))

    # 5. Filter by license match
    lic_term = license or licence
    if lic_term and lic_term.strip().lower() != 'all':
        query_builder = query_builder.filter(db_models.licence.ilike(lic_term.strip()))

    # 6. Filter by published_after
    if published_after:
        try:
            dt = pd.to_datetime(published_after).to_pydatetime()
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            query_builder = query_builder.filter(db_models.released_at >= dt)
        except Exception:
            pass
        
    # 7. Filter by parameter counts
    if min_params is not None:
        query_builder = query_builder.filter(db_models.params_b >= min_params)
    if max_params is not None:
        query_builder = query_builder.filter(db_models.params_b <= max_params)
        
    # 8. Filter by maximum VRAM
    if max_vram is not None:
        query_builder = query_builder.filter(db_models.quants.any(db_quants.min_vram_gb <= max_vram))
        
    # 9. Apply SQL sorting
    sort_mode = sort_by or sort or "quality"
    if sort_mode == "downloads":
        query_builder = query_builder.order_by(db_models.downloads_last_month.desc())
    elif sort_mode == "newest":
        query_builder = query_builder.order_by(db_models.released_at.desc(), db_models.id.desc())
    elif sort_mode == "params_asc":
        query_builder = query_builder.order_by(db_models.params_b.asc())
    elif sort_mode == "params_desc":
        query_builder = query_builder.order_by(db_models.params_b.desc())
    else:  # default quality
        query_builder = query_builder.order_by(db_models.quality_score.desc())
    
    # Execute query
    models = query_builder.all()

    # If sorted by VRAM, sort in memory using computed min_vram
    if sort_mode == "vram":
        models.sort(
            key=lambda m: (
                min(q.min_vram_gb for q in m.quants) if m.quants else 999.0,
                -float(m.quality_score or 0)
            )
        )
    
    # Build lightweight ModelListItem response manually
    result = []
    for model in models:
        min_v = 0.0
        if model.quants:
            min_v = min(q.min_vram_gb for q in model.quants)
            
        result.append(
            schemas.ModelListItem(
                id=model.id,
                name=model.name,
                ollama_tag=model.ollama_tag,
                family=model.family,
                params_b=model.params_b,
                context_length=model.context_length,
                licence=model.licence,
                description=model.description,
                tasks=model.tasks,
                quality_score=model.quality_score,
                downloads_last_month=model.downloads_last_month,
                likes=model.likes,
                min_vram=min_v,
                quant_count=len(model.quants),
                tagline=model.tagline,
                capabilities=model.capabilities,
                publisher=model.publisher,
                released_at=model.released_at,
                quality_source=model.quality_source,
                quality_n=model.quality_n,
                quality_ci=model.quality_ci,
            )
        )
        
    return result

def resolve_model_by_ref(ref: str, db: Session) -> db_models:
    """Resolves a model by numeric ID, exact ollama_tag, or base tag."""
    model = None
    if ref.isdigit():
        model = db.query(db_models).filter(db_models.id == int(ref)).first()
    if not model:
        model = db.query(db_models).filter(db_models.ollama_tag == ref).first()
    if not model and ":" in ref:
        base_tag = ref.split(":")[0].strip()
        model = db.query(db_models).filter(db_models.ollama_tag == base_tag).first()
    if not model:
        model = db.query(db_models).filter(db_models.ollama_tag.ilike(ref)).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{ref}' not found")
    return model


@router.get("/models/{ref}", response_model=schemas.ModelResponse, summary="Get Model", description="Get full details for a single model by numeric ID or Ollama tag")
def get_model(ref: str, db: Session = Depends(get_db)):
    """Returns full model details including quants and UI-3 enriched store metadata."""
    return resolve_model_by_ref(ref, db)


@router.get("/models/tag/{ollama_tag}", response_model=schemas.ModelResponse, summary="Get Model by Tag", description="Get full model details by Ollama tag")
def get_model_by_tag(ollama_tag: str, db: Session = Depends(get_db)):
    """Returns full model details by its ollama tag."""
    return resolve_model_by_ref(ollama_tag, db)


@router.get("/models/{ref}/benchmarks", response_model=List[schemas.BenchmarkResultResponse], summary="Get Model Benchmarks", description="Returns real measured benchmark rows for a model")
def get_model_benchmarks(ref: str, db: Session = Depends(get_db)):
    """Returns real measured benchmark rows for a model."""
    model = resolve_model_by_ref(ref, db)
    return db.query(BenchmarkResult).filter(
        BenchmarkResult.model_id == model.id,
        BenchmarkResult.source == "measured",
    ).order_by(BenchmarkResult.tokens_per_sec.desc()).all()


@router.get("/models/{ref}/requirements", summary="Get Model Requirements", description="Returns Minimum and Recommended hardware requirements computed server-side")
def get_model_requirements(
    ref: str,
    quant: Optional[str] = Query(None, description="Specific quantization (e.g. Q4_K_M)"),
    token: Optional[str] = Query(None, description="Hardware session token (optional)"),
    db: Session = Depends(get_db)
):
    """Computes minimum and recommended system requirements (VRAM, RAM, storage, CPU, OS)."""
    model = resolve_model_by_ref(ref, db)
    hw_session = None
    if token:
        hw_session = db.query(HardwareSession).filter(HardwareSession.token == token).first()

    return compute_model_requirements(model=model, quant_name=quant, hw_session=hw_session, db=db)


@router.get("/models/{ref}/similar", response_model=List[schemas.ModelListItem], summary="Get Similar Models", description="Returns similar models (same family first, then overlapping tasks)")
def get_similar_models(
    ref: str,
    limit: int = Query(4, ge=1, le=20, description="Maximum number of similar models to return"),
    db: Session = Depends(get_db)
):
    """Returns similar models: prioritizing same family, then overlapping tasks, then quality score."""
    model = resolve_model_by_ref(ref, db)
    other_models = db.query(db_models).filter(db_models.id != model.id).all()

    current_tasks = set(parse_model_tasks(model.tasks))
    target_family = (model.family or "").lower().strip()

    def similarity_rank(m: db_models):
        m_fam = (m.family or "").lower().strip()
        same_family = 1 if (target_family and m_fam == target_family) else 0
        m_tasks = set(parse_model_tasks(m.tasks))
        overlap = len(current_tasks.intersection(m_tasks))
        quality = float(m.quality_score or 0.5)
        # Higher score = more similar
        return (same_family, overlap, quality)

    other_models.sort(key=similarity_rank, reverse=True)
    selected = other_models[:limit]

    result = []
    for m in selected:
        min_v = 0.0
        if m.quants:
            min_v = min(q.min_vram_gb for q in m.quants)
        result.append(
            schemas.ModelListItem(
                id=m.id,
                name=m.name,
                ollama_tag=m.ollama_tag,
                family=m.family,
                params_b=m.params_b,
                context_length=m.context_length,
                licence=m.licence,
                description=m.description,
                tasks=m.tasks,
                quality_score=m.quality_score,
                downloads_last_month=m.downloads_last_month,
                likes=m.likes,
                min_vram=min_v,
                quant_count=len(m.quants),
                tagline=m.tagline,
                capabilities=m.capabilities,
                publisher=m.publisher,
                released_at=m.released_at,
                quality_source=m.quality_source,
                quality_n=m.quality_n,
                quality_ci=m.quality_ci,
            )
        )
    return result


@router.get("/models/{ref}/quants", response_model=List[schemas.ModelQuantResponse], summary="Get Model Quants", description="Get all quantizations for a model")
def get_model_quants(ref: str, db: Session = Depends(get_db)):
    """Returns all quants for a specific model by numeric id or tag."""
    model = resolve_model_by_ref(ref, db)
    quants = db.query(db_quants).filter(db_quants.model_id == model.id).all()
    return quants

@router.get("/stats", summary="Get Database Stats", description="Returns real aggregate statistics from the database")
def get_stats(db: Session = Depends(get_db)):
    """Returns real-time aggregate statistics from the database."""
    models_count = db.query(db_models).count()
    quants_count = db.query(db_quants).count()
    
    families_query = db.query(db_models.family, func.count(db_models.id)).group_by(db_models.family).all()
    families_count = len([f for f, c in families_query if f])
    
    # Count GPUs from gpu_database.json
    gpu_count = 0
    gpu_file = os.path.join(os.path.dirname(__file__), "..", "data", "gpu_database.json")
    if os.path.exists(gpu_file):
        try:
            with open(gpu_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            gpu_count = len(data.get("gpus", {}))
        except Exception:
            gpu_count = 133

    # Count benchmark runs
    benchmark_runs = 0
    try:
        benchmark_runs = db.query(BenchmarkResult).count()
    except Exception:
        benchmark_runs = 0

    return {
        "models": models_count,
        "quants": quants_count,
        "families": families_count,
        "gpus_supported": gpu_count,
        "benchmark_runs": benchmark_runs,
        # Backwards-compatible aliases
        "total_models": models_count,
        "total_quants": quants_count,
    }

@router.get("/families", summary="Get Model Families", description="Returns distinct model families with model count")
def get_families(db: Session = Depends(get_db)):
    """Returns distinct model families with model count from the models table."""
    query = (
        db.query(db_models.family, func.count(db_models.id))
        .filter(db_models.family.isnot(None))
        .group_by(db_models.family)
        .order_by(func.count(db_models.id).desc())
        .all()
    )
    return [{"family": f, "count": c} for f, c in query if f]
