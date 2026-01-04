from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from database import get_db, engine
from models import Base, StoreSettings, WaitingList, Member, ClassInfo, DailyClosing, User, Store, Notice, NoticeAttachment, Holiday
import os
import json
from datetime import datetime, date, time, timedelta, timezone

router = APIRouter()

# --- Helper Functions (Copied to avoid import issues) ---
def get_today_date(start_hour: int = 7) -> date:
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    if not (0 <= start_hour <= 23):
        start_hour = 7
    cutoff_time = time(start_hour, 0, 0)
    if now.time() < cutoff_time:
        return (now - timedelta(days=1)).date()
    else:
        return now.date()

def get_current_business_date(db: Session, store_id: int) -> date:
    active_closing = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.is_closed == False
    ).order_by(DailyClosing.business_date.desc()).first()

    if active_closing:
        return active_closing.business_date

    start_hour = 7
    try:
        start_hour_scalar = db.query(StoreSettings.business_day_start).filter(
            StoreSettings.store_id == store_id
        ).scalar()
        if start_hour_scalar is not None:
             start_hour = start_hour_scalar
    except:
        pass
        
    return get_today_date(start_hour)

WEEKDAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}

def parse_weekday_schedule(schedule_str: str):
    if not schedule_str: return {"mon":True,"tue":True,"wed":True,"thu":True,"fri":True,"sat":True,"sun":True}
    try:
        s = json.loads(schedule_str)
        if isinstance(s, dict): return s
    except: pass
    return {"mon":True,"tue":True,"wed":True,"thu":True,"fri":True,"sat":True,"sun":True}

def filter_classes_by_weekday(classes, target_date, db, store_id):
    is_holiday = db.query(Holiday).filter(Holiday.store_id == store_id, Holiday.date == target_date).first()
    filtered = []
    if is_holiday:
        for cls in classes:
            if hasattr(cls, 'class_type') and cls.class_type == 'holiday':
                filtered.append(cls)
        return filtered

    weekday_idx = target_date.weekday()
    weekday = WEEKDAY_MAP[weekday_idx]
    is_weekend = weekday_idx >= 5

    for cls in classes:
        if hasattr(cls, 'class_type'):
            if cls.class_type == 'holiday': continue
            if cls.class_type == 'weekday' and is_weekend: continue
            if cls.class_type == 'weekend' and not is_weekend: continue
            
        schedule = parse_weekday_schedule(cls.weekday_schedule)
        if schedule.get(weekday, True):
            filtered.append(cls)
    return filtered

# --- Endpoints ---

@router.get("/db-check")
def check_database(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1")).scalar()
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {"status": "connected", "connection_test": result, "tables": tables}
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "traceback": traceback.format_exc()}

@router.get("/simulate-login")
def simulate_login(username: str = None, db: Session = Depends(get_db)):
    logs = []
    def log(msg): logs.append(msg)
    try:
        log("Starting simulation...")
        if username:
            user = db.query(User).filter(User.username == username).first()
        else:
            user = db.query(User).first()
        
        if not user: return {"status": "failed", "detail": "No user found", "logs": logs}
        
        log(f"Found user: {user.username}")
        if user.store: log(f"Store: {user.store.name}")
        return {"status": "success", "logs": logs, "user_info": {"id": user.id, "username": user.username}}
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "logs": logs, "traceback": traceback.format_exc()}

@router.get("/schema/{table_name}")
def get_table_schema(table_name: str):
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names(): return {"error": "not found"}
        columns = [{"name": c["name"], "type": str(c["type"])} for c in inspector.get_columns(table_name)]
        return {"table": table_name, "columns": columns}
    except Exception as e: return {"error": str(e)}

@router.post("/force-migration")
def force_migration():
    from core.db_auto_migrator import check_and_migrate_table
    logs = []
    try:
        Base.metadata.create_all(bind=engine)
        models = [StoreSettings, WaitingList, Member, ClassInfo, DailyClosing, User, Store, Notice, NoticeAttachment]
        for m in models:
            try:
                check_and_migrate_table(m)
                logs.append(f"Checked {m.__tablename__}")
            except Exception as e: logs.append(f"Error {m.__tablename__}: {e}")
        return {"status": "Migration completed", "logs": logs}
    except Exception as e: return {"status": "error", "detail": str(e)}

@router.get("/classes/{store_id}")
def debug_classes(store_id: int, db: Session = Depends(get_db)):
    try:
        today = get_current_business_date(db, store_id)
    except: today = None
    
    raw_classes = db.query(ClassInfo).filter(ClassInfo.store_id == store_id).all()
    filtered = []
    if today:
        filtered = filter_classes_by_weekday(raw_classes, today, db, store_id)
        
    return {
        "store_id": store_id,
        "business_date": str(today),
        "raw_count": len(raw_classes),
        "filtered_count": len(filtered),
        "raw_classes": [{"id": c.id, "name": c.class_name, "type": c.class_type, "schedule": c.weekday_schedule} for c in raw_classes],
        "filtered_ids": [c.id for c in filtered]
    }

@router.get("/stores")
def list_stores(db: Session = Depends(get_db)):
    stores = db.query(Store).all()
    return [{"id": s.id, "name": s.name} for s in stores]

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "store_id": u.store_id} for u in users]

@router.post("/fix-classes/{store_id}")
def fix_store_classes(store_id: int, db: Session = Depends(get_db)):
    classes = db.query(ClassInfo).filter(ClassInfo.store_id == store_id).all()
    count = 0
    for cls in classes:
        if cls.class_type == 'weekday':
             cls.class_type = 'all'
             count += 1
    db.commit()
    return {"store_id": store_id, "updated_count": count}
