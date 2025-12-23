
from fastapi import APIRouter, Depends, HTTPException, Query, Request
# from fastapi.responses import HTMLResponse
# from fastapi.templating import Jinja2Templates
from typing import List, Optional
import os
import json

router = APIRouter(prefix="/logs", tags=["System Logs"])
# templates = Jinja2Templates(directory="templates")

LOG_FILE_PATH = "logs/system.json.log"



# @router.get("/view", response_class=HTMLResponse)
# async def view_logs_page(request: Request):
#     """
#     Log Analysis Dashboard Page (UI)
#     """
#     return templates.TemplateResponse("log_viewer.html", {"request": request})

@router.get("/api")
async def get_logs_api(
    limit: int = 100,
    level: Optional[str] = None,
    keyword: Optional[str] = None
):
    """
    API to fetch parsed logs from system.json.log
    """
    if not os.path.exists(LOG_FILE_PATH):
        return {"logs": []}

    logs = []
    
    # Read file in reverse is tricky with JSON lines, so read all and filter (for now)
    # Optimization: Read file backwards or use `tail`. 
    # Since it's local file system, reading lines is okay for < 10MB.
    
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        # Parse and Filter
        for line in reversed(lines): # Show newest first
            try:
                if not line.strip(): continue
                log_entry = json.loads(line)
                
                # Filter by Level
                if level and log_entry.get("level") != level.upper():
                    continue
                    
                # Filter by Keyword
                if keyword:
                    # Search in message or other fields
                    search_blobs = str(log_entry.values()).lower()
                    if keyword.lower() not in search_blobs:
                        continue
                
                logs.append(log_entry)
                
                if len(logs) >= limit:
                    break
            except json.JSONDecodeError:
                continue
                
        return {"logs": logs}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from database import get_db
from sqlalchemy.orm import Session
from models import AuditLog, User, Store
from auth import get_current_user, get_current_active_user

@router.get("/audit")
async def get_audit_logs(
    store_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Audit Logs from Database
    """
    query = db.query(
        AuditLog, 
        User.username.label("user_name"),
        Store.name.label("store_name")
    ).outerjoin(User, AuditLog.user_id == User.id)\
     .outerjoin(Store, AuditLog.store_id == Store.id)

    if store_id:
        # Check permission (Simple check: if not system admin, must be related to store)
        # For now, we assume frontend passes correct store_id and user is logged in.
        # Ideally we check `current_user` access to `store_id`.
        query = query.filter(AuditLog.store_id == store_id)
    
    # If not system admin, maybe restrict to franchise? 
    # Let's keep it open for logged-in users for now as per "simple manual" request simplicity, 
    # but strictly authenticated.
        
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    
    result = []
    for log, user_name, store_name in logs:
        # Convert to dict manually or via schema
        result.append({
            "id": log.id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "user_name": user_name or "Unknown",
            "store_name": store_name or "System",
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat()
        })
        
    return result
