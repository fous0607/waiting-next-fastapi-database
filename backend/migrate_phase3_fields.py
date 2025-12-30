import sqlite3
import os

def migrate():
    # Database path
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'waiting_system.db')
    print(f"Connecting to database at: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. StoreSettings migration
        print("Checking StoreSettings table for new fields...")
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'party_size_config' not in columns:
            print("Adding 'party_size_config' column to store_settings...")
            cursor.execute("ALTER TABLE store_settings ADD COLUMN party_size_config TEXT")
        
        # 2. WaitingList migration
        print("Checking waiting_list table for new fields...")
        cursor.execute("PRAGMA table_info(waiting_list)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'total_party_size' not in columns:
            print("Adding 'total_party_size' column to waiting_list...")
            cursor.execute("ALTER TABLE waiting_list ADD COLUMN total_party_size INTEGER DEFAULT 0")
            
        if 'party_size_details' not in columns:
            print("Adding 'party_size_details' column to waiting_list...")
            cursor.execute("ALTER TABLE waiting_list ADD COLUMN party_size_details TEXT")

        conn.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
