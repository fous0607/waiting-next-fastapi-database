from sqlalchemy.orm import Session
from datetime import date
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import ClassInfo
from routers.waiting import filter_classes_by_weekday

def check_classes(store_id: int):
    db = SessionLocal()
    try:
        today = date.today()
        print(f"Checking classes for Store {store_id} on {today}...")

        all_classes = db.query(ClassInfo).filter(
            ClassInfo.store_id == store_id,
        ).all()
        
        print(f"Total classes found in DB: {len(all_classes)}")
        for cls in all_classes:
            print(f"- [{cls.id}] {cls.class_name} ({cls.class_number}교시) Active: {cls.is_active}, Schedule: {cls.weekday_schedule}")

        active_classes = db.query(ClassInfo).filter(
            ClassInfo.store_id == store_id,
            ClassInfo.is_active == True
        ).all()
        
        filtered = filter_classes_by_weekday(active_classes, today, db, store_id)
        
        print(f"Classes available for today ({today.strftime('%A')}): {len(filtered)}")
        for cls in filtered:
            print(f"  -> {cls.class_name}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_classes(1)
