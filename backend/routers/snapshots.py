from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime

from database import get_db
from models import Store, User, StoreSettings, SettingsSnapshot
from auth import get_current_user, get_current_store
from services.audit_service import AuditService

router = APIRouter(tags=["Configuration Snapshots"])

@router.post("", response_model=dict)
async def create_snapshot(
    description: str = Body(..., embed=True),
    current_store: Store = Depends(get_current_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a manual snapshot of current settings.
    """
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == current_store.id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
        
    # Serialize settings
    settings_dict = {c.name: getattr(settings, c.name) for c in settings.__table__.columns}
    # Remove timestamps
    if 'created_at' in settings_dict: del settings_dict['created_at']
    if 'updated_at' in settings_dict: del settings_dict['updated_at']
    
    settings_json = json.dumps(settings_dict, default=str, ensure_ascii=False)
    
    snapshot = SettingsSnapshot(
        store_id=current_store.id,
        created_by=current_user.id,
        settings=settings_json,
        description=description,
        created_at=datetime.now()
    )
    
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    
    # helper for audit (optional here since creating snapshot is safe, but good to log)
    AuditService.log(
        db=db,
        action="create_snapshot",
        target_type="store_settings",
        target_id=snapshot.id,
        user_id=current_user.id,
        store_id=current_store.id,
        new_value={"description": description},
        ip_address=None # Can't get easily without Request, optional
    )
    
    return {"id": snapshot.id, "created_at": snapshot.created_at, "description": description}

@router.get("", response_model=List[dict])
async def list_snapshots(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    List all snapshots for current store.
    """
    snapshots = db.query(SettingsSnapshot, User.username).outerjoin(User, SettingsSnapshot.created_by == User.id)\
        .filter(SettingsSnapshot.store_id == current_store.id)\
        .order_by(SettingsSnapshot.created_at.desc())\
        .all()
        
    result = []
    for snap, username in snapshots:
        result.append({
            "id": snap.id,
            "created_at": snap.created_at,
            "created_by": username or "Unknown",
            "description": snap.description
        })
    return result

from fastapi import Request

@router.post("/{snapshot_id}/restore")
async def restore_snapshot(
    snapshot_id: int,
    request: Request,
    current_store: Store = Depends(get_current_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore settings from a snapshot.
    """
    snapshot = db.query(SettingsSnapshot).filter(
        SettingsSnapshot.id == snapshot_id,
        SettingsSnapshot.store_id == current_store.id
    ).first()
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    current_settings = db.query(StoreSettings).filter(StoreSettings.store_id == current_store.id).first()
    if not current_settings:
        raise HTTPException(status_code=404, detail="Current settings not found")
        
    try:
        data_to_restore = json.loads(snapshot.settings)
        
        # Capture old state for audit
        old_state = {c.name: getattr(current_settings, c.name) for c in current_settings.__table__.columns}
        if 'created_at' in old_state: del old_state['created_at']
        if 'updated_at' in old_state: del old_state['updated_at']
        
        # Apply changes
        for key, value in data_to_restore.items():
            if key in ['id', 'store_id', 'created_at', 'updated_at']:
                continue # Skip metadata
            if hasattr(current_settings, key):
                setattr(current_settings, key, value)
                
        db.commit()
        db.refresh(current_settings)
        
        AuditService.log(
            db=db,
            action="restore_snapshot",
            target_type="store_settings",
            target_id=current_settings.id,
            user_id=current_user.id,
            store_id=current_store.id,
            old_value=old_state,
            new_value={"snapshot_id": snapshot_id, "description": snapshot.description},
            ip_address=request.client.host
        )
        
        return {"message": "Settings restored successfully"}
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid snapshot data")
