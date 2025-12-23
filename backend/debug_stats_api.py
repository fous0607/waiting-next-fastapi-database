from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker
from models import Store, WaitingList, Member
from database import SessionLocal
from datetime import date, datetime

db = SessionLocal()

def debug_dashboard_stats(franchise_id, start_date, end_date):
    print(f"--- Debugging Stats for Franchise {franchise_id} ({start_date} ~ {end_date}) ---")
    
    today = date.today()

    # 1. Base Query (Store JOIN)
    base_query = db.query(WaitingList).join(
        Store, WaitingList.store_id == Store.id
    ).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    )

    # 2. Helper Function
    def calculate_stats(query, date_condition, is_current_waiting=False):
        filtered_query = query.filter(date_condition)
        
        # Total Count
        total = filtered_query.count()
        print(f"  [Calc] Total: {total}")

        # Existing Member Count
        threshold_date = today if is_current_waiting else start_date
        
        existing = filtered_query.join(
            Member, WaitingList.member_id == Member.id
        ).filter(
            Member.created_at < datetime.combine(threshold_date, datetime.min.time())
        ).count()
        print(f"  [Calc] Existing: {existing} (Threshold: {threshold_date})")

        # New
        new = total - existing
        return {"total": total, "existing": existing, "new": new}

    # 3. Total Waiting
    print("\n--- Total Waiting ---")
    total_waiting_stats = calculate_stats(
        base_query,
        and_(
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= end_date
        )
    )
    print(f"Result: {total_waiting_stats}")

    # 4. Current Waiting
    print("\n--- Current Waiting ---")
    current_waiting_query = base_query.filter(WaitingList.status == "waiting")
    current_waiting_stats = calculate_stats(
        current_waiting_query,
        WaitingList.business_date == today,
        is_current_waiting=True
    )
    print(f"Result: {current_waiting_stats}")

    # 5. Total Attendance
    print("\n--- Total Attendance ---")
    attendance_query = base_query.filter(WaitingList.status == "attended")
    attendance_stats = calculate_stats(
        attendance_query,
        and_(
            WaitingList.attended_at >= datetime.combine(start_date, datetime.min.time()),
            WaitingList.attended_at <= datetime.combine(end_date, datetime.max.time())
        )
    )
    print(f"Result: {attendance_stats}")

if __name__ == "__main__":
    # Test for Franchise 2 (Beaujem) for Today
    debug_dashboard_stats(2, date.today(), date.today())
