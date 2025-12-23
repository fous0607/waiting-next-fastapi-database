from sqlalchemy import create_engine, text, func, and_, or_
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, Member

SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def investigate():
    target_date = "2025-12-08"
    print(f"--- Investigation for {target_date} ---")

    # 1. Find Store
    store = db.query(Store).filter(Store.name == "서울목동지점").first()
    if not store:
        print("Store '서울목동지점' not found. Using '불광지점' or first available for test if needed.")
        store = db.query(Store).first()
    
    print(f"Target Store: {store.name} (ID: {store.id})")
    store_id = store.id

    # 2. Get All WaitingList entries involved in the NEW logic
    # Logic from get_waiting_status (FIXED):
    # Registered today OR Attended today (regardless of reg date)
    # Excludes Cancelled Today if not registered today.
    query = db.query(WaitingList).filter(
        WaitingList.store_id == store_id,
        or_(
            func.date(WaitingList.registered_at) == target_date,
            and_(WaitingList.status == 'attended', func.date(WaitingList.attended_at) == target_date)
        )
    )
    
    results = query.all()
    print(f"Total Records found by 'Total Waiting' logic: {len(results)}")

    # 3. Analyze Status
    status_counts = {}
    for r in results:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    
    print("Breakdown by Status:", status_counts)

    # 4. Analyze New vs Existing Members
    # Logic in API: New Member = Created today (or in period).
    # Ideally, we should check when the member was created.
    
    new_member_count = 0
    existing_member_count = 0
    
    print("\n--- Detailed Record Analysis (First 10) ---")
    for r in results[:10]:
        member_created = "Unknown"
        is_new = False
        if r.member:
            member_created = r.member.created_at.strftime("%Y-%m-%d")
            if member_created == target_date:
                is_new = True
        elif not r.member_id:
             # Logic for non-members? Usually they are considered 'New' or handled differently?
             # API Logic: 
             # new_member_ids = db.query(Member.id).filter(date(created_at) == today)
             # if r.member_id in new_member_ids...
             pass

        print(f"ID: {r.id}, Status: {r.status}, Reg: {r.registered_at}, Attended: {r.attended_at}, Cancelled: {r.cancelled_at}, MemberID: {r.member_id}, MemberCreated: {member_created}")

    # 5. Check Attendance Tab Logic
    attendance_query = db.query(WaitingList).filter(
        WaitingList.store_id == store_id,
        WaitingList.status == 'attended',
        func.date(WaitingList.attended_at) == target_date
    )
    attendance_count = attendance_query.count()
    print(f"\nAttendance Tab Count (status='attended' & attended_at={target_date}): {attendance_count}")

    # 6. Check Current Waiting Logic
    # Filter 'query' (Total Waiting pool) by status='waiting'
    current_waiting_count = 0
    for r in results:
        if r.status == 'waiting':
            current_waiting_count += 1
    print(f"Current Waiting Count (status='waiting' from pool): {current_waiting_count}")
    
    # 7. Check Registered Today but NOT waiting/attended/cancelled today? 
    # (Just raw registered today count)
    registered_today = db.query(WaitingList).filter(
        WaitingList.store_id == store_id,
        func.date(WaitingList.registered_at) == target_date
    ).count()
    print(f"Raw Registered Today Count: {registered_today}")


if __name__ == "__main__":
    try:
        investigate()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
