from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, Franchise
from database import SessionLocal

db = SessionLocal()

def check_data():
    print("--- Checking Stores ---")
    stores = db.query(Store).all()
    for s in stores:
        print(f"Store: {s.name} (ID: {s.id}, Franchise ID: {s.franchise_id}, Active: {s.is_active})")

    print("\n--- Checking Franchises ---")
    franchises = db.query(Franchise).all()
    for f in franchises:
        print(f"Franchise: {f.name} (ID: {f.id})")

    print("\n--- Checking Waiting List (Today) ---")
    from datetime import date
    today = date.today()
    waitings = db.query(WaitingList).filter(WaitingList.business_date == today).all()
    for w in waitings:
        print(f"Waiting: ID {w.id}, Store ID {w.store_id}, Status {w.status}, Name {w.name}")

    print("\n--- Checking Statistics Logic (Simulated) ---")
    # Simulate get_dashboard_stats for Franchise 1 (assuming Beaujem is 1)
    franchise_id = 1
    store_ids = db.query(Store.id).filter(Store.franchise_id == franchise_id).all()
    store_ids = [s[0] for s in store_ids]
    print(f"Stores for Franchise {franchise_id}: {store_ids}")
    
    total_waiting = db.query(WaitingList).filter(
        WaitingList.store_id.in_(store_ids),
        WaitingList.business_date == today
    ).count()
    print(f"Total Waiting Today for Franchise {franchise_id}: {total_waiting}")

if __name__ == "__main__":
    check_data()
