from database import SessionLocal
from sqlalchemy import text

def check_columns():
    db = SessionLocal()
    try:
        result = db.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        print("Columns:", columns)
        
        needed = ['enable_duplicate_registration_voice', 'enable_waiting_voice_alert', 'keypad_sound_enabled', 'enable_calling_voice_alert']
        for n in needed:
            if n not in columns:
                print(f"Missing column: {n}")
                try:
                    print(f"Adding {n}...")
                    db.execute(text(f"ALTER TABLE store_settings ADD COLUMN {n} BOOLEAN DEFAULT 1"))
                    db.commit()
                except Exception as e:
                    print(f"Failed to add {n}: {e}")
            else:
                print(f"Column {n} exists.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_columns()
