import sqlite3

def migrate():
    print("Migrating database to add 'theme' column...")
    
    conn = sqlite3.connect('waiting.db')
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'theme' not in columns:
            print("Adding 'theme' column to store_settings table...")
            cursor.execute("ALTER TABLE store_settings ADD COLUMN theme TEXT DEFAULT 'zinc'")
            print("Column added successfully.")
        else:
            print("'theme' column already exists.")
            
        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
