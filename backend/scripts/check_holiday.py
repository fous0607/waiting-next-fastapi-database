from sqlalchemy.orm import Session
from datetime import date
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Holiday

def check_holiday(store_id: int):
    db = SessionLocal()
    try:
        today = date.today()
        print(f"Checking holiday for Store {store_id} on {today}...")

        is_holiday = db.query(Holiday).filter(
            Holiday.store_id == store_id,
            Holiday.date == today
        ).first()

        if is_holiday:
            print(f"Result: Today IS a holiday: {is_holiday.name} (ID: {is_holiday.id})")
        else:
            print("Result: Today is NOT a holiday.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_holiday(1)
