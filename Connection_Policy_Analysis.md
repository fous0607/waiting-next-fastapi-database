# 접속 제한 정책(신규 차단 vs 기존 기기 종료) 기술 분석 보고서

**작성일**: 2025-12-25  
**작성자**: Antigravity AI Assistant  
**프로젝트**: 대기 관리 시스템 (waiting-next-fastapi-database)

---

## 📋 개요

이 문서는 대기 관리 시스템의 **동시 접속 제한 정책**에 대한 기술적 분석 보고서입니다. 특히 "신규 접속 차단(Block New)" 정책을 설정했음에도 불구하고 기존 기기가 끊어지는 문제에 대한 원인 분석 및 해결 방안을 제시합니다.

---

## 1. 현재 시스템 점검 결과

### 🔍 현상 분석

사용자께서 보고하신 **"신규 접속 차단(Block New)을 설정했는데도 기존 기기가 끊어지는 문제"**는 다음의 기술적 충돌 때문입니다:

#### 문제의 근본 원인

1. **IP 기반 기기 식별의 한계**
   - 현재 서버는 **'동일 IP + 동일 역할'**을 가진 접속을 같은 기기의 '새로고침'으로 간주합니다.
   - 이는 단일 기기 환경에서는 정상 작동하지만, 멀티 디바이스 환경에서는 문제를 야기합니다.

2. **와이파이(NAT) 환경의 한계**
   - 스마트폰, 태블릿, PC가 같은 와이파이 네트워크를 사용하면 **모두 동일한 외부 IP**를 갖게 됩니다.
   - NAT(Network Address Translation)로 인해 서버 입장에서는 모든 기기가 동일한 IP에서 접속하는 것처럼 보입니다.

3. **중복 세션 정리 로직의 오작동**
   - '새로고침' 시 발생하는 좀비 세션을 정리하기 위해, 서버는 동일 IP의 이전 접속을 먼저 끊어버립니다.
   - 이때문에 **다른 기기임에도 IP가 같으면** 서버는 이를 '새로고침'으로 오해하여 기존 기기를 끊고 새 기기를 연결해 줍니다.
   - 결과적으로 '신규 차단' 정책임에도 불구하고 **'기존 기기 종료(Eject Old)'처럼 동작**하게 됩니다.

---

### 📊 두 가지 기능의 정의 및 구현 방향

사용자께서 원하시는 두 가지 기능을 다음과 같이 명확히 구분하여 처리할 수 있음을 확인했습니다.

| 기능명 | 동작 방식 (정의) | 현재 상태 | 구현 시 해결 과제 |
| :--- | :--- | :--- | :--- |
| **기존 기기 접속 끊기**<br>(Eject Old) | "나중에 들어온 놈이 대장"<br>새 기기가 접속하면 가장 오래된 기기를 종료시킴 | ⚠️ 부분 구현 | 실시간 추방 메시지 전송 및 UI 즉시 차단 |
| **신규 접속 차단**<br>(Block New) | "먼저 온 놈이 임자"<br>이미 접속 대수가 찼다면 새 기기의 접속을 거부함 | ❌ 미작동 | **[핵심]** 본인의 '새로고침'은 허용하고, '타인의 새 기기'만 차단해야 함 |

---

## 2. 코드 분석 및 수정 계획

### 🎯 핵심 솔루션: 기기 고유 ID(ClientId) 도입

기존 IP 기반 식별의 한계를 극복하기 위해 **클라이언트 고유 ID**를 도입합니다.

---

### 1) 프론트엔드: 기기 고유 ID(ClientId) 생성

#### 구현 방법
```typescript
// useSSE.ts 또는 관련 컴포넌트
let clientId = localStorage.getItem('client_id');
if (!clientId) {
    clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('client_id', clientId);
}
```

#### 주요 특징
- **브라우저별 고유성**: `localStorage`에 저장하여 각 브라우저(기기)마다 고유한 ID 보유
- **영구성**: 브라우저 캐시를 삭제하지 않는 한 동일한 ID 유지
- **SSE 파라미터 전달**: 연결 시 `client_id` 파라미터로 서버에 전송

#### SSE 연결 예시
```typescript
const url = `/api/sse/stream?store_id=${storeId}&role=dashboard&client_id=${clientId}`;
const es = new EventSource(url);
```

---

### 2) 백엔드: 정책별 분기 로직 정교화

#### 현재 코드의 문제점
```python
# backend/routers/sse.py (기존 코드 - 문제 있음)
same_ip_role_sessions = [
    s for s in active_sessions 
    if s.ip == client_ip and s.role == role
]
# 동일 IP의 모든 세션을 '같은 기기'로 오판
```

#### 개선된 로직 (의사코드)
```python
# 1. ClientId 기반 세션 구분
same_device_sessions = [
    s for s in active_sessions 
    if s.client_id == client_id
]

different_device_sessions = [
    s for s in active_sessions 
    if s.client_id != client_id and s.role == role
]

# 2. 같은 ClientId (본인의 새로고침)
if same_device_sessions:
    # 정책과 무관하게 이전 세션 정리 후 연결 허용
    for session in same_device_sessions:
        await session.disconnect()
    # 새 연결 수락
    return new_connection

# 3. 다른 ClientId (다른 기기의 새 접속)
total_different_devices = len(different_device_sessions)

if total_different_devices >= max_connections:
    if policy == "block_new":
        # 신규 차단: 새 기기 접속 거부
        emit_event("connection_rejected", {
            "message": "접속 대수 초과. 다른 기기의 접속을 먼저 종료해 주세요."
        })
        return reject_connection
        
    elif policy == "eject_old":
        # 기존 종료: 가장 오래된 세션 강제 종료
        oldest_session = min(different_device_sessions, key=lambda s: s.connected_at)
        await oldest_session.emit("force_disconnect", {
            "message": "새로운 기기가 접속하여 연결이 종료되었습니다."
        })
        await oldest_session.disconnect()
        # 새 연결 수락
        return new_connection
```

---

### 3) 주요 데이터 구조 변경

#### SSE 연결 정보 (ConnectionInfo)
```python
@dataclass
class ConnectionInfo:
    session_id: str
    client_id: str      # 🆕 신규 추가
    ip: str
    role: str
    store_id: Optional[int]
    connected_at: datetime
    user_agent: str
    queue: asyncio.Queue
```

---

## 3. 구현 우선순위 및 영향도 분석

### 📈 수정 범위

| 파일 | 수정 내용 | 난이도 | 영향도 |
|------|----------|--------|--------|
| `frontend/hooks/useSSE.ts` | ClientId 생성 및 파라미터 추가 | 하 | 중 |
| `frontend/app/page.tsx` | SSE 연결 시 ClientId 전달 | 하 | 중 |
| `backend/routers/sse.py` | ClientId 매개변수 수신 | 하 | 중 |
| `backend/services/sse_manager.py` | ClientId 기반 세션 관리 로직 재구현 | 중 | 높음 |
| `backend/models.py` | ConnectionInfo 데이터 클래스 수정 | 하 | 낮음 |

---

### ⚠️ 테스트 시나리오

#### 시나리오 1: Block New 정책 검증
1. **초기 상태**: 접속 제한 = 2대, 정책 = Block New
2. **기기 A**: 관리자 화면 접속 ✅
3. **기기 B**: 관리자 화면 접속 ✅
4. **기기 A**: 새로고침 → 정상 유지되어야 함 ✅
5. **기기 C**: 관리자 화면 접속 시도 → **차단되어야 함** ❌ (현재는 A 또는 B가 끊김)

#### 시나리오 2: Eject Old 정책 검증
1. **초기 상태**: 접속 제한 = 2대, 정책 = Eject Old
2. **기기 A**: 관리자 화면 접속 (10:00) ✅
3. **기기 B**: 관리자 화면 접속 (10:01) ✅
4. **기기 C**: 관리자 화면 접속 (10:02) → **기기 A가 끊겨야 함** ✅
5. **기기 A**: 새로고침 → 정상 접속되어야 함 (기존 세션 정리 후) ✅

---

## 4. 향후 작업 순서 (구현 계획)

### Phase 1: 프론트엔드 수정 (30분 예상)
1. ✅ `localStorage` 기반 `clientId` 생성 로직 구현
2. ✅ SSE 연결 시 `client_id` 파라미터 추가
3. ✅ 기존 코드와의 호환성 확인

### Phase 2: 백엔드 수정 (1~2시간 예상)
1. ✅ `sse.py`에서 `client_id` 파라미터 수신 추가
2. ✅ `ConnectionInfo` 데이터 클래스에 `client_id` 필드 추가
3. ✅ `sse_manager.py`의 세션 관리 로직 재구현:
   - 같은 `client_id` → 새로고침으로 간주, 이전 세션 정리
   - 다른 `client_id` → 정책별 분기 (Block New / Eject Old)
4. ✅ `force_disconnect` 및 `connection_rejected` 이벤트 핸들러 구현

### Phase 3: 프론트엔드 이벤트 처리 (30분 예상)
1. ✅ `connection_rejected` 이벤트 수신 시 사용자에게 알림 표시
2. ✅ `force_disconnect` 이벤트 수신 시 연결 종료 및 안내 팝업

### Phase 4: 테스트 및 검증 (1시간 예상)
1. ✅ 단일 기기 환경에서 새로고침 정상 작동 확인
2. ✅ 동일 와이파이 환경에서 멀티 디바이스 테스트
3. ✅ 두 가지 정책(Block New / Eject Old) 각각 검증
4. ✅ 엣지 케이스 테스트:
   - 동시 접속 시도
   - 네트워크 불안정 환경
   - 브라우저 캐시 삭제 후 재접속

---

## 5. 예상 리스크 및 대응 방안

### 리스크 1: 기존 세션 마이그레이션
**문제**: 배포 시 기존에 접속 중인 사용자는 `client_id`가 없음  
**대응**: 
- 백엔드에서 `client_id`가 없는 요청에 대해 임시 ID 자동 생성
- 프론트엔드 재연결 시 정상적인 `client_id` 발급

### 리스크 2: localStorage 제한 환경
**문제**: 시크릿 모드 또는 쿠키 차단 환경에서 `localStorage` 사용 불가  
**대응**:
- 메모리 기반 fallback ID 사용 (세션 종료 시 소멸)
- 사용자에게 일반 브라우저 사용 권장 안내

### 리스크 3: ClientId 충돌
**문제**: 극히 드물지만 동일한 `clientId` 생성 가능성  
**대응**:
- UUID v4 또는 crypto.randomUUID() 사용으로 충돌 확률 최소화
- `${timestamp}-${random}`으로 이중 보장

---

## 6. 참조 자료

### 관련 파일 경로
- **프론트엔드**:
  - `frontend/hooks/useSSE.ts`
  - `frontend/app/page.tsx`
  - `frontend/components/sse/SSEEventHandler.tsx`

- **백엔드**:
  - `backend/routers/sse.py`
  - `backend/services/sse_manager.py`
  - `backend/models.py`

### 기술 스택
- **프론트엔드**: Next.js, TypeScript, EventSource API
- **백엔드**: FastAPI, Python asyncio, Server-Sent Events (SSE)
- **저장소**: localStorage (Web Storage API)

---

## 7. 결론 및 권장사항

### ✅ 요약
1. **문제 원인**: IP 기반 기기 식별로 인해 동일 네트워크의 다른 기기를 '새로고침'으로 오판
2. **핵심 해결책**: ClientId 도입으로 기기를 정확히 구분
3. **구현 난이도**: 중간 (2~3시간 예상)
4. **효과**: Block New와 Eject Old 정책이 정확히 작동

### 📌 권장사항
- ✅ **즉시 구현 권장**: 사용자 경험에 직접적인 영향을 미치는 중요한 버그 수정
- ✅ **단계별 배포**: Phase별로 테스트 서버에서 검증 후 프로덕션 배포
- ✅ **사용자 공지**: 배포 시 "접속 정책이 개선되었습니다" 안내

---

**작성일**: 2025-12-25  
**버전**: v1.0  
**상태**: 검토 완료, 구현 대기
