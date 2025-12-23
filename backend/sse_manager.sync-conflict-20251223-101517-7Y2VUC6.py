from typing import Dict, Set
import asyncio
from fastapi import Request
from starlette.responses import StreamingResponse
import json


class SSEConnectionManager:
    """SSE 연결 관리자"""

    async def send_personal_message(self, store_id: str, queue: asyncio.Queue, event_type: str, data: dict = None):
        """특정 클라이언트에게만 메시지 전송"""
        message = {
            "event": event_type,
            "data": data or {}
        }
        try:
            await queue.put(message)
        except Exception:
            self.disconnect(store_id, queue)

    # --- System Log Channel ---
    def __init__(self):
        # store_id별로 연결된 클라이언트들을 관리
        self.active_connections: Dict[str, Set[asyncio.Queue]] = {}
        # franchise_id별로 연결된 클라이언트들을 관리 (프랜차이즈 관리자용)
        self.franchise_connections: Dict[str, Set[asyncio.Queue]] = {}
        # 시스템 로그 관찰자들
        self.system_connections: Set[asyncio.Queue] = set()

    async def connect_system(self) -> asyncio.Queue:
        """새로운 SSE 연결 추가 (시스템 로그용)"""
        queue = asyncio.Queue()
        self.system_connections.add(queue)
        return queue

    def disconnect_system(self, queue: asyncio.Queue):
        """SSE 연결 제거 (시스템 로그용)"""
        self.system_connections.discard(queue)

    async def broadcast_system(self, log_entry: dict):
        """시스템 로그 브로드캐스트"""
        message = {
            "event": "log",
            "data": log_entry
        }
        
        disconnected_queues = []
        for queue in self.system_connections:
            try:
                await queue.put(message)
            except Exception:
                disconnected_queues.append(queue)
        
        for queue in disconnected_queues:
            self.disconnect_system(queue)

    # --- Franchise Channel ---
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

    # --- Store Channel (Missing Methods Restored) ---
    async def connect(self, store_id: str) -> asyncio.Queue:
        """새로운 SSE 연결 추가 (매장용)"""
        if store_id not in self.active_connections:
            self.active_connections[store_id] = set()
        queue = asyncio.Queue()
        self.active_connections[store_id].add(queue)
        return queue

    def disconnect(self, store_id: str, queue: asyncio.Queue):
        """SSE 연결 제거 (매장용)"""
        if store_id in self.active_connections:
            self.active_connections[store_id].discard(queue)
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]

    async def broadcast(self, store_id: str, event_type: str, data: dict = None, franchise_id: str = None):
        """특정 매장에 이벤트 브로드캐스트 + 프랜차이즈 전파"""
        message = {
            "event": event_type,
            "data": data or {},
            "store_id": store_id
        }
        
        # 1. 매장 리스너에게 전송
        if store_id in self.active_connections:
            disconnected_queues = []
            for queue in self.active_connections[store_id]:
                try:
                    await queue.put(message)
                except Exception:
                    disconnected_queues.append(queue)
            
            for queue in disconnected_queues:
                self.disconnect(store_id, queue)
                
        # 2. 프랜차이즈 리스너에게 전송
        if franchise_id:
            await self.broadcast_to_franchise(franchise_id, event_type, data, store_id)



# 전역 SSE 매니저 인스턴스
sse_manager = SSEConnectionManager()


async def event_generator(queue: asyncio.Queue):
    """SSE 이벤트 스트림 생성기"""
    try:
        # 연결 확인용 초기 메시지 (표준 형식을 따름)
        initial_message = {
            "event": "connected",
            "data": {}
        }
        yield f"data: {json.dumps(initial_message)}\n\n"

        while True:
            try:
                # 큐에서 메시지 대기 (타임아웃 적용으로 heartbeat 구현)
                # 30초 동안 메시지가 없으면 heartbeat 전송
                message = await asyncio.wait_for(queue.get(), timeout=30.0)

                # SSE 형식으로 메시지 전송
                # 클라이언트의 일관된 처리를 위해 모든 이벤트를 'message' 타입으로 전송하고
                # 실제 이벤트 타입은 데이터 페이로드 안에 포함시킴
                event_type = message.get("event", "message")
                data = message.get("data", {})
                
                payload = {
                    "event": event_type,
                    "data": data
                }
                
                # 프랜차이즈 관리자를 위해 store_id 포함
                if "store_id" in message:
                    payload["store_id"] = message["store_id"]
                
                yield f"data: {json.dumps(payload)}\n\n"
                
            except asyncio.TimeoutError:
                # Heartbeat (keep-alive)
                # 연결 유지를 위한 ping 메시지
                ping_message = {
                    "event": "ping",
                    "data": {"timestamp": asyncio.get_event_loop().time()}
                }
                yield f"data: {json.dumps(ping_message)}\n\n"

    except asyncio.CancelledError:
        # 클라이언트 연결 종료
        pass
