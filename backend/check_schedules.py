
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import ClassInfo
import json
from datetime import datetime

# Setup DB
from database import SQLALCHEMY_DATABASE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def check_weekday_schedule():
    store_id = 4
    classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == store_id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()

    today_idx = 0 # Monday (If today is Monday, getDay returns 1 in python weekday() returns 0)
    # Python datetime.weekday(): Mon=0, Sun=6.
    # Javascript getDay(): Sun=0, Mon=1.
    
    # Let's verify what 'today' is in the system context.
    # The system uses '2025-12-08'.
    dt = datetime.strptime("2025-12-08", "%Y-%m-%d")
    py_weekday = dt.weekday() # Mon = 0
    
    # Map to the keys used in 'weekday_schedule' JSON
    # Typically: { "mon": true, "tue": true ... }
    weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    today_key = weekdays[py_weekday]
    
    print(f"Checking for Date: 2025-12-08 ({today_key})")
    print("-" * 60)
    print(f"{'ID':<5} | {'Name':<10} | {'Weekday Schedule Status for Today'}")
    print("-" * 60)

    for c in classes:
        schedule = c.weekday_schedule
        is_today_active = True
        
        if schedule:
            if isinstance(schedule, str):
                try:
                    schedule_dict = json.loads(schedule)
                    is_today_active = schedule_dict.get(today_key, False)
                except:
                    print(f"Error parsing json for {c.id}")
            else:
                 # It might be a dict already if sqlalchemy handles JSON type
                 is_today_active = schedule.get(today_key, False)
        
        status = "ACTIVE" if is_today_active else "SKIPPED (Weekday Not Active)"
        print(f"{c.id:<5} | {c.class_name:<10} | {status}")

if __name__ == "__main__":
    check_weekday_schedule()
