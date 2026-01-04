from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from database import get_db, engine
from models import Base
import os

router = APIRouter()

@router.get("/db-check")
def check_database(db: Session = Depends(get_db)):
    """Check database connection and list tables"""
    try:
        # Check connection
        result = db.execute(text("SELECT 1")).scalar()
        
        # Inspect tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # Check specific tables
        has_user_stores = "user_stores" in tables
        has_print_templates = "print_templates" in tables
        
        return {
            "status": "connected",
            "connection_test": result,
            "dialect": engine.dialect.name,
            "tables": tables,
            "checks": {
                "user_stores": has_user_stores,
                "print_templates": has_print_templates
            },
            "env_db_url_set": "DATABASE_URL" in os.environ
        }
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "detail": str(e),
            "traceback": traceback.format_exc()
        }

@router.get("/simulate-login")
def simulate_login(username: str = None, db: Session = Depends(get_db)):
    """Simulate login DB access patterns to find the crash"""
    from models import User, Store
    import traceback
    
    logs = []
    def log(msg):
        logs.append(msg)
        
    try:
        log("Starting simulation...")
        
        # 1. Get User
        if username:
            user = db.query(User).filter(User.username == username).first()
        else:
            user = db.query(User).first()
            if user:
                username = user.username
            
        if not user:
            return {"status": "failed", "detail": "No user found in DB", "logs": logs}
            
        log(f"Found user: {user.username}, Role: {user.role}, Active: {user.is_active}")
        
        # 2. Access Store
        log("Accessing user.store...")
        if user.store:
            log(f"Store: {user.store.name} (Active: {user.store.is_active})")
        else:
            log("No store linked")
            
        # 3. Access Managed Stores (if any)
        log("Accessing user.managed_stores...")
        try:
             # Just iterate to trigger lazy load
            count = len(user.managed_stores)
            log(f"Managed Stores Count: {count}")
        except Exception as e:
            log(f"Error accessing managed_stores: {str(e)}")
            raise e
            
        # 4. Check DateTimes (often issue with SQLite vs Postgres)
        log("Checking timestamps...")
        log(f"Created: {user.created_at}")
        
        return {
            "status": "success",
            "message": "User fetched and relationships accessed safely",
            "logs": logs,
            "user_info": {
                "id": user.id,
                "username": user.username
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e),
            "traceback": traceback.format_exc(),
            "logs": logs
        }

@router.get("/schema/{table_name}")
def get_table_schema(table_name: str):
    """Get schema for a specific table"""
    try:
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            return {"error": f"Table {table_name} not found"}
            
        columns = []
        for col in inspector.get_columns(table_name):
            columns.append({
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col["nullable"],
                "default": str(col["default"])
            })
        return {"table": table_name, "columns": columns}
    except Exception as e:
        return {"error": str(e)}

@router.post("/force-migration")
def force_migration():
    """Force Base.metadata.create_all() AND check for missing columns"""
    logs = []
    try:
        # 1. Ensure tables exist
        Base.metadata.create_all(bind=engine)
        logs.append("create_all completed")
        
        # 2. Check for missing columns (Auto Migration)
        from core.db_auto_migrator import check_and_migrate_table
        from models import StoreSettings, WaitingList, Member, ClassInfo, DailyClosing, User, Store, Notice, NoticeAttachment
        
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
            try:
                check_and_migrate_table(model)
                logs.append(f"Checked {model.__tablename__}")
            except Exception as e:
                logs.append(f"Error checking {model.__tablename__}: {str(e)}")
        
        return {"status": "Migration completed", "logs": logs}
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "traceback": traceback.format_exc(), "logs": logs}

@router.get("/classes/{store_id}")
def debug_classes(store_id: int, db: Session = Depends(get_db)):
    """Debug class filtering logic"""
    from models import ClassInfo
    from routers.waiting import get_current_business_date, filter_classes_by_weekday
    
    # 1. Date
    try:
        today = get_current_business_date(db, store_id)
    except Exception as e:
        today = None
        
    # 2. Raw Classes
    raw_classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == store_id
    ).all()
    
    raw_info = []
    for c in raw_classes:
        raw_info.append({
            "id": c.id,
            "name": c.class_name,
            "is_active": c.is_active,
            "class_type": c.class_type,
            "weekday_schedule": c.weekday_schedule,
        })
        
    # 3. Filtered
    filtered = []
    if today:
        filtered = filter_classes_by_weekday(raw_classes, today, db, store_id)
        
    return {
        "store_id": store_id,
        "business_date": str(today),
        "raw_count": len(raw_classes),
        "filtered_count": len(filtered),
        "raw_classes": raw_info,
        "filtered_ids": [c.id for c in filtered]
    }

@router.get("/stores")
def list_stores(db: Session = Depends(get_db)):
    from models import Store
    stores = db.query(Store).all()
    return [{"id": s.id, "name": s.name} for s in stores]
