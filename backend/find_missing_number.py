from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, joinedload
from models import Store, WaitingList, Member

SQLALCHEMY_DATABASE_URL = "sqlite:///./database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def find_missing_number():
    target_date = "2025-12-08"
    store_name = "서울목동지점"
    missing_number = 5
    
    print(f"--- Searching for Waiting Number {missing_number} in {store_name} on {target_date} ---")

    # 1. Find Store
    store = db.query(Store).filter(Store.name == store_name).first()
    if not store:
        print(f"Store '{store_name}' not found.")
        return
    
    print(f"Store ID: {store.id}")

    # 2. Find the entry with waiting_number 5
    # Note: waiting_number is usually unique per store/date reset logic, but let's check by ID and date roughly if needed.
    # Assuming waiting_number is simple integer sequence for the day.
    
    # We'll search for all entries for this store created today to be sure, then filter by waiting_number
    # actually, waiting_number is a column in WaitingList.
    
    entry = db.query(WaitingList).options(joinedload(WaitingList.member)).filter(
        WaitingList.store_id == store.id,
        WaitingList.waiting_number == missing_number,
        # We need to ensure it's the *current* sequence. 
        # Usually filtered by registered_at date roughly, or just look at the latest one.
    ).order_by(WaitingList.registered_at.desc()).first()

    if entry:
        print(f"Found Entry for Waiting Number {missing_number}:")
        print(f"  - Status: {entry.status}")
        print(f"  - Name: {entry.member.name if entry.member else '(Guest)'}")
        print(f"  - Phone: {entry.phone}")
        print(f"  - Registered At: {entry.registered_at}")
        print(f"  - Updated At: {entry.updated_at}")
        
        if entry.status == 'cancelled':
            print(f"  - Cancelled At: {entry.cancelled_at}")
        elif entry.status == 'attended':
            print(f"  - Attended At: {entry.attended_at}")
            
    else:
        print(f"No entry found with waiting_number {missing_number} for this store.")
        
        # Let's list all today's entries to see the sequence
        print("\n--- Listing All Entries for Today ---")
        entries = db.query(WaitingList).filter(
            WaitingList.store_id == store.id,
        ).all()
        
        # Filter manually for today (simplest way without import datetime logic complexity in query if not strictly needed)
        today_entries = [e for e in entries if str(e.registered_at).startswith(target_date)]
        
        for e in today_entries:
            print(f"  # {e.waiting_number} | Status: {e.status} | Time: {e.registered_at.strftime('%H:%M:%S')}")

if __name__ == "__main__":
    try:
        find_missing_number()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
