from sqlalchemy.orm import Session
from datetime import date
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Holiday

def remove_holiday(store_id: int):
    db = SessionLocal()
    try:
        today = date.today()
        print(f"Removing holiday for Store {store_id} on {today}...")

        holiday = db.query(Holiday).filter(
            Holiday.store_id == store_id,
            Holiday.date == today
        ).first()

        if holiday:
            db.delete(holiday)
            db.commit()
            print(f"Removed holiday: {holiday.name} (ID: {holiday.id})")
        else:
            print("No holiday found for today.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    remove_holiday(1)
