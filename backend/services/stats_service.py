from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from models import DailyClosing, WaitingList, Store, Member
import random

class StatsService:
    @staticmethod
    def get_dashboard_stats(
        db: Session, 
        franchise_id: int, 
        start_date: date, 
        end_date: date, 
        target_store_ids: List[int],
        period: str = "hourly"
    ) -> Dict[str, Any]:
        """
        Calculates dashboard stats including time-based trends and mocked financial data.
        Returns data matching the AnalyticsDashboard schema.
        """
        if not target_store_ids:
            return StatsService._empty_dashboard_stats()

        # 1. Base Data Gathering (Real Data)
        # -------------------------------------------------------------------
        
        # Calculate totals for KPIs
        waiting_query = db.query(WaitingList).filter(
            WaitingList.store_id.in_(target_store_ids),
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= end_date
        )
        all_waitings = waiting_query.all()
        
        total_waiting = len(all_waitings)
        attended_waitings = [w for w in all_waitings if w.status == 'attended']
        total_attendance = len(attended_waitings)
        
        # Open Stores (Active stores in the list)
        total_stores = len(target_store_ids)
        open_stores = db.query(Store).filter(
            Store.id.in_(target_store_ids),
            Store.is_active == True
        ).count()

        # Wait Times
        wait_times = []
        for w in attended_waitings:
            if w.attended_at and w.created_at:
                mins = (w.attended_at - w.created_at).total_seconds() / 60
                if mins >= 0:
                    wait_times.append(mins)
        
        waiting_time_stats = {
            "max": int(max(wait_times)) if wait_times else 0,
            "min": int(min(wait_times)) if wait_times else 0,
            "avg": round(sum(wait_times) / len(wait_times), 1) if wait_times else 0.0
        }

        attendance_time_stats = { # Placeholder as we don't track "attendance time" separately usually
            "max": 0, "min": 0, "avg": 0.0
        }

        # 2. Trend Analysis (Hourly/Daily/etc)
        # -------------------------------------------------------------------
        trends_map = {} # label -> {waiting, attendance}
        
        for w in all_waitings:
            label = ""
            hour_val = 0
            
            if period == "hourly":
                h = w.created_at.hour
                label = f"{h}시"
                hour_val = h
            elif period == "daily":
                label = w.business_date.strftime("%Y-%m-%d")
            elif period == "weekly":
                # Simple Weekly Label
                d = w.business_date
                week_num = d.isocalendar()[1]
                label = f"{d.year}-W{week_num}"
            elif period == "monthly":
                label = w.business_date.strftime("%Y-%m")
            elif period == "quarterly":
                d = w.business_date
                # Fallback if business_date is string (unlikely but possible with some drivers)
                if isinstance(d, str):
                    from datetime import datetime
                    try:
                        d = datetime.strptime(d, "%Y-%m-%d").date()
                    except:
                        pass
                
                if hasattr(d, 'month'):
                    q = (d.month - 1) // 3 + 1
                    label = f"{d.year}-Q{q}"
                else:
                    # Fallback or skip
                    continue
                
            if label not in trends_map:
                trends_map[label] = {"waiting": 0, "attendance": 0, "cancelled": 0, "hour": hour_val}
            
            trends_map[label]["waiting"] += 1
            if w.status == 'attended':
                trends_map[label]["attendance"] += 1
            elif w.status in ['cancelled', 'timeout', 'no_show']: 
                trends_map[label]["cancelled"] += 1
        
        # --- Gap Filling Logic ---
        # Ensure charts show 0s instead of empty if no data
        expected_labels = set()
        curr = start_date
        # Limit loop to avoid infinite in case of error (max 10 years ~ 3650 days)
        # For daily, loop days. For Monthly/Quarterly, loop months (approx).
        
        if period == 'daily':
            while curr <= end_date:
                expected_labels.add(curr.strftime("%Y-%m-%d"))
                curr += timedelta(days=1)
        elif period == 'monthly':
            # Iterate by month
            while curr <= end_date:
                expected_labels.add(curr.strftime("%Y-%m"))
                # Next month
                if curr.month == 12:
                    curr = date(curr.year + 1, 1, 1)
                else:
                    curr = date(curr.year, curr.month + 1, 1)
        elif period == 'quarterly':
            while curr <= end_date:
                q = (curr.month - 1) // 3 + 1
                expected_labels.add(f"{curr.year}-Q{q}")
                # Jump 3 months (simple approx) or safe next month loop
                # Safer: increment month, let calculation handle Q
                if curr.month == 12:
                    curr = date(curr.year + 1, 1, 1)
                else:
                    curr = date(curr.year, curr.month + 1, 1)
        
        for lbl in expected_labels:
            if lbl not in trends_map:
                trends_map[lbl] = {"waiting": 0, "attendance": 0, "cancelled": 0, "hour": 0}

        hourly_stats = []
        if period == "hourly":
            for h in range(24):
                lbl = f"{h}시"
                data = trends_map.get(lbl, {"waiting": 0, "attendance": 0})
                hourly_stats.append({
                    "hour": h,
                    "label": lbl,
                    "waiting_count": data["waiting"],
                    "attendance_count": data["attendance"]
                })
        else:
            for lbl in sorted(trends_map.keys()):
                data = trends_map[lbl]
                hourly_stats.append({
                    "hour": data["hour"],
                    "label": lbl,
                    "waiting_count": data["waiting"],
                    "attendance_count": data["attendance"]
                })

        # 3. Store Comparison (Real Waiting/Attendance + Mocked Financials)
        # -------------------------------------------------------------------
        stores = db.query(Store).filter(Store.id.in_(target_store_ids)).all()
        store_comparison = []
        store_stats = [] # Minimal stats for legacy support if needed

        # Fetch current waiting counts for all target stores efficiently
        current_waiting_rows = db.query(WaitingList.store_id, func.count(WaitingList.id))\
            .filter(WaitingList.store_id.in_(target_store_ids), WaitingList.status == 'waiting')\
            .group_by(WaitingList.store_id).all()
        current_waiting_map = {r[0]: r[1] for r in current_waiting_rows}
        
        # Fetch today's attended counts (for "Currently Attended" / "Today Attended" column)
        today = date.today()
        today_attended_rows = db.query(WaitingList.store_id, func.count(WaitingList.id))\
            .filter(
                WaitingList.store_id.in_(target_store_ids), 
                WaitingList.status == 'attended',
                func.date(WaitingList.business_date) == today # Assuming business_date is Date, but safe to cast/check
            ).group_by(WaitingList.store_id).all()
        today_attended_map = {r[0]: r[1] for r in today_attended_rows}

        for store in stores:
            # Filter waitings for this store
            store_waits = [w for w in all_waitings if w.store_id == store.id]
            s_waiting_count = len(store_waits)
            s_attended_count = len([w for w in store_waits if w.status == 'attended'])
            s_current_waiting = current_waiting_map.get(store.id, 0)
            s_today_attended = today_attended_map.get(store.id, 0)
            
            # --- MOCK FINANCIAL DATA ---
            # Randomize slightly based on store ID to keep it consistent-ish but varied
            random.seed(store.id) 
            base_sales = random.randint(500, 1000) * 10000 # 5M ~ 10M
            s_total_sales = base_sales + (s_attended_count * 15000) # Base + 15k per header
            s_avg_sales = 15000 + random.randint(-2000, 3000)
            
            conversion = (s_attended_count / s_waiting_count * 100) if s_waiting_count > 0 else 0
            
            store_comparison.append({
                "store_id": store.id,
                "store_name": store.name,
                "total_sales": s_total_sales,
                "waiting_count": s_waiting_count,
                "current_waiting": s_current_waiting,
                "attendance_count": s_attended_count,
                "today_attended": s_today_attended,
                "avg_sales_per_person": int(s_total_sales / s_attended_count) if s_attended_count > 0 else 0,
                "conversion_rate": round(conversion, 1)
            })

            # Get actual open time for today
            # Get actual open time for today
            real_open_time = ""
            try:
                today_closing = db.query(DailyClosing).filter(
                    DailyClosing.store_id == store.id,
                    DailyClosing.business_date == today
                ).first()
                
                if today_closing and today_closing.opening_time:
                    # Format to HH:MM
                    real_open_time = today_closing.opening_time.strftime("%H:%M")
            except Exception as e:
                print(f"Error fetching open time for store {store.id}: {e}")
                # Fallback to empty string

            # Minimal stats for legacy/other components
            store_stats.append({
                "store_name": store.name,
                "is_open": store.is_active, # Simplified
                "open_time": real_open_time, 
                "close_time": "22:00",
                "current_waiting": 0, # Not calculating real-time current for this dashboard view
                "total_waiting": s_waiting_count,
                "total_attendance": s_attended_count
            })

        # Sort comparison by Sales desc
        store_comparison.sort(key=lambda x: x['total_sales'], reverse=True)

        # 4. Charts (Mocked)
        # -------------------------------------------------------------------
        payment_stats = {
            "labels": ["카드", "간편결제", "현금", "배달", "기타"],
            "values": [25.3, 25.1, 24.8, 15.9, 8.7],
            "colors": ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"]
        }
        
        channel_stats = {
            "labels": ["매장", "쿠팡이츠", "요기요", "배달의민족"],
            "values": [84.2, 6.0, 5.7, 4.2],
            "colors": ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"]
        }


        from datetime import datetime
        # 4. New Members & Retention (Real Data)
        # -------------------------------------------------------------------
        new_members_count = db.query(Member).filter(
            Member.store_id.in_(target_store_ids),
            Member.created_at >= datetime.combine(start_date, datetime.min.time()),
            Member.created_at <= datetime.combine(end_date, datetime.max.time())
        ).count()

        unique_visiting_members = len(set(w.member_id for w in all_waitings if w.member_id))
        visited_returning = unique_visiting_members - new_members_count
        if visited_returning < 0: visited_returning = 0
        
        retention_rate = (visited_returning / unique_visiting_members * 100) if unique_visiting_members > 0 else 0.0

        # Calculate Total Revenue (Mocked for now since not in DB)
        total_revenue = sum(s['total_sales'] for s in store_comparison)

        return {
            "total_stores": total_stores,
            "open_stores": open_stores,
            "total_waiting": total_waiting,
            "total_attendance": total_attendance,
            "waiting_time_stats": waiting_time_stats,
            "attendance_time_stats": attendance_time_stats,
            "hourly_stats": hourly_stats,
            "store_stats": store_stats,
            "store_comparison": store_comparison,
            "payment_stats": payment_stats,
            "channel_stats": channel_stats,
            "total_revenue": total_revenue,
            "total_visitors": total_waiting,  # total_waiting is visitors approx
            "new_members": new_members_count,
            "retention_rate": round(retention_rate, 1),
            "top_churn_members": []
        }

    @staticmethod
    def _empty_dashboard_stats():
        return {
            "total_stores": 0,
            "open_stores": 0,
            "total_waiting": 0,
            "total_attendance": 0,
            "waiting_time_stats": {"max":0, "min":0, "avg":0},
            "attendance_time_stats": {"max":0, "min":0, "avg":0},
            "hourly_stats": [],
            "store_stats": [],
            "store_comparison": [],
            "payment_stats": None,
            "channel_stats": None,
            "top_churn_members": []
        }
