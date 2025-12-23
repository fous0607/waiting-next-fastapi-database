```python

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, ClassInfo

SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def analyze_assignment_logic():
    target_date = "2025-12-08"
    store_name = "서울목동지점"
    
    # 1. Get Store
    store = db.query(Store).filter(Store.name == store_name).first()
    
    # 2. Get Waiting Number 5's registration time
    number_5 = db.query(WaitingList).filter(
        WaitingList.store_id == store.id,
        WaitingList.waiting_number == 5
    ).first()
    
    if not number_5:
        print("Waiting Number 5 not found.")
        return

    reg_time_5 = number_5.registered_at
    print(f"Waiting Number 5 Registered at: {reg_time_5}")
    print(f"Assigned to Class ID: {number_5.class_id} (3교시)")
    
    # 3. Check capacities of 1st and 2nd period
    class_ids = [30, 31, 32] # 1, 2, 3 period
    classes = db.query(ClassInfo).filter(ClassInfo.id.in_(class_ids)).all()
    class_map = {c.id: c for c in classes}
    
    print("\n--- Class Status at Registration Time ---")
    
    for cid in class_ids:
        c = class_map.get(cid)
        if not c: continue
        
        # Count how many active waiting users were assigned to this class *before* number 5 registered
        # Active means: registered_at <= reg_time_5 AND (status='waiting' OR (status in ['attended', 'cancelled'] AND updated_at > reg_time_5))
        # Actually, a simpler approximation is: count all registered today in this class with waiting_number < 5
        # logic: The system assigns classes based on *current* count at the moment of registration.
        
        # approximate "count at that moment"
        count_at_moment = db.query(WaitingList).filter(
            WaitingList.store_id == store.id,
            WaitingList.class_id == cid,
            WaitingList.registered_at < reg_time_5,
            # We assume they were valid 'waiting' members at that time.
            # If they were cancelled *before* 5 registered, spot would be free? 
            # Usually cancellation frees up a spot.
            # let's just count who was 'waiting' or 'attended' (assuming attended happened later)
             # or cancelled LATER.
        ).count()
        
        # Refined Logic:
        # We need to filter out those who were ALREADY cancelled/attended/no_show *before* 10:30:45.
        # If they were cancelled before 10:30:45, they didn't take up space.
        # But 'updated_at' is when status changed.
        
        active_count = 0
        entries = db.query(WaitingList).filter(
            WaitingList.store_id == store.id,
            WaitingList.class_id == cid,
            WaitingList.registered_at < reg_time_5
        ).all()
        
        for e in entries:
            # Check if this person was occupying a seat at reg_time_5
            # Occupying if:
            # 1. Status was 'waiting' at that time.
            # 2. Or if they attended/cancelled AFTER that time.
            
            # If e.updated_at < reg_time_5 and status is NOT waiting, then they freed the seat?
            # Wait, if status is 'attended', they still occupy the seat (capacity limit includes attendees usually? or just waiting list?)
            # The system likely limits "Waiting + Attended" or just "Waiting"?
            # Typically class capacity = Max attendees.
            
            # Let's assume simplest 'Waiting' count logic usually used.
            # If they were cancelled before, they are out.
            if e.status in ['cancelled', 'no_show'] and e.updated_at < reg_time_5:
                continue # They left before #5 came
                
            active_count += 1
            
        print(f"{c.class_name} (ID {c.id}): Capacity {c.max_capacity} | Occupied at that time: ~{active_count}")

    # 4. Check number 6
    number_6 = db.query(WaitingList).filter(
        WaitingList.store_id == store.id,
        WaitingList.waiting_number == 6
    ).first()
    if number_6:
        print(f"\nWaiting Number 6 Registered at: {number_6.registered_at}")
        print(f"Assigned to Class ID: {number_6.class_id} (1교시)")


if __name__ == "__main__":
    analyze_assignment_logic()
    db.close()
