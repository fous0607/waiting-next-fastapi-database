
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, ClassInfo, ClassClosure, DailyClosing
from datetime import datetime
from sqlalchemy import func

# Setup DB
SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def debug_class_assignment():
    store_id = 4 # Based on previous context (Store ID 4)
    business_date = "2025-12-08"
    
    print(f"--- Debugging Class Assignment for Store {store_id} on {business_date} ---")

    # 1. Get All Active Classes
    classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == store_id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()
    
    print("\n[Configuration]")
    for c in classes:
        print(f"Class {c.class_number}교시 (ID: {c.id}): Name='{c.class_name}', Start='{c.start_time}', Max={c.max_capacity}")

    # 2. Check Closures
    closures = db.query(ClassClosure).filter(
        ClassClosure.store_id == store_id,
        ClassClosure.business_date == business_date
    ).all()
    closed_ids = [c.class_id for c in closures]
    print(f"\n[Closures] Closed Class IDs: {closed_ids}")

    # 3. Analyze Occupancy
    print("\n[Occupancy Analysis]")
    for c in classes:
        if c.id in closed_ids:
            print(f"Class {c.class_name} (ID {c.id}): CLOSED")
            continue
            
        # Count Occupancy (Waiting + Called + Attended)
        count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == c.id,
            WaitingList.business_date == business_date,
            WaitingList.store_id == store_id,
            WaitingList.status.in_(['waiting', 'called', 'attended'])
        ).scalar()
        
        status = "FULL" if count >= c.max_capacity else "AVAILABLE"
        print(f"Class {c.class_name} (ID {c.id}): {count}/{c.max_capacity} -> {status}")
        
        if c.class_name == "4교시" or "4" in c.class_name:
            print(f"   >>> DEEP DIVE 4th Period <<<")
            # List all users in 4th period
            users = db.query(WaitingList).filter(
                WaitingList.class_id == c.id,
                WaitingList.business_date == business_date,
                WaitingList.store_id == store_id
            ).all()
            for u in users:
                print(f"      - User {u.id}, Status: {u.status}, Phone: {u.phone}")

if __name__ == "__main__":
    debug_class_assignment()
