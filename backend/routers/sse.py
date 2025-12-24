from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from sse_manager import sse_manager, event_generator

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
    
    # 1. 시스템 로그 채널
    if channel == "system":
        print(f"[SSE] System Log Connection Request from {request.client.host}")
        queue = await sse_manager.connect_system()
        
        async def cleanup():
            sse_manager.disconnect_system(queue)
            
    # 2. 매장 이벤트 채널 (기존)
    elif store_id:
        print(f"[SSE] Store Connection Request: store_id={store_id}, role={role}, ip={request.client.host if request.client else 'Unknown'}")
        
        # store_id가 코드(S001 등)일 수 있으므로 ID로 변환 시도
        resolved_id = store_id
        try:
            # 숫자가 아니면 코드로 간주하고 DB에서 조회
            if not str(store_id).isdigit():
                from database import SessionLocal
                from models import Store
                db = SessionLocal()
                try:
                    store = db.query(Store).filter(Store.code == store_id).first()
                    if store:
                        resolved_id = str(store.id)
                        print(f"[SSE] Resolved store code {store_id} to ID {resolved_id}")
                finally:
                    db.close()
        except Exception as e:
            print(f"[SSE] Store ID resolution failed: {e}")

        # Update: connect returns (queue, connection_id)
        queue, connection_id = await sse_manager.connect(resolved_id, role, request)
        
        async def cleanup():
            sse_manager.disconnect(resolved_id, connection_id)
            
    else:
        # 유효하지 않은 요청
        return {"error": "store_id or channel required"}

    # SSE 응답 생성
    response = StreamingResponse(
        event_generator(queue, resolved_id, connection_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "none",
        }
    )

    # 연결 종료 시 cleanup 호출하도록 설정
    response.background = BackgroundTask(cleanup)

    return response
