"""
Idempotent migration script to add rich metadata and store-style fields to models
and hardware/run details to benchmark_results.
Works seamlessly across PostgreSQL and SQLite. Never drops tables.
"""
import sys
import os
import time
from sqlalchemy import text, inspect

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine

def run_migration(max_retries: int = 3):
    dialect_name = engine.dialect.name
    print(f"Running model fields migration on database dialect: {dialect_name}")

    model_cols = [
        ("tagline", "TEXT"),
        ("about", "TEXT"),
        ("publisher", "TEXT"),
        ("released_at", "TIMESTAMP"),
        ("hf_updated_at", "TIMESTAMP"),
        ("languages", "TEXT"),
        ("capabilities", "TEXT"),
        ("hf_tags", "TEXT"),
        ("hf_url", "TEXT"),
        ("ollama_library_url", "TEXT"),
        ("enriched_at", "TIMESTAMP"),
        ("enriched_from", "TEXT"),
    ]

    benchmark_cols = [
        ("machine_label", "TEXT"),
        ("ram_gb", "FLOAT"),
        ("offload_fraction", "FLOAT"),
        ("peak_vram_gb", "FLOAT"),
        ("measured_at", "TIMESTAMP"),
        ("ac_plugged", "BOOLEAN"),
        ("n_runs", "INTEGER"),
    ]

    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                with conn.begin():
                    if dialect_name == "postgresql":
                        # 1. Update models table
                        for col_name, col_type in model_cols:
                            conn.execute(text(f"ALTER TABLE models ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                        
                        # 2. Update benchmark_results table
                        for col_name, col_type in benchmark_cols:
                            conn.execute(text(f"ALTER TABLE benchmark_results ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))

                        # 3. Create unique index on benchmark_results (machine_label, model_id, quant)
                        conn.execute(text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmark_machine_model_quant "
                            "ON benchmark_results (machine_label, model_id, quant);"
                        ))

                    else:  # sqlite and others
                        inspector = inspect(conn)
                        
                        existing_model_cols = {c["name"] for c in inspector.get_columns("models")}
                        for col_name, col_type in model_cols:
                            if col_name not in existing_model_cols:
                                conn.execute(text(f"ALTER TABLE models ADD COLUMN {col_name} {col_type};"))

                        existing_bench_cols = {c["name"] for c in inspector.get_columns("benchmark_results")}
                        for col_name, col_type in benchmark_cols:
                            if col_name not in existing_bench_cols:
                                conn.execute(text(f"ALTER TABLE benchmark_results ADD COLUMN {col_name} {col_type};"))

                        # Create unique index if not exists
                        conn.execute(text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmark_machine_model_quant "
                            "ON benchmark_results (machine_label, model_id, quant);"
                        ))

            print("Migration completed successfully.")
            return
        except Exception as e:
            last_err = e
            print(f"Migration attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                time.sleep(2.0)

    raise last_err

if __name__ == "__main__":
    run_migration()
