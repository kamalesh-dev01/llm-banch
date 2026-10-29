"""
Idempotent migration script to update hardware_sessions table for scan sessions.
Adds status, expires_at, vram_source columns and ensures spec columns are nullable.
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
    print(f"Running migration on database dialect: {dialect_name}")

    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                with conn.begin():
                    if dialect_name == "postgresql":
                        # 1. Add columns if they do not exist
                        conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'complete';"))
                        conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;"))
                        conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN IF NOT EXISTS vram_source VARCHAR DEFAULT 'scanner';"))
                        
                        # 2. Make columns nullable
                        nullable_cols = ["gpu_name", "vram_gb", "ram_gb", "cpu_name", "cpu_cores", "os", "disk_total_gb", "disk_free_gb"]
                        for col in nullable_cols:
                            try:
                                conn.execute(text(f"ALTER TABLE hardware_sessions ALTER COLUMN {col} DROP NOT NULL;"))
                            except Exception as e:
                                print(f"Notice dropping NOT NULL on {col}: {e}")

                    elif dialect_name == "sqlite":
                        inspector = inspect(conn)
                        existing_cols = {col["name"] for col in inspector.get_columns("hardware_sessions")}
                        
                        if "status" not in existing_cols:
                            conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN status VARCHAR DEFAULT 'complete';"))
                        if "expires_at" not in existing_cols:
                            conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN expires_at TIMESTAMP;"))
                        if "vram_source" not in existing_cols:
                            conn.execute(text("ALTER TABLE hardware_sessions ADD COLUMN vram_source VARCHAR DEFAULT 'scanner';"))

            print("Migration completed successfully.")
            return
        except Exception as e:
            last_err = e
            print(f"Connection attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                time.sleep(2.0)

    raise last_err

if __name__ == "__main__":
    run_migration()
