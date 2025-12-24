from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from auth import get_current_store, get_current_active_user
from models import Store, User
from sse_manager import sse_manager

router = APIRouter()

@router.get("/sse/status")
async def get_sse_status(
    store_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    현재 SSE 연결 상태 조회
    - Superadmin: 모든 매장 또는 특정 매장 조회 가능
    - Manager: 자신의 매장만 조회 가능
    """
    if current_user.role == "superadmin":
        if store_id:
            return sse_manager.get_store_status(store_id)
        else:
            # 전체 매장 조회
            return sse_manager.get_all_status()
    else:
        # 일반 관리자는 자신의 매장만 조회
        if not current_user.store_id:
             raise HTTPException(status_code=403, detail="매장이 할당되지 않은 사용자입니다.")
        return sse_manager.get_store_status(str(current_user.store_id))

@router.post("/sse/disconnect/{connection_id}")
async def force_disconnect_client(
    connection_id: str,
    store_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    특정 SSE 클라이언트 강제 종료 (재연걸 유도)
    """
    target_store_id = None
    
    if current_user.role == "superadmin":
         target_store_id = store_id 
    else:
         if not current_user.store_id:
             raise HTTPException(status_code=403, detail="권한이 없습니다.")
         target_store_id = str(current_user.store_id)
         
    if not target_store_id:
        raise HTTPException(status_code=400, detail="Store ID is required")

    await sse_manager.force_disconnect(target_store_id, connection_id)
    
    return {"message": "Client disconnected", "connection_id": connection_id}
