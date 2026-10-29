"""
Logic for fetching model recommendations based on user hardware.
"""
from sqlalchemy.orm import Session
from models import Model, ModelQuant
from services.verdict import get_verdict, get_best_quant_for_hardware

def get_recommendations(
    db: Session,
    user_vram: float,
    user_ram: float,
    task: str | None = None,
    limit: int = 5
) -> list:
    """
    Returns a list of recommended models based on hardware constraints.
    """
    # 1. Query model_quants where min_vram_gb <= user_vram
    quants_query = db.query(ModelQuant).filter(ModelQuant.min_vram_gb <= user_vram)
    
    # 2. Join with models table
    quants_query = quants_query.join(Model)
    
    # 3. If task is provided: filter models where tasks ILIKE %task%
    if task:
        quants_query = quants_query.filter(Model.tasks.ilike(f"%{task}%"))
        
    all_quants = quants_query.all()
    
    # 4. Get unique models from the quant results
    models_dict = {}
    for q in all_quants:
        if q.model_id not in models_dict:
            models_dict[q.model_id] = {
                "model": q.model,
                "quants": []
            }
        models_dict[q.model_id]["quants"].append(q)
        
    results = []
    
    # 5. For each model compute the verdict using get_verdict() using the best fitting quant
    for model_id, data in models_dict.items():
        model = data["model"]
        quants = data["quants"]
        
        best_quant = get_best_quant_for_hardware(quants, user_vram, user_ram)
        if not best_quant:
            continue
            
        verdict_data = get_verdict(
            user_vram=user_vram,
            user_ram=user_ram,
            min_vram=best_quant.min_vram_gb,
            rec_vram=best_quant.rec_vram_gb,
            min_ram=best_quant.min_ram_gb,
            rec_ram=best_quant.rec_ram_gb
        )
        
        import json
        parsed_tasks = []
        if model.tasks:
            try:
                parsed_tasks = json.loads(model.tasks) if model.tasks.startswith("[") else [t.strip() for t in model.tasks.split(",") if t.strip()]
            except Exception:
                parsed_tasks = [t.strip() for t in model.tasks.split(",") if t.strip()]

        results.append({
            "model_id": model.id,
            "name": model.name,
            "ollama_tag": model.ollama_tag,
            "family": model.family,
            "params_b": model.params_b,
            "description": model.description or f"{model.name} {model.params_b}B parameters model",
            "tasks": parsed_tasks,
            "downloads": model.downloads_last_month or 0,
            "downloads_last_month": model.downloads_last_month or 0,
            "quality_score": model.quality_score,
            "best_quant": best_quant.quant,
            "best_quant_size_gb": best_quant.size_gb,
            "est_tps_low": best_quant.est_tps_low,
            "verdict": verdict_data["verdict"],
            "min_vram_gb": best_quant.min_vram_gb,
            "rec_vram_gb": best_quant.rec_vram_gb,
        })
        
    # 6. Order by quality_score DESC
    results.sort(key=lambda x: x["quality_score"], reverse=True)
    
    # 7. Return top `limit` models
    return results[:limit]
