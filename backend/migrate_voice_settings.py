import sqlite3
import os

DB_PATH = "database/waiting_system.db"

def migrate_db():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Add enable_manager_calling_voice_alert
        try:
            cursor.execute("ALTER TABLE store_settings ADD COLUMN enable_manager_calling_voice_alert BOOLEAN DEFAULT 0")
            print("Added enable_manager_calling_voice_alert column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("Column enable_manager_calling_voice_alert already exists.")
            else:
                raise e

        # Add enable_manager_entry_voice_alert
        try:
            cursor.execute("ALTER TABLE store_settings ADD COLUMN enable_manager_entry_voice_alert BOOLEAN DEFAULT 0")
            print("Added enable_manager_entry_voice_alert column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("Column enable_manager_entry_voice_alert already exists.")
            else:
                raise e

        # Set default values to True if users want them enabled by default, 
        # but user said "Emergency use" so False (default) is appropriate.
        # Actually user said "호출 사용 비상용으로 설정하고 입장 사용 비상으로 설정 할 것" 
        # which implies setting the values? Or just the UI label?
        # Assuming defaults to False is safer.
        
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
