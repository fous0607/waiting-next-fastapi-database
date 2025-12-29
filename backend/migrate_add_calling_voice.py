from database import SessionLocal
from sqlalchemy import text

def add_column():
    db = SessionLocal()
    try:
        # Check if column exists
        result = db.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        column_name = 'enable_calling_voice_alert'
        
        if column_name not in columns:
            print(f"Adding {column_name} column to store_settings table...")
            # Default to 0 (False) or 1 (True) depending on preference. Usually False if new feature? 
            # Or True to preserve existing behavior?
            # Existing behavior: It was controlled by enable_waiting_voice_alert.
            # To avoid breaking unsuspecting users, maybe default to True?
            # But safer to default False so they opt-in?
            # The USER wants to "apply usage", implying it might be opt-in.
            # Let's set default True to minimize disruption if someone was relying on it, but the UI will control it.
            # Actually, previous logic used 'enable_waiting_voice_alert' for both. 
            # If I add this new col, calling will check THIS col. 
            # If I default to TRUE, it keeps working. If False, it stops.
            # Let's default to FALSE and let the user enable it as per request "make checkbox to apply usage".
            db.execute(text(f"ALTER TABLE store_settings ADD COLUMN {column_name} BOOLEAN DEFAULT 0"))
            db.commit()
            print("Column added successfully.")
        else:
            print("Column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_column()
