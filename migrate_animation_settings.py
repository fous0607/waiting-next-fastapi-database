
import sqlite3
import os

# Database Path
DB_PATH = "backend/waiting_system.db"

def add_column():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "waiting_board_transition_effect" in columns:
            print("Column 'waiting_board_transition_effect' already exists.")
        else:
            print("Adding column 'waiting_board_transition_effect'...")
            cursor.execute("ALTER TABLE store_settings ADD COLUMN waiting_board_transition_effect TEXT DEFAULT 'slide'")
            conn.commit()
            print("Column added successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
