from database import SessionLocal
from sqlalchemy import text

def enable_all_voice_settings():
    db = SessionLocal()
    try:
        print("Enabling all voice settings for existing stores...")
        query = text("""
            UPDATE store_settings 
            SET 
                keypad_sound_enabled = 1,
                enable_waiting_voice_alert = 1,
                enable_duplicate_registration_voice = 1,
                enable_calling_voice_alert = 1
        """)
        result = db.execute(query)
        db.commit()
        print(f"Updated settings. Rows affected: {result.rowcount}")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    enable_all_voice_settings()
