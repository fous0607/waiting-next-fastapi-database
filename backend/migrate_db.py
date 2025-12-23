import sqlite3
import os

from database import DB_FILE_PATH
DB_PATH = DB_FILE_PATH or 'waiting_system.db'

def migrate_db():
    if not os.path.exists(DB_PATH):
        print(f"Database file '{DB_PATH}' not found. Skipping migration.")
        return

    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get existing columns in store_settings
        cursor.execute("PRAGMA table_info(store_settings)")
        columns_info = cursor.fetchall()
        columns = [info[1] for info in columns_info]
        print(f"Existing columns: {columns}")
        
        # Add attendance_count_type if missing
        if 'attendance_count_type' not in columns:
            print("Adding column 'attendance_count_type'...")
            cursor.execute("ALTER TABLE store_settings ADD COLUMN attendance_count_type VARCHAR DEFAULT 'days'")
        else:
            print("Column 'attendance_count_type' already exists.")

        # Add attendance_lookback_days if missing
        if 'attendance_lookback_days' not in columns:
            print("Adding column 'attendance_lookback_days'...")
            cursor.execute("ALTER TABLE store_settings ADD COLUMN attendance_lookback_days INTEGER DEFAULT 30")
        else:
            print("Column 'attendance_lookback_days' already exists.")
            
        conn.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
