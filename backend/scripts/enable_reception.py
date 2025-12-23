from sqlalchemy.orm import Session
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import StoreSettings

def enable_reception(store_id: int):
    db = SessionLocal()
    try:
        print(f"Enabling reception for Store {store_id}...")

        settings = db.query(StoreSettings).filter(
            StoreSettings.store_id == store_id
        ).first()

        if settings:
            settings.enable_reception_desk = True
            settings.enable_waiting_board = True # Might as well enable this too
            db.commit()
            print("Successfully enabled reception desk and waiting board.")
        else:
            print("No settings found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    enable_reception(1)
