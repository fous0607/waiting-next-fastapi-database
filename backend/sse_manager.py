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
    client_id: Optional[str] = None # 기기 고유 ID
    user_id: Optional[int] = None # 로그인한 사용자 ID
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

class SSEConnectionManager:
    """SSE 연결 관리자"""

    def __init__(self):
        # store_id: {connection_id: ConnectionInfo}
        self.active_connections: Dict[str, Dict[str, ConnectionInfo]] = {}
        
        # franchise_id별로 연결된 클라이언트들을 관리 (프랜차이즈 관리자용)
        self.franchise_connections: Dict[str, Set[asyncio.Queue]] = {}
        # 시스템 로그 관찰자들
        self.system_connections: Set[asyncio.Queue] = set()

    # --- Store Channel ---
    async def connect(self, store_id: str, role: str, request: Request = None, max_connections: int = 0, policy: str = "eject_old", client_id: str = None, user_id: int = None) -> tuple[asyncio.Queue, str]:
        """새로운 SSE 연결 추가 (매장용)"""
        if store_id not in self.active_connections:
            self.active_connections[store_id] = {}
            
        queue = asyncio.Queue()
        now_dt = datetime.now()
        
        # 메타데이터 추출
        client_ip = "Unknown"
        user_agent = "Unknown"
        if request:
            client_ip = request.client.host if request.client else "Unknown"
            user_agent = request.headers.get("user-agent", "Unknown")
            
        # 프록시 헤더 확인 (X-Forwarded-For)
        if request and request.headers.get("x-forwarded-for"):
            client_ip = request.headers.get("x-forwarded-for").split(",")[0].strip()

        print(f"[SSEManager] CONNECT_ATTEMPT: store={store_id}, user={user_id}, client={client_id}, role={role}, ip={client_ip}")

        # 1. 중복/이전 세션 정리 (우선순위: ClientId > UserID > IP/UA)
        duplicates_to_remove = []
        is_dashboard_role = role in ['admin', 'manager']
        
        for conn_id, conn in self.active_connections[store_id].items():
            # 1) ClientId 일치: 100% 동일 기기 새로고침/탭복제 -> 메시지 없이 조용히 교체 (Silent Kill)
            if client_id and conn.client_id == client_id:
                duplicates_to_remove.append((conn_id, False, "refresh"))
                print(f"[SSEManager] DUPLICATE_CLIENT found: id={client_id}. Replacing silently.")
            
            # 2) UserID 일치: "본인"이 다른 기기에서 접속 -> 본인의 이전 접속 종료 (세션 이동)
            elif user_id and conn.user_id == user_id:
                # [Grace Filter] 만약 이전 연결이 방금(2초 이내) 만들어졌다면, 레이스 컨디션일 수 있으므로 조용히 교체
                conn_time = datetime.fromisoformat(conn.connected_at)
                is_very_recent = (now_dt - conn_time).total_seconds() < 2.0
                
                duplicates_to_remove.append((conn_id, not is_very_recent, "session_transfer"))
                print(f"[SSEManager] SAME_USER detected: user_id={user_id}. Recent={is_very_recent}. Ejecting old.")

            # 3) Fallback: ID들 없는데 IP/Role/UA 같음 -> Legacy Refresh -> Silent Kill
            elif (not client_id and not user_id) and conn.ip == client_ip and conn.role == role and conn.user_agent == user_agent:
                duplicates_to_remove.append((conn_id, False, "legacy_refresh"))
                print(f"[SSEManager] DUPLICATE_IP/UA found: ip={client_ip}. Replacing silently.")

        for dup_id, send_message, reason in duplicates_to_remove:
            if send_message:
                try:
                    old_conn = self.active_connections[store_id][dup_id]
                    await old_conn.queue.put({
                        "event": "force_disconnect", 
                        "data": {"reason": reason, "msg": "다른 기기에서 접속하였습니다."}
                    })
                except: pass
            
            if dup_id in self.active_connections[store_id]:
                del self.active_connections[store_id][dup_id]
            print(f"[SSEManager] CLEANUP_DONE: id={dup_id}, reason={reason}, notified={send_message}")

        # 2. 전체 대수 제한 체크
        if max_connections > 0:
            if is_dashboard_role:
                active_dashboard_conns = [
                    c for c in self.active_connections[store_id].values() 
                    if c.role in ['admin', 'manager']
                ]
                current_count = len(active_dashboard_conns)
            else:
                current_count = len([c for c in self.active_connections[store_id].values() if c.role == role])

            if current_count >= max_connections:
                if policy == "block_new":
                    print(f"[SSEManager] REJECTED (Limit): store={store_id}, user={user_id}, current={current_count}, max={max_connections}")
                    await queue.put({
                        "event": "connection_rejected",
                        "data": {"reason": "limit_reached", "max": max_connections}
                    })
                    return queue, None
                else: 
                    target_conns = active_dashboard_conns if is_dashboard_role else \
                                  [c for c in self.active_connections[store_id].values() if c.role == role]
                    
                    sorted_conns = sorted(target_conns, key=lambda x: x.connected_at)
                    num_to_eject = current_count - max_connections + 1
                    
                    for i in range(min(num_to_eject, len(sorted_conns))):
                        old_conn = sorted_conns[i]
                        print(f"[SSEManager] EJECTING (Policy): id={old_conn.id}, user={old_conn.user_id}")
                        try:
                            await old_conn.queue.put({
                                "event": "force_disconnect", 
                                "data": {"reason": "limit_exceeded", "max": max_connections}
                            })
                        except: pass
                        if old_conn.id in self.active_connections[store_id]:
                            del self.active_connections[store_id][old_conn.id]

        # 3. 신규 연결 등록
        connection = ConnectionInfo(
            queue=queue,
            role=role,
            ip=client_ip,
            user_agent=user_agent,
            client_id=client_id,
            user_id=user_id,
            connected_at=now_dt.isoformat()
        )
        
        self.active_connections[store_id][connection.id] = connection
        print(f"[SSEManager] CONNECTED: store={store_id}, user={user_id}, client={client_id}, id={connection.id}")
        return queue, connection.id

    def disconnect(self, store_id: str, connection_id: str):
        """SSE 연결 제거 (매장용)"""
        if store_id in self.active_connections:
            if connection_id in self.active_connections[store_id]:
                conn = self.active_connections[store_id][connection_id]
                print(f"[SSEManager] DISCONNECTED: store={store_id}, user={conn.user_id}, client={conn.client_id}, id={connection_id}")
                del self.active_connections[store_id][connection_id]
            
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]

    async def disconnect_user(self, user_id: int):
        """특정 사용자의 모든 연결 강제 종료 (로그아웃 시 사용)"""
        print(f"[SSEManager] Force disconnecting all sessions for user_id={user_id}")
        tasks = []
        
        for store_id, connections in self.active_connections.items():
            # 리스트를 복사해서 순회 (삭제 안전성)
            for conn_id, conn in list(connections.items()):
                if conn.user_id == user_id:
                    print(f"[SSEManager] Found session to kill: store={store_id}, conn_id={conn_id}")
                    try:
                        await conn.queue.put({"event": "force_disconnect", "data": {"reason": "logout"}})
                    except:
                        pass
                    # 목록에서 제거
                    if conn_id in self.active_connections[store_id]:
                        del self.active_connections[store_id][conn_id]

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

    def get_all_status(self) -> Dict[str, List[dict]]:
        """모든 매장의 현재 연결 상태 조회 (Superadmin용)"""
        result = {}
        for store_id, connections in self.active_connections.items():
            result[store_id] = [
                {
                    "id": conn.id,
                    "role": conn.role,
                    "ip": conn.ip,
                    "user_agent": conn.user_agent,
                    "connected_at": conn.connected_at
                }
                for conn in connections.values()
            ]
        return result

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
        # 연결 확인용 초기 메시지 (정상 연결일 때만)
        if connection_id:
            initial_message = {"event": "connected", "data": {}}
            yield f"data: {json.dumps(initial_message)}\n\n"

        while True:
            try:
                # 30초 heartbeat
                message = await asyncio.wait_for(queue.get(), timeout=30.0)

                event_type = message.get("event", "message")
                data = message.get("data", {})

                # 강제 종료 / 접속 거부 시그널 처리
                if event_type in ["force_disconnect", "connection_rejected"]:
                    payload = {"event": event_type, "data": data}
                    yield f"data: {json.dumps(payload)}\n\n"
                    # 스트림 종료 (서버 측 연결 끊기)
                    break

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

