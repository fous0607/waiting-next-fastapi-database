import sqlite3
import os

DB_PATH = 'database/waiting_system.db'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(members)")
        columns = [info[1] for info in cursor.fetchall()]
        print(f"Current columns in members: {columns}")

        if 'barcode' not in columns:
            print("Adding barcode column to members table...")
            cursor.execute("ALTER TABLE members ADD COLUMN barcode VARCHAR")
            # SQLite CREATE INDEX logic
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_members_barcode ON members (barcode)")
            print("Barcode column added successfully.")
        else:
            print("barcode column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    migrate()
