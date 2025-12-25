from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from sqlalchemy.orm import Session
from auth import get_current_user, require_system_admin, get_current_store
from database import get_db
from models import Store, User
from sse_manager import sse_manager

router = APIRouter()

@router.get("/sse/status")
async def get_sse_status(
    request: Request,
    store_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    현재 SSE 연결 상태 조회
    - Superadmin: 모든 매장 조회 가능 (store_id 파라미터로 특정 매장 지정 가능)
    - 일반 관리자: 자신의 매장만 조회 가능
    """
    # Superadmin인 경우
    if current_user.role == "system_admin":
        if store_id:
            return sse_manager.get_store_status(store_id)
        else:
            # 전체 매장 조회
            return sse_manager.get_all_status()
    
    # 일반 관리자인 경우 - 자신의 매장만 조회
    # get_current_store를 사용하여 사용자의 매장 가져오기
    user_store = await get_current_store(
        current_user=current_user,
        db=db,
        store_id=int(store_id) if store_id and store_id.isdigit() else None,
        request=request
    )
    
    # 자신의 매장 SSE 상태만 반환
    return sse_manager.get_store_status(str(user_store.id))

@router.post("/sse/disconnect/{connection_id}")
async def force_disconnect_client(
    request: Request,
    connection_id: str,
    store_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    특정 SSE 클라이언트 강제 종료
    - Superadmin: 모든 매장의 연결 관리 가능
    - 일반 관리자: 자신의 매장 연결만 관리 가능
    """
    # Superadmin인 경우
    if current_user.role == "system_admin":
        if not store_id:
            raise HTTPException(status_code=400, detail="Store ID is required")
        await sse_manager.force_disconnect(store_id, connection_id)
        return {"message": "Client disconnected", "connection_id": connection_id}
    
    # 일반 관리자인 경우 - 자신의 매장만 관리 가능
    user_store = await get_current_store(
        current_user=current_user,
        db=db,
        store_id=int(store_id) if store_id and store_id.isdigit() else None,
        request=request
    )
    
    await sse_manager.force_disconnect(str(user_store.id), connection_id)
    
    return {"message": "Client disconnected", "connection_id": connection_id}
