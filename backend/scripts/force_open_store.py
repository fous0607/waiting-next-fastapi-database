from sqlalchemy.orm import Session
from datetime import datetime, date
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import DailyClosing, Store

def force_open_store(store_id: int):
    db = SessionLocal()
    try:
        today = date.today()
        
        # Check if store exists
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            print(f"Store {store_id} not found.")
            return

        # Check existing closing
        existing = db.query(DailyClosing).filter(
            DailyClosing.store_id == store_id,
            DailyClosing.business_date == today
        ).first()

        if existing:
            if existing.is_closed:
                print(f"Store {store_id} is currently CLOSED for today. Re-opening...")
                existing.is_closed = False
                existing.closing_time = None
                db.commit()
                print("Store re-opened.")
            else:
                print(f"Store {store_id} is already OPEN.")
        else:
            print(f"Opening store {store_id} for today ({today})...")
            new_closing = DailyClosing(
                store_id=store_id,
                business_date=today,
                opening_time=datetime.now(),
                is_closed=False,
                total_waiting=0,
                total_attended=0,
                total_cancelled=0
            )
            db.add(new_closing)
            db.commit()
            print("Store opened.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    force_open_store(1)
