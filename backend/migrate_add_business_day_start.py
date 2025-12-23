import sqlite3

def migrate():
    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'business_day_start' not in columns:
            print("Adding business_day_start column to store_settings table...")
            # 기본값 5 (05:00)
            cursor.execute("ALTER TABLE store_settings ADD COLUMN business_day_start INTEGER DEFAULT 5")
            conn.commit()
            print("Successfully added business_day_start column.")
        else:
            print("business_day_start column already exists.")
            
    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
