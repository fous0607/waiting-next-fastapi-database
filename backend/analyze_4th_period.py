from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, ClassInfo, ClassClosure
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def analyze_4th_period_mistake():
    target_phone = "01044331111" # Assuming normalized
    # Search for variations if not found
    
    print(f"--- Searching for registration of {target_phone} today ---")
    
    today = "2025-12-08"
    
    entries = db.query(WaitingList).filter(
        WaitingList.phone.like("%44331111"), # Suffix search to be safe
        WaitingList.business_date == today
    ).all()
    
    if not entries:
        print("No entry found for 44331111 today.")
        return

    target_entry = entries[-1]
    print(f"Found Entry: ID {target_entry.id}, Phone: {target_entry.phone}")
    print(f"Registered At: {target_entry.registered_at}")
    print(f"Assigned To Class ID: {target_entry.class_id}")
    
    assigned_class = db.query(ClassInfo).get(target_entry.class_id)
    print(f"Assigned Class: {assigned_class.class_name} (ID {assigned_class.id})")
    
    # Identify 4th Period
    store_id = target_entry.store_id
    classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == store_id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()
    
    class_4th = None
    for c in classes:
        if "4교시" in c.class_name and c.id != assigned_class.id: # Find the one they SKIPPED
             class_4th = c
             break
        # Or if assigned is 5th, look for 4th explicitly
        if "4교시" in c.class_name:
            class_4th = c

    if not class_4th:
        print("Could not find 4th Period class definition.")
        return
        
    print(f"\n--- Analyzing 4th Period (ID {class_4th.id}) Status at {target_entry.registered_at} ---")
    print(f"Class: {class_4th.class_name}, Max: {class_4th.max_capacity}")
    
    # 1. Check Closure
    closure = db.query(ClassClosure).filter(
        ClassClosure.class_id == class_4th.id,
        ClassClosure.business_date == today
    ).first()
    if closure:
        print(f"!!! Class was MANUALLY CLOSED at {closure.closed_at} !!!")
    else:
        print("Class was NOT manually closed.")

    # 2. Check Occupancy
    # Count waiting + attended + called
    occupants = db.query(WaitingList).filter(
        WaitingList.class_id == class_4th.id,
        WaitingList.business_date == today,
        WaitingList.registered_at < target_entry.registered_at,
        WaitingList.status.in_(['waiting', 'called', 'attended'])
    ).all()
    
    print(f"Occupancy Count: {len(occupants)} / {class_4th.max_capacity}")
    for o in occupants:
        print(f" - User {o.id} ({o.phone[-4:]}): {o.status}")
        
    if len(occupants) >= class_4th.max_capacity:
        print("=> Class was FULL.")
    else:
        print("=> Class had SPACE. (Why skipped?)")

if __name__ == "__main__":
    analyze_4th_period_mistake()
    db.close()
