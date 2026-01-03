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
    """Force Base.metadata.create_all()"""
    try:
        Base.metadata.create_all(bind=engine)
        return {"status": "Migration attempted"}
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "traceback": traceback.format_exc()}
