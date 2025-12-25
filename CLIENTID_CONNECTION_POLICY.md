# SSE 접속 정책 개선 - ClientId 기반 기기 식별 시스템

## 📋 개요

대기자 관리 시스템의 SSE(Server-Sent Events) 접속 제한 기능에서 발생하던 문제를 해결하기 위해 **기기별 고유 ID(ClientId)** 기반 식별 시스템을 도입했습니다.

### 해결된 문제

1. **신규 접속 차단 모드에서 본인이 차단되는 문제**
   - 같은 와이파이를 사용하는 여러 기기를 IP만으로 구분하지 못해 발생
   - 페이지 새로고침 시 서버가 '새 기기'로 오인하여 본인을 차단

2. **기존 기기 종료 모드가 신규 차단처럼 동작하는 문제**
   - IP 기반 중복 세션 정리 로직이 과도하게 작동
   - 다른 기기임에도 같은 IP면 기존 연결을 끊어버림

---

## 🔧 구현 내용

### 1. 프론트엔드 (useSSE.ts)

```typescript
// 기기별 고유 ID 생성 또는 로드
let clientId = localStorage.getItem('sse_client_id');
if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem('sse_client_id', clientId);
}

// SSE 연결 시 파라미터로 전달
params.append('client_id', clientId);
```

**특징:**
- `crypto.randomUUID()`로 고유한 ID 생성
- `localStorage`에 영구 저장하여 브라우저 재시작 후에도 유지
- 각 기기/브라우저마다 고유한 ID 보유

### 2. 백엔드 라우터 (sse.py)

```python
@router.get("/stream")
async def sse_stream(
    request: Request,
    store_id: str = None,
    channel: str = None,
    role: str = 'unknown',
    client_id: str = None  # 기기 고유 ID 추가
):
    # ...
    queue, connection_id = await sse_manager.connect(
        resolved_id,
        role,
        request,
        max_connections=max_limit,
        policy=policy,
        client_id=client_id  # 전달
    )
```

### 3. 연결 관리자 (sse_manager.py)

#### ConnectionInfo 확장
```python
@dataclass
class ConnectionInfo:
    queue: asyncio.Queue
    role: str
    ip: str
    user_agent: str
    connected_at: str
    client_id: Optional[str] = None  # 기기 고유 ID 추가
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

#### 정밀한 중복 세션 처리
```python
# 1) client_id가 일치하는 경우 → 100% 동일 기기의 새로고침
if client_id and conn.client_id == client_id:
    duplicates_to_remove.append(conn_id)
    
# 2) Fallback: IP+Role+UA가 모두 같은 경우 (하위 호환)
elif not client_id and conn.ip == client_ip and conn.role == role and conn.user_agent == user_agent:
    duplicates_to_remove.append(conn_id)
```

---

## 📊 정책별 동작 방식

### 1. 신규 접속 차단 (Block New)

| 상황 | 기존 동작 | 개선 후 동작 |
|------|-----------|--------------|
| 같은 기기에서 새로고침 | ❌ 차단됨 (본인이 튕김) | ✅ 기존 세션 교체 (정상 접속) |
| 다른 기기에서 접속 시도 | ⚠️ IP 같으면 기존 기기 종료 | ✅ 신규 기기 차단 (정책대로) |

### 2. 기존 기기 접속 끊기 (Eject Old)

| 상황 | 기존 동작 | 개선 후 동작 |
|------|-----------|--------------|
| 같은 기기에서 새로고침 | ✅ 정상 (기존 세션 교체) | ✅ 정상 (기존 세션 교체) |
| 다른 기기에서 접속 시도 | ✅ 가장 오래된 기기 종료 | ✅ 가장 오래된 기기 종료 |

---

## 🧪 테스트 시나리오

### 시나리오 1: 신규 접속 차단 + 허용 1대
```
1. 설정: 신규 접속 차단, 최대 1대
2. 기기 A에서 대기자 관리 접속 ✅
3. 기기 A에서 새로고침 (F5) → ✅ 정상 접속 유지
4. 기기 B에서 접속 시도 → ❌ "접속 가능한 대수(1대)를 초과하여 접속할 수 없습니다"
```

### 시나리오 2: 기존 기기 종료 + 허용 2대
```
1. 설정: 기존 기기 종료, 최대 2대
2. 기기 A 접속 ✅
3. 기기 B 접속 ✅
4. 기기 C 접속 시도 → 기기 A 종료됨, 기기 C 접속 성공 ✅
5. 기기 B에서 새로고침 → ✅ 정상 (기기 C 유지)
```

### 시나리오 3: 동일 와이파이 환경
```
1. 설정: 신규 접속 차단, 최대 1대
2. PC에서 접속 (IP: 192.168.0.100) ✅
3. 스마트폰에서 접속 (IP: 192.168.0.100, 같은 공유기) → ❌ 차단
4. PC에서 새로고침 → ✅ 정상 (ClientId로 동일 기기 인식)
```

---

## 🔍 기술적 세부사항

### ClientId 생성 및 저장
- **생성 방식**: `crypto.randomUUID()` (RFC 4122 표준)
- **저장 위치**: `localStorage['sse_client_id']`
- **유효 기간**: 영구 (사용자가 브라우저 데이터 삭제 전까지)
- **형식 예시**: `"550e8400-e29b-41d4-a716-446655440000"`

### 중복 세션 판별 우선순위
1. **ClientId 일치** (최우선) → 100% 동일 기기
2. **IP + Role + UserAgent 일치** (Fallback) → 동일 기기로 추정
3. **그 외** → 다른 기기로 판단

### 역할별 제한 적용
- **Dashboard 역할** (`admin`, `manager`): 설정된 제한 적용
- **기타 역할** (`board`, `reception`): 무제한 (별도 관리)

---

## 📝 관련 파일

### Frontend
- `frontend/hooks/useSSE.ts` - ClientId 생성 및 전송

### Backend
- `backend/routers/sse.py` - SSE 엔드포인트, ClientId 수신
- `backend/sse_manager.py` - 연결 관리 로직, 정책 적용
- `backend/models.py` - StoreSettings 모델 (정책 설정 저장)
- `backend/schemas.py` - StoreSettingsUpdate 스키마

### Frontend UI
- `frontend/components/settings/GeneralSettings.tsx` - 정책 설정 화면

---

## 🚀 배포 및 적용

### 1. 프론트엔드 재빌드 필요
```bash
cd frontend
npm run build
```

### 2. 백엔드 재시작 필요
```bash
# 서비스 재시작
sudo systemctl restart waiting-backend
```

### 3. 기존 사용자 영향
- 기존 접속 중인 사용자는 다음 새로고침 시 자동으로 ClientId 생성
- 기존 localStorage 데이터와 충돌 없음
- 하위 호환성 유지 (ClientId 없어도 IP 기반 Fallback 작동)

---

## ⚠️ 주의사항

### 브라우저 데이터 삭제 시
- localStorage가 삭제되면 새로운 ClientId 생성
- 서버는 이를 '새 기기'로 인식
- 신규 접속 차단 모드에서는 기존 세션이 있으면 차단될 수 있음

### 시크릿 모드 / 프라이빗 브라우징
- 매번 새로운 ClientId 생성
- 일반 모드와 시크릿 모드는 다른 기기로 취급

### 여러 브라우저 사용
- Chrome, Safari, Edge 등 각각 다른 ClientId 보유
- 각각을 별도 기기로 인식

---

## 📈 향후 개선 가능 사항

1. **ClientId 만료 정책**: 일정 기간 미사용 시 자동 삭제
2. **관리자 대시보드**: 접속 중인 기기 목록 및 강제 종료 기능
3. **기기 별칭**: 사용자가 기기에 이름 부여 (예: "사무실 PC", "태블릿")
4. **접속 이력**: 기기별 접속 로그 및 통계

---

## 📞 문의 및 지원

문제 발생 시 다음 정보를 함께 제공해 주세요:
- 브라우저 종류 및 버전
- 설정된 접속 정책 (신규 차단 / 기존 종료)
- 허용 대수 설정값
- 브라우저 콘솔 로그 (`[SSE]`로 시작하는 메시지)
- 서버 로그 (`[SSEManager]`로 시작하는 메시지)
