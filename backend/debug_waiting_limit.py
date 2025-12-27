
import sys
import os
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from database import Base, SQLALCHEMY_DATABASE_URL
from models import Store, WaitingList, StoreSettings, DailyClosing
from main import load_env_file
from routers.waiting import get_current_business_date
from datetime import datetime

# Load env vars
load_env_file()

# Re-import to get updated URL
from database import SQLALCHEMY_DATABASE_URL

def debug_waiting():
    url = os.environ.get("DATABASE_URL")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        stores = session.query(Store).all()
        print(f"Found {len(stores)} stores.")

        for store in stores:
            print(f"\n--- Store: {store.name} (ID: {store.id}) ---")
            
            # 1. Check Settings
            settings = session.query(StoreSettings).filter(StoreSettings.store_id == store.id).first()
            if settings:
                print(f"Settings: max_waiting_limit={settings.max_waiting_limit}, use_max_waiting_limit={settings.use_max_waiting_limit}")
            else:
                print("Settings: Not found (using defaults?)")

            # 2. Check Business Date
            try:
                today = get_current_business_date(session, store.id)
                print(f"Calculated Business Date: {today}")
            except Exception as e:
                print(f"Error getting business date: {e}")
                continue

            # 3. Check Current Waiting Count
            current_waiting_count = session.query(func.count(WaitingList.id)).filter(
                WaitingList.business_date == today,
                WaitingList.status == "waiting",
                WaitingList.store_id == store.id
            ).scalar()
            
            print(f"Current Waiting Count (Status='waiting'): {current_waiting_count}")
            
            # 4. Check All Records for Today
            all_today_count = session.query(func.count(WaitingList.id)).filter(
                WaitingList.business_date == today,
                WaitingList.store_id == store.id
            ).scalar()
            print(f"Total Records Today (Any Status): {all_today_count}")

            # 5. List some waiting entries if count is high
            if current_waiting_count > 0:
                print("Sample waiting entries:")
                waitings = session.query(WaitingList).filter(
                    WaitingList.business_date == today,
                    WaitingList.status == "waiting",
                    WaitingList.store_id == store.id
                ).limit(5).all()
                for w in waitings:
                    print(f" - ID: {w.id}, Phone: {w.phone}, Registered: {w.registered_at}")

    except Exception as e:
        print(f"❌ Error during debug: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    debug_waiting()
