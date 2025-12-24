from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from auth import require_system_admin
from models import Store, User
from sse_manager import sse_manager

router = APIRouter()

@router.get("/sse/status")
async def get_sse_status(
    store_id: Optional[str] = None,
    current_user: User = Depends(require_system_admin)
):
    """
    현재 SSE 연결 상태 조회 (Superadmin 전용)
    - store_id가 있으면 특정 매장만 조회
    - store_id가 없으면 전체 매장 조회
    """
    if store_id:
        return sse_manager.get_store_status(store_id)
    else:
        # 전체 매장 조회
        return sse_manager.get_all_status()

@router.post("/sse/disconnect/{connection_id}")
async def force_disconnect_client(
    connection_id: str,
    store_id: Optional[str] = None,
    current_user: User = Depends(require_system_admin)
):
    """
    특정 SSE 클라이언트 강제 종료 (Superadmin 전용)
    """
    if not store_id:
        raise HTTPException(status_code=400, detail="Store ID is required")

    await sse_manager.force_disconnect(store_id, connection_id)
    
    return {"message": "Client disconnected", "connection_id": connection_id}
