from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from models import WaitingList, Member
from datetime import datetime, timedelta, date
import sqlite3 # Added import for sqlite3

# Database connection
SQLALCHEMY_DATABASE_URLconn = sqlite3.connect('database/waiting_system.db')
engine = create_engine(SQLALCHEMY_DATABASE_URL) # This line will now fail as SQLALCHEMY_DATABASE_URL is undefined
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def debug_attendance():
    # Target phone number from screenshot
    target_phone = "01000000001" # Assuming DB stores without hyphens, or check both
    
    # Try looking up member
    member = db.query(Member).filter(Member.phone == target_phone).first()
    if not member:
        print(f"Member with phone {target_phone} not found.")
        # Try with hyphens just in case
        target_phone_hyphen = "010-0000-0001"
        member = db.query(Member).filter(Member.phone == target_phone_hyphen).first()
        if not member:
             print(f"Member with phone {target_phone_hyphen} not found either.")
             return

    print(f"Found Member: ID={member.id}, Name={member.name}, Phone={member.phone}")

    # Set reference date (Today)
    # Assuming today is used in the logic
    # In the router, it uses 'business_date' passed to the API. 
    # Usually manage page requests for 'today'.
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    
    print(f"Checking records from {thirty_days_ago} to {today}")

    # Query attendance records
    records = db.query(WaitingList).filter(
        WaitingList.member_id == member.id,
        WaitingList.status == 'attended',
        WaitingList.business_date >= thirty_days_ago,
        WaitingList.business_date <= today
    ).order_by(WaitingList.business_date.desc(), WaitingList.created_at.desc()).all()

    print(f"Total Count: {len(records)}")
    print("-" * 50)
    for r in records:
        print(f"ID: {r.id}, Date: {r.business_date}, Status: {r.status}, CreatedAt: {r.created_at}")
    print("-" * 50)

    # Check current waiting item #32
    print("Checking current waiting item #32:")
    current_waiting = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.waiting_number == 32,
        WaitingList.status == 'waiting' # Assuming it's still waiting as per screenshot
    ).first()
    
    if current_waiting:
        print(f"Current Waiting Item: ID={current_waiting.id}, MemberID={current_waiting.member_id}, Status={current_waiting.status}")
    else:
        print("Waiting item #32 with status 'waiting' not found.")

if __name__ == "__main__":
    debug_attendance()
