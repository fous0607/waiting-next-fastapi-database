from sqlalchemy import create_engine, func, desc
from sqlalchemy.orm import sessionmaker
from models import WaitingList, Member, Store
from datetime import datetime, timedelta, date

SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def test_ranking(period, date_str, start_date_str=None, end_date_str=None):
    print(f"\n--- Testing Period: {period}, Date: {date_str} ---")
    
    if not date_str:
        target_date = datetime.now().date()
    else:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        
    start_date = target_date
    end_date = target_date

    if period == 'custom' and start_date_str and end_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    elif period == 'weekly':
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        start_date = target_date.replace(day=1)
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    elif period == 'yearly':
        start_date = target_date.replace(month=1, day=1)
        end_date = target_date.replace(month=12, day=31)
    
    print(f"Calculated Range: {start_date} ({type(start_date)}) ~ {end_date} ({type(end_date)})")

    # Get first store for testing
    current_store = db.query(Store).first()
    if not current_store:
        print("No store found")
        return

    query = db.query(
        Member.name,
        Member.phone,
        func.count(WaitingList.id).label('attendance_count'),
        func.max(WaitingList.attended_at).label('last_attendance')
    ).join(WaitingList, Member.id == WaitingList.member_id).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended',
        func.date(WaitingList.attended_at) >= start_date,
        func.date(WaitingList.attended_at) <= end_date
    )
    
    query = query.group_by(Member.id)
    query = query.order_by(desc('attendance_count'), desc('last_attendance'))
    
    # Print SQL
    print(query.statement.compile(compile_kwargs={"literal_binds": True}))
    
    results = query.all()
    print(f"Results Count: {len(results)}")
    # for r in results:
    #     print(f" - {r.name} ({r.phone}): {r.attendance_count} times, Last: {r.last_attendance}")

    # Check raw waiting list for this range to see if any exist
    raw_count = db.query(WaitingList).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended',
        func.date(WaitingList.attended_at) >= start_date,
        func.date(WaitingList.attended_at) <= end_date
    ).count()
    print(f"Raw 'attended' count in range: {raw_count}")


# Test Cases
today = datetime.now().strftime("%Y-%m-%d")
# test_ranking('daily', today)
# test_ranking('weekly', today)
# test_ranking('monthly', today)
test_ranking('yearly', today)
test_ranking('custom', today, '2025-01-01', '2025-12-31')
