import sqlite3
import os

def migrate():
    # Path relative to project root
    db_path = "backend/database/waiting_system.db"
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        # Try alternative path just in case
        db_path = "database/waiting_system.db"
        if not os.path.exists(db_path):
             print(f"Database not found at {db_path} either. Aborting.")
             return

    print(f"Connecting to database at {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'detail_mode' not in columns:
            print("Adding detail_mode column to store_settings...")
            # Default to 'standard' (Table mode). Options: 'standard', 'pickup'
            cursor.execute("ALTER TABLE store_settings ADD COLUMN detail_mode VARCHAR DEFAULT 'standard'")
            conn.commit()
            print("Migration successful: detail_mode added.")
        else:
            print("Column detail_mode already exists.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
