from sqlalchemy.orm import Session
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import StoreSettings

def check_settings(store_id: int):
    db = SessionLocal()
    try:
        print(f"Checking settings for Store {store_id}...")

        settings = db.query(StoreSettings).filter(
            StoreSettings.store_id == store_id
        ).first()

        if settings:
            print(f"enable_reception_desk: {settings.enable_reception_desk}")
            print(f"enable_waiting_board: {settings.enable_waiting_board}")
        else:
            print("No settings found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_settings(1)
