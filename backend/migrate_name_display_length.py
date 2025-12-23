"""Add name_display_length column to store_settings table"""

from database import SessionLocal, engine
from sqlalchemy import text

db = SessionLocal()
try:
    # Add the column if it doesn't exist
    db.execute(text("ALTER TABLE store_settings ADD COLUMN name_display_length INTEGER DEFAULT 0"))
    db.commit()
    print("✅ Successfully added name_display_length column")
except Exception as e:
    if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
        print("ℹ️ Column already exists, skipping...")
    else:
        print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()
