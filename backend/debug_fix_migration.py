import sys
import os

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from database import engine, Base
from models import StoreSettings, WaitingList, Member, ClassInfo, DailyClosing, User, Store, Notice, NoticeAttachment
from core.db_auto_migrator import check_and_migrate_table
import logging

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fix_migration")

def run_fix():
    print("Starting DB Fix/Migration...")
    
    # 1. Ensure all tables exist
    print("Running create_all to ensure tables exist...")
    Base.metadata.create_all(bind=engine)
    print("create_all completed.")

    # 2. Check and migrate specific tables for missing columns
    models_to_check = [
        StoreSettings, 
        WaitingList, 
        Member, 
        ClassInfo, 
        DailyClosing, 
        User,
        Store,
        Notice,
        NoticeAttachment
    ]

    for model in models_to_check:
        print(f"Checking model: {model.__tablename__}...")
        try:
            check_and_migrate_table(model)
        except Exception as e:
            print(f"Error checking {model.__tablename__}: {e}")

    print("DB Fix/Migration Completed.")

if __name__ == "__main__":
    run_fix()
