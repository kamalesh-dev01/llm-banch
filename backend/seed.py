"""
Seeds the database with model and quant data from models_seed.json.
Drops and recreates all tables to ensure new columns exist.
"""

import os
import sys
import json
from dotenv import load_dotenv

from sqlalchemy.orm import Session
from database import engine, get_db, Base
from models import Model, ModelQuant

def seed_database():
    """Reads models_seed.json and inserts models and quants into the DB."""
    # 1. Load .env (DATABASE_URL)
    load_dotenv()
    
    # Guard: Never run seed.py in CI or on Render (it drops all tables)
    if os.environ.get("ALLOW_DROP") != "1":
        print("[ERROR] seed.py drops and recreates all database tables! It is guarded and will not run unless ALLOW_DROP=1 is set.")
        print("For production deployments, apply the idempotent migrations in order: migrate_scan_sessions.py, migrate_model_fields.py, migrate_quality_source.py")
        sys.exit(1)

    # 2. Recreate tables to ensure schema matches models.py
    print("Recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✅ Tables recreated with new columns")
    
    # 3. Read models_seed.json
    seed_path = os.path.join(os.path.dirname(__file__), "data", "models_seed.json")
    if not os.path.exists(seed_path):
        print(f"Error: {seed_path} not found.")
        return
        
    with open(seed_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    models_list = data.get("models", [])
    
    # 4. Open a database session
    db: Session = next(get_db())
    
    models_seeded = 0
    quants_seeded = 0
    
    try:
        # For each model in the JSON
        for m_data in models_list:
            ollama_tag = m_data.get("ollama_tag")
            
            # Check if exists
            existing = db.query(Model).filter(Model.ollama_tag == ollama_tag).first()
            if existing:
                print(f"Skipping {m_data.get('name')} — already exists")
                continue
                
            tasks_str = json.dumps(m_data.get("tasks", []))
            
            # Create Model row
            new_model = Model(
                name=m_data.get("name"),
                ollama_tag=ollama_tag,
                family=m_data.get("family"),
                params_b=m_data.get("params_b"),
                context_length=m_data.get("context_length"),
                licence=m_data.get("licence"),
                description=m_data.get("description"),
                hf_model_id=m_data.get("hf_model_id"),
                tasks=tasks_str,
                quality_score=m_data.get("quality_score", 0.5),
                downloads_last_month=m_data.get("downloads_last_month", 0),
                likes=m_data.get("likes", 0)
            )
            
            db.add(new_model)
            # Flush to get the new_model.id
            db.flush()
            
            # Insert Quants
            for q_data in m_data.get("quants", []):
                new_quant = ModelQuant(
                    model_id=new_model.id,
                    quant=q_data.get("quant"),
                    size_gb=q_data.get("size_gb"),
                    min_vram_gb=q_data.get("min_vram_gb"),
                    rec_vram_gb=q_data.get("rec_vram_gb"),
                    min_ram_gb=q_data.get("min_ram_gb"),
                    rec_ram_gb=q_data.get("rec_ram_gb"),
                    est_tps_low=q_data.get("est_tps_low"),
                    est_tps_mid=q_data.get("est_tps_mid"),
                    est_tps_cpu=q_data.get("est_tps_cpu"),
                    ollama_url=q_data.get("ollama_url"),
                    hf_url=q_data.get("hf_url"),
                    gguf_url=q_data.get("gguf_url")
                )
                db.add(new_quant)
                quants_seeded += 1
                
            models_seeded += 1
            print(f"Seeded {new_model.name} with {len(m_data.get('quants', []))} quants.")
            
        # 5. Commit the session
        db.commit()
        print(f"\n✅ Seeded {models_seeded} models and {quants_seeded} quants into Supabase")
        
    except Exception as e:
        print(f"Error seeding database: {str(e)}")
        db.rollback()
    finally:
        # Always close session
        db.close()

if __name__ == "__main__":
    seed_database()
