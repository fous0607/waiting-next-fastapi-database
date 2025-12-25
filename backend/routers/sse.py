from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from sse_manager import sse_manager, event_generator
from database import SessionLocal
from models import Store, StoreSettings

router = APIRouter()


@router.get("/stream")
async def sse_stream(
    request: Request,
    store_id: str = None, 
    channel: str = None,
    role: str = 'unknown'  # 'admin' or 'board' etc
):
    """
    SSE 스트림 엔드포인트
    - store_id: 특정 매장 이벤트 수신
    - channel='system': 시스템 로그 수신 (관리자용)
    - role: 클라이언트 역할 (트래픽 분리용)
    """
    queue = None
    connection_id = None
    resolved_id = None
    
    # 1. 시스템 로그 채널 (Superadmin용)
    if channel == "system":
        print(f"[SSE] System Log Connection Request from {request.client.host if request.client else 'Unknown'}")
        queue = await sse_manager.connect_system()
        
        async def cleanup_system():
            sse_manager.disconnect_system(queue)
            
        response = StreamingResponse(
            event_generator(queue),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "none",
            }
        )
        response.background = BackgroundTask(cleanup_system)
        return response
        
    # 2. 매장 이벤트 채널
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id or channel required")

    print(f"[SSE] Store Connection Request: store_id={store_id}, role={role}, ip={request.client.host if request.client else 'Unknown'}")
    
    db = SessionLocal()
    try:
        # 2-1. store_id 해소 (ID 또는 코드)
        resolved_id = store_id
        if not str(store_id).isdigit():
            store = db.query(Store).filter(Store.code == store_id).first()
            if store:
                resolved_id = str(store.id)
                print(f"[SSE] Resolved store code {store_id} to ID {resolved_id}")
            else:
                raise HTTPException(status_code=404, detail="Store not found")

        # 2-2. 서비스 활성화 여부 및 접속 제한 체크
        settings = db.query(StoreSettings).filter(StoreSettings.store_id == resolved_id).first()
        max_limit = 0 # 0 means unlimited by default in manager logic
        
        if settings:
            if role == 'board' and not settings.enable_waiting_board:
                print(f"[SSE] Access denied: Board is disabled for store_id={resolved_id}")
                raise HTTPException(status_code=403, detail="Waiting board is disabled for this store")
            elif role == 'reception' and not settings.enable_reception_desk:
                print(f"[SSE] Access denied: Reception desk is disabled for store_id={resolved_id}")
                raise HTTPException(status_code=403, detail="Reception desk is disabled for this store")
            
            # 대시보드 역할(admin, board, reception 등)일 경우 제한 적용
            if role in ['admin', 'board', 'reception', 'manager']:
                max_limit = settings.max_dashboard_connections or 2
                
        # 2-3. SSE 매니저 연결 (제한값 및 정책 포함)
        queue, connection_id = await sse_manager.connect(
            resolved_id, 
            role, 
            request, 
            max_connections=max_limit,
            policy=settings.dashboard_connection_policy if settings else "eject_old"
        )
        
    except HTTPException as he:
        # HTTPException은 그대로 다시 던져서 FastAPI가 처리하게 함
        raise he
    except Exception as e:
        print(f"[SSE] Connection process failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

    async def cleanup_store():
        if connection_id:
            sse_manager.disconnect(resolved_id, connection_id)

    # 2-4. SSE 응답 생성
    response = StreamingResponse(
        event_generator(queue, resolved_id, connection_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "none",
        }
    )
    response.background = BackgroundTask(cleanup_store)

    return response
