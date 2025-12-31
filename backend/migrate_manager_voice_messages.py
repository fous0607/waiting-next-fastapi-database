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
        # Add manager_calling_voice_message
        try:
            cursor.execute("ALTER TABLE store_settings ADD COLUMN manager_calling_voice_message TEXT DEFAULT '{순번}번 {회원명}님, 호출되었습니다.'")
            print("Added manager_calling_voice_message column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("Column manager_calling_voice_message already exists.")
            else:
                raise e

        # Add manager_entry_voice_message
        try:
            cursor.execute("ALTER TABLE store_settings ADD COLUMN manager_entry_voice_message TEXT DEFAULT '{순번}번 {회원명}님, 입장해주세요.'")
            print("Added manager_entry_voice_message column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("Column manager_entry_voice_message already exists.")
            else:
                raise e
        
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
