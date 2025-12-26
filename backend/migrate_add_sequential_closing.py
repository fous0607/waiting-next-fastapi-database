import sqlite3
import os

def migrate():
    # Attempting the path: ./backend/database/waiting_system.db
    db_relative_path = './backend/database/waiting_system.db'
    db_path = os.path.abspath(db_relative_path)
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'")
        if not cursor.fetchone():
            print("Table store_settings does not exist in this database.")
            # List tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            print(f"Tables in this DB: {[t[0] for t in tables]}")
            return

        # Add sequential_closing column
        cursor.execute("ALTER TABLE store_settings ADD COLUMN sequential_closing BOOLEAN DEFAULT 0")
        conn.commit()
        print("Successfully added sequential_closing column to store_settings table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column sequential_closing already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
