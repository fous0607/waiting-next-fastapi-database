from typing import Dict, Set, Optional, List
import asyncio
from fastapi import Request
from starlette.responses import StreamingResponse
import json
from dataclasses import dataclass, field
from datetime import datetime
import uuid

@dataclass
class ConnectionInfo:
    queue: asyncio.Queue
    role: str
    ip: str
    user_agent: str
    connected_at: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

class SSEConnectionManager:
    """SSE 연결 관리자"""

    def __init__(self):
        # store_id: {connection_id: ConnectionInfo}
        # 구조 변경: Role별 그룹화보다 개별 연결 관리가 모니터링에 유리함
        # 브로드캐스트 시에는 .values()에서 role 필터링
        self.active_connections: Dict[str, Dict[str, ConnectionInfo]] = {}
        
        # franchise_id별로 연결된 클라이언트들을 관리 (프랜차이즈 관리자용)
        self.franchise_connections: Dict[str, Set[asyncio.Queue]] = {}
        # 시스템 로그 관찰자들
        self.system_connections: Set[asyncio.Queue] = set()

    # --- Store Channel ---
    async def connect(self, store_id: str, role: str, request: Request = None) -> asyncio.Queue:
        """새로운 SSE 연결 추가 (매장용)"""
        if store_id not in self.active_connections:
            self.active_connections[store_id] = {}
            
        queue = asyncio.Queue()
        
        # 메타데이터 추출
        client_ip = "Unknown"
        user_agent = "Unknown"
        if request:
            client_ip = request.client.host if request.client else "Unknown"
            user_agent = request.headers.get("user-agent", "Unknown")
            
        # 프록시 헤더 확인 (X-Forwarded-For)
        if request and request.headers.get("x-forwarded-for"):
            client_ip = request.headers.get("x-forwarded-for").split(",")[0].strip()

        connection = ConnectionInfo(
            queue=queue,
            role=role,
            ip=client_ip,
            user_agent=user_agent,
            connected_at=datetime.now().isoformat()
        )
        
        # Remove duplicate connections from same IP + role before adding new one
        duplicates_to_remove = []
        for conn_id, conn in self.active_connections[store_id].items():
            if conn.ip == client_ip and conn.role == role:
                duplicates_to_remove.append(conn_id)
                print(f"[SSEManager] Removing duplicate connection: store={store_id}, role={role}, ip={client_ip}, old_id={conn_id}")
        
        for dup_id in duplicates_to_remove:
            del self.active_connections[store_id][dup_id]
        
        self.active_connections[store_id][connection.id] = connection
        print(f"[SSEManager] Connected: store={store_id}, role={role}, ip={client_ip}, id={connection.id}")
        return queue, connection.id

    def disconnect(self, store_id: str, connection_id: str):
        """SSE 연결 제거 (매장용)"""
        if store_id in self.active_connections:
            if connection_id in self.active_connections[store_id]:
                del self.active_connections[store_id][connection_id]
                print(f"[SSEManager] Disconnected: store={store_id}, id={connection_id}")
            
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]

    async def broadcast(self, store_id: str, event_type: str, data: dict = None, franchise_id: str = None, target_role: str = None):
        """
        특정 매장에 이벤트 브로드캐스트 + 프랜차이즈 전파
        - target_role: 특정 역할(admin, board, reception 등)에게만 전송. None이면 모든 역할에게 전송
        """
        message = {
            "event": event_type,
            "data": data or {},
            "store_id": store_id
        }
        
        # 1. 매장 리스너에게 전송
        if store_id in self.active_connections:
            connections = self.active_connections[store_id].values()
            disconnected_ids = []
            
            for conn in connections:
                # 역할 필터링
                if target_role and conn.role != target_role:
                    continue
                    
                try:
                    await conn.queue.put(message)
                    print(f"[SSEManager] Sent '{event_type}' to {conn.role} ({conn.ip})")
                except Exception:
                    disconnected_ids.append(conn.id)
            
            for conn_id in disconnected_ids:
                self.disconnect(store_id, conn_id)
                
        # 2. 프랜차이즈 리스너에게 전송
        if franchise_id:
            await self.broadcast_to_franchise(franchise_id, event_type, data, store_id)

        # DEBUG: Log State
        if store_id in self.active_connections:
            roles = [c.role for c in self.active_connections[store_id].values()]
            print(f"[SSEManager] Broadcast complete. Active roles in store {store_id}: {roles}")
        else:
            print(f"[SSEManager] No active connections for store {store_id}")

    def get_store_status(self, store_id: str) -> List[dict]:
        """매장의 현재 연결 상태 조회"""
        if store_id not in self.active_connections:
            return []
            
        return [
            {
                "id": conn.id,
                "role": conn.role,
                "ip": conn.ip,
                "user_agent": conn.user_agent,
                "connected_at": conn.connected_at
            }
            for conn in self.active_connections[store_id].values()
        ]

    async def force_disconnect(self, store_id: str, connection_id: str):
        """특정 연결 강제 종료 (Reconnect 유도)"""
        if store_id in self.active_connections and connection_id in self.active_connections[store_id]:
            conn = self.active_connections[store_id][connection_id]
            # 강제 종료 메시지 전송 -> 클라이언트가 받고 연결 끊음 
            # (혹은 연결 자체를 끊어야 하는데, queue 방식으론 메시지 보내고 서버측에서 끊는게 나음)
            try:
                # 특별 이벤트 전송
                await conn.queue.put({"event": "force_disconnect", "data": {"reason": "admin_action"}})
            except:
                pass
            
            # 목록에서 제거 (실제 소켓이 끊기진 않지만, 다음 브로드캐스트에서 제외됨. 
            # event_generator는 queue.get()에서 대기중인데, force_disconnect 메시지를 받으면 루프 종료하게 수정 필요)
            # 하지만 event_generator 쪽 수정 없이도, 클라이언트가 force_disconnect 이벤트 받으면 eventSource.close() 하게 하면 됨.
            self.disconnect(store_id, connection_id)

    # --- Franchise Channel (Legacy Support) ---
    async def connect_franchise(self, franchise_id: str) -> asyncio.Queue:
        """프랜차이즈 관리자용 SSE 연결 추가"""
        queue = asyncio.Queue()
        if franchise_id not in self.franchise_connections:
            self.franchise_connections[franchise_id] = set()
        self.franchise_connections[franchise_id].add(queue)
        return queue

    def disconnect_franchise(self, franchise_id: str, queue: asyncio.Queue):
        """프랜차이즈 SSE 연결 제거"""
        if franchise_id in self.franchise_connections:
            self.franchise_connections[franchise_id].discard(queue)
            if not self.franchise_connections[franchise_id]:
                del self.franchise_connections[franchise_id]

    async def broadcast_to_franchise(self, franchise_id: str, event: str, data: dict, store_id: str = None):
        """특정 프랜차이즈에 이벤트 브로드캐스트"""
        message = {
            "event": event,
            "data": data
        }
        if store_id:
            message["store_id"] = store_id
        
        if franchise_id in self.franchise_connections:
            disconnected_queues = []
            for queue in self.franchise_connections[franchise_id]:
                try:
                    await queue.put(message)
                except Exception:
                    disconnected_queues.append(queue)
            
            for q in disconnected_queues:
                self.disconnect_franchise(franchise_id, q)

    # --- System Log (Legacy Support) ---
    async def connect_system(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.system_connections.add(queue)
        return queue

    def disconnect_system(self, queue: asyncio.Queue):
        self.system_connections.discard(queue)

    async def broadcast_system(self, log_entry: dict):
        message = {"event": "log", "data": log_entry}
        disconnected_queues = []
        for queue in self.system_connections:
            try:
                await queue.put(message)
            except Exception:
                disconnected_queues.append(queue)
        for queue in disconnected_queues:
            self.disconnect_system(queue)


# 전역 SSE 매니저 인스턴스
sse_manager = SSEConnectionManager()


async def event_generator(queue: asyncio.Queue, store_id: str = None, connection_id: str = None):
    """SSE 이벤트 스트림 생성기"""
    try:
        # 연결 확인용 초기 메시지
        initial_message = {"event": "connected", "data": {}}
        yield f"data: {json.dumps(initial_message)}\n\n"

        while True:
            try:
                # 30초 heartbeat
                message = await asyncio.wait_for(queue.get(), timeout=30.0)

                # 강제 종료 시그널 처리
                if message.get("event") == "force_disconnect":
                    # 클라이언트에게 종료 메시지 보내고 루프 탈출 -> 스트림 종료 -> 클라이언트 재연결 시도
                    payload = {"event": "force_disconnect", "data": message.get("data", {})}
                    yield f"data: {json.dumps(payload)}\n\n"
                    break

                event_type = message.get("event", "message")
                data = message.get("data", {})
                
                payload = {"event": event_type, "data": data}
                if "store_id" in message:
                    payload["store_id"] = message["store_id"]
                
                yield f"data: {json.dumps(payload)}\n\n"
                
            except asyncio.TimeoutError:
                ping_message = {"event": "ping", "data": {"timestamp": asyncio.get_event_loop().time()}}
                yield f"data: {json.dumps(ping_message)}\n\n"

    except asyncio.CancelledError:
        # 클라이언트 연결 종료 시 정리
        if store_id and connection_id:
            sse_manager.disconnect(store_id, connection_id)

