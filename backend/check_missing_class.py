from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, joinedload
from models import Store, WaitingList, Member

from database import SQLALCHEMY_DATABASE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def check_class_info():
    target_date = "2025-12-08"
    store_name = "서울목동지점"
    missing_number = 5
    
    store = db.query(Store).filter(Store.name == store_name).first()
    
    entry = db.query(WaitingList).options(joinedload(WaitingList.member)).filter(
        WaitingList.store_id == store.id,
        WaitingList.waiting_number == missing_number,
    ).order_by(WaitingList.registered_at.desc()).first()

    if entry:
        print(f"entry ID: {entry.id}")
        print(f"Waiting Number: {entry.waiting_number}")
        print(f"Class ID: {entry.class_id}")
        print(f"Status: {entry.status}")
        
if __name__ == "__main__":
    try:
        check_class_info()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
