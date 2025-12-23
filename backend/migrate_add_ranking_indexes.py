import sqlite3
import os

DB_PATH = 'database/waiting_system.db'

def migrate_indexes():
    if not os.path.exists(DB_PATH):
        print(f"Database file '{DB_PATH}' not found. Skipping migration.")
        return

    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check existing indexes on waiting_list
        cursor.execute("PRAGMA index_list('waiting_list')")
        existing_indexes = [row[1] for row in cursor.fetchall()]
        print(f"Existing indexes on waiting_list: {existing_indexes}")
        
        # 1. Index on member_id
        if 'ix_waiting_list_member_id' not in existing_indexes:
            print("Creating index 'ix_waiting_list_member_id'...")
            cursor.execute("CREATE INDEX ix_waiting_list_member_id ON waiting_list (member_id)")
        else:
            print("Index 'ix_waiting_list_member_id' already exists.")
            
        # 2. Index on status
        if 'ix_waiting_list_status' not in existing_indexes:
            print("Creating index 'ix_waiting_list_status'...")
            cursor.execute("CREATE INDEX ix_waiting_list_status ON waiting_list (status)")
        else:
            print("Index 'ix_waiting_list_status' already exists.")
            
        # 3. Index on attended_at
        if 'ix_waiting_list_attended_at' not in existing_indexes:
            print("Creating index 'ix_waiting_list_attended_at'...")
            cursor.execute("CREATE INDEX ix_waiting_list_attended_at ON waiting_list (attended_at)")
        else:
            print("Index 'ix_waiting_list_attended_at' already exists.")

        conn.commit()
        print("Index migration completed successfully.")
        
    except Exception as e:
        print(f"Error during index migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_indexes()
