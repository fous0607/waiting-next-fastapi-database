
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, SQLALCHEMY_DATABASE_URL
from models import WaitingList, Store
from routers.waiting import get_current_business_date
from main import load_env_file

# Load env vars
load_env_file()

# Re-import to get updated URL
from database import SQLALCHEMY_DATABASE_URL

def cleanup_waiting():
    url = os.environ.get("DATABASE_URL")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        stores = session.query(Store).all()
        for store in stores:
            print(f"Checking store: {store.name}")
            today = get_current_business_date(session, store.id)
            
            # Find all waiting entries for today
            waiting_query = session.query(WaitingList).filter(
                WaitingList.business_date == today,
                WaitingList.status == "waiting",
                WaitingList.store_id == store.id
            )
            
            count = waiting_query.count()
            if count > 0:
                print(f"Found {count} waiting entries to delete.")
                waiting_query.delete(synchronize_session=False)
                session.commit()
                print(f"✅ Deleted {count} entries.")
            else:
                print("No waiting entries found.")
                
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_waiting()
