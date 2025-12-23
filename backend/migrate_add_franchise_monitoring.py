
import os
import sys
from sqlalchemy import text, inspect
from database import engine

def migrate():
    print("Checking database for 'enable_franchise_monitoring' column in 'store_settings' table...")
    
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('store_settings')]
    
    if 'enable_franchise_monitoring' in columns:
        print("✅ Column 'enable_franchise_monitoring' already exists.")
        return

    print("Column missing. Adding column...")
    
    with engine.connect() as conn:
        # Determine dialect for specific syntax if needed, but standard SQL usually works for simple Add Column
        dialect = engine.dialect.name
        print(f"Database dialect: {dialect}")
        
        try:
            if dialect == 'sqlite':
                # SQLite usually needs simple syntax
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_franchise_monitoring BOOLEAN DEFAULT 1"))
            elif dialect == 'postgresql':
                # PostgreSQL supports BOOLEAN and TRUE/FALSE
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_franchise_monitoring BOOLEAN DEFAULT TRUE"))
            else:
                 # Fallback
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_franchise_monitoring BOOLEAN DEFAULT TRUE"))
                
            conn.commit()
            print("✅ Successfully added 'enable_franchise_monitoring' to 'store_settings'.")
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise e

if __name__ == "__main__":
    migrate()
