from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Dict, Any

from database import get_db
from models import WaitingList, ClassClosure, Store
from routers.waiting import get_current_business_date

router = APIRouter()

@router.get("/sync-check/{store_id}")
async def sync_check(
    store_id: int,
    db: Session = Depends(get_db)
):
    """
    Lightweight endpoint to check for data changes.
    Returns a combined hash/token of relevant timestamps.
    """
    today = get_current_business_date(db, store_id)
    
    # 1. Latest activity in WaitingList (today)
    # Using MAX of created_at as a proxy for any change
    latest_waiting = db.query(func.max(WaitingList.created_at)).filter(
        WaitingList.store_id == store_id,
        WaitingList.business_date == today
    ).scalar()
    
    # 2. Latest class closure (today)
    latest_closure = db.query(func.max(ClassClosure.created_at)).filter(
        ClassClosure.store_id == store_id,
        ClassClosure.business_date == today
    ).scalar()
    
    # 3. Store heartbeat/update
    store_update = db.query(Store.updated_at).filter(Store.id == store_id).scalar()
    
    # 4. Count of active waiters (status change detection)
    # Since we don't have updated_at on WaitingList, count is a reliable way to detect 
    # additions/removals/status changes (if they happen via batch actions that delete/re-add)
    # Better: aggregate status counts
    status_counts = db.query(WaitingList.status, func.count(WaitingList.id)).filter(
        WaitingList.store_id == store_id,
        WaitingList.business_date == today
    ).group_by(WaitingList.status).all()
    
    # Create a stable token string
    token_parts = [
        str(latest_waiting) if latest_waiting else "0",
        str(latest_closure) if latest_closure else "0",
        str(store_update) if store_update else "0",
        str(dict(status_counts))
    ]
    
    sync_token = "|".join(token_parts)
    
    return {
        "sync_token": sync_token,
        "business_date": str(today)
    }
