"""
Migration script for UI-4b: honest quality data.
Adds quality_source (TEXT), quality_n (INT), quality_ci (FLOAT) to models table.
Backfills quality_source = 'size_estimate' where quality_score equals SIZE_QUALITY_MAP value,
else 'model_card'.
Prints migration counts. Idempotent.
"""
import os
import sys
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import engine, SessionLocal
from models import Model

SIZE_QUALITY_MAP = {
    1.1: 0.42, 
    1.7: 0.45, 
    3.0: 0.50, 
    3.8: 0.52,
    7.0: 0.62, 
    8.0: 0.64, 
    9.0: 0.66, 
    14.0: 0.72
}


def migrate():
    print("=" * 60)
    print("Running migration: UI-4b Honest Quality Data")
    print("=" * 60)

    # 1. Add columns idempotently
    with engine.connect() as conn:
        dialect = engine.dialect.name
        if dialect == "sqlite":
            inspector = inspect(engine)
            existing_cols = [c["name"] for c in inspector.get_columns("models")]
            if "quality_source" not in existing_cols:
                conn.execute(text("ALTER TABLE models ADD COLUMN quality_source TEXT"))
            if "quality_n" not in existing_cols:
                conn.execute(text("ALTER TABLE models ADD COLUMN quality_n INTEGER"))
            if "quality_ci" not in existing_cols:
                conn.execute(text("ALTER TABLE models ADD COLUMN quality_ci FLOAT"))
            conn.commit()
        else:
            conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS quality_source TEXT"))
            conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS quality_n INT"))
            conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS quality_ci FLOAT"))
            conn.commit()
        print("[INFO] Schema verified: columns quality_source, quality_n, quality_ci added or exist.")

    # 2. Backfill quality_source
    db: Session = SessionLocal()
    size_est_count = 0
    model_card_count = 0

    try:
        models = db.query(Model).all()
        for m in models:
            p = round(float(m.params_b), 1) if m.params_b is not None else None
            q = round(float(m.quality_score), 2) if m.quality_score is not None else None
            expected_q = SIZE_QUALITY_MAP.get(p)

            # If quality_score matches the fallback SIZE_QUALITY_MAP value or default 0.55
            if (expected_q is not None and q == expected_q) or q == 0.55:
                m.quality_source = "size_estimate"
                size_est_count += 1
            else:
                m.quality_source = "model_card"
                model_card_count += 1

        db.commit()
        print("\n" + "=" * 60)
        print("MIGRATION QUALITY BACKFILL COUNTS")
        print("=" * 60)
        print(f"Total models processed: {len(models)}")
        print(f"  - quality_source = 'size_estimate': {size_est_count}")
        print(f"  - quality_source = 'model_card'   : {model_card_count}")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
