# SSE 트래픽 관리 - 기술 명세서

## 문서 정보

- **기능명**: SSE 트래픽 관리 설정
- **버전**: 1.0.0
- **작성일**: 2025-12-15
- **브랜치**: `feature/sse-traffic-management`
- **상태**: 구현 완료, 테스트 필요

---

## 1. 개요

### 1.1 목적

특정 기능을 사용하지 않을 때 불필요한 네트워크 트래픽을 줄이기 위해 Server-Sent Events (SSE) 연결을 세밀하게 제어합니다.

### 1.2 범위

- 대기현황판(Waiting Board) 활성화/비활성화 설정 추가
- 대기접수 데스크(Reception Desk) 활성화/비활성화 설정 추가
- 설정에 따른 조건부 SSE 연결 구현
- 기본값 활성화 상태로 하위 호환성 유지

### 1.3 제외 사항

- 대기관리자 페이지 SSE 동작 변경 (항상 활성화 유지)
- SSE 프로토콜 또는 메시지 형식 변경
- 부분적 SSE 구현 (기능별 전체 활성화/비활성화만 지원)

---

## 2. 아키텍처

### 2.1 시스템 구성요소

```
┌─────────────────┐
│   설정 페이지    │
│  (UI 컨트롤)    │
└────────┬────────┘
         │ PUT /api/store-settings
         ▼
┌─────────────────┐
│  매장 설정 API  │
│     라우터      │
└────────┬────────┘
         │ DB 업데이트
         ▼
┌─────────────────┐
│   데이터베이스   │
│ (store_settings)│
└────────┬────────┘
         │ GET /api/store-settings/sse-status
         ▼
┌─────────────────┐
│  대기현황판 /   │
│  대기접수 데스크 │
└────────┬────────┘
         │ 조건부 연결
         ▼
┌─────────────────┐
│   SSE 연결      │
│  (활성화 시)    │
└─────────────────┘
```

### 2.2 데이터 흐름

1. **설정 단계**:
   - 사용자가 UI를 통해 설정 변경
   - 설정이 데이터베이스에 저장됨
   - 기본값: 두 기능 모두 활성화

2. **실행 단계**:
   - 페이지 로드
   - API를 통해 SSE 상태 조회
   - 조건부로 SSE 연결 수립
   - 비활성화 시 경고 메시지 표시 (대기현황판만)

---

## 3. 데이터베이스 스키마

### 3.1 테이블: `store_settings`

**신규 컬럼**:

| 컬럼명 | 타입 | 기본값 | NULL 허용 | 설명 |
|--------|------|--------|-----------|------|
| `enable_waiting_board` | BOOLEAN | TRUE | NO | 대기현황판 SSE 제어 |
| `enable_reception_desk` | BOOLEAN | TRUE | NO | 대기접수 데스크 SSE 제어 |

**마이그레이션 스크립트**: `migrate_add_sse_traffic_settings.py`

```python
# SQLite 구현
ALTER TABLE store_settings ADD COLUMN enable_waiting_board INTEGER DEFAULT 1;
ALTER TABLE store_settings ADD COLUMN enable_reception_desk INTEGER DEFAULT 1;
```

**인덱스**: 불필요 (낮은 카디널리티, 조회 빈도 낮음)

---

## 4. API 명세

### 4.1 신규 엔드포인트: SSE 상태 조회

**엔드포인트**: `GET /api/store-settings/sse-status`

**인증**: 필수 (매장 범위)

**요청 헤더**:
```
X-Store-Id: <store_id>
Authorization: Bearer <token>
```

**응답** (200 OK):
```json
{
  "enable_waiting_board": true,
  "enable_reception_desk": true
}
```

**에러 응답**:
- `401 Unauthorized`: 인증 누락 또는 유효하지 않음
- `404 Not Found`: 매장 설정을 찾을 수 없음

**성능**: 
- 예상 지연시간: < 50ms
- 캐싱: 미구현 (설정 변경 빈도 낮음)

### 4.2 수정된 엔드포인트: 설정 업데이트

**엔드포인트**: `PUT /api/store-settings/`

**신규 요청 필드**:
```json
{
  "enable_waiting_board": true,
  "enable_reception_desk": true
}
```

**유효성 검사**:
- 타입: Boolean
- 필수: 아니오 (선택적 필드)
- 기본값: 기존 값 유지

---

## 5. 백엔드 구현

### 5.1 모델 (`models.py`)

**위치**: 132-135번째 줄

```python
# SSE 트래픽 관리 설정
enable_waiting_board = Column(Boolean, default=True)
enable_reception_desk = Column(Boolean, default=True)
```

**ORM 동작**:
- SQLAlchemy Boolean 타입
- SQLite는 INTEGER로 저장 (0/1)
- Python은 bool로 수신 (True/False)

### 5.2 스키마 (`schemas.py`)

**StoreSettingsBase** (60번째 줄):
```python
enable_waiting_board: bool = True
enable_reception_desk: bool = True
```

**StoreSettingsUpdate** (123번째 줄):
```python
enable_waiting_board: Optional[bool] = None
enable_reception_desk: Optional[bool] = None
```

**Pydantic 유효성 검사**:
- 타입 변환: "true"/"false" → bool
- Null 처리: None = 업데이트 안 함

### 5.3 라우터 (`routers/store_settings.py`)

**수정된 함수**:

1. **`get_store_settings()`** (38-90번째 줄):
   - 마이그레이션 호환성을 위한 폴백 처리
   - 컬럼 누락 시 기본값 설정

2. **`update_store_settings()`** (92-180번째 줄):
   - 안전 업데이트 제외 목록
   - 마이그레이션 에러 처리

3. **`clone_store_settings()`** (202-360번째 줄):
   - 복제 작업에 신규 필드 포함

4. **`get_sse_status()`** (신규, 201-216번째 줄):
   - SSE 상태 확인 전용 엔드포인트
   - 경량 쿼리 (조인 없음)

---

## 6. 프론트엔드 구현

### 6.1 설정 페이지 (`templates/settings.html`)

**UI 컴포넌트** (691-715번째 줄):

```html
<h3>🚦 트래픽 관리 설정</h3>

<div class="form-group">
    <label>
        <input type="checkbox" id="enableWaitingBoard">
        <span>대기현황판 사용</span>
    </label>
    <small>비활성화 시, 대기현황판 실시간 업데이트(SSE)가 중지되어 트래픽이 감소합니다.</small>
</div>

<div class="form-group">
    <label>
        <input type="checkbox" id="enableReceptionDesk">
        <span>대기접수 데스크 사용</span>
    </label>
    <small>비활성화 시, 대기접수 데스크 실시간 업데이트(SSE)가 중지되어 트래픽이 감소합니다.</small>
</div>
```

**JavaScript 함수**:

1. **설정 로드** (1127-1129번째 줄):
```javascript
document.getElementById('enableWaitingBoard').checked = 
    settings.enable_waiting_board !== undefined ? settings.enable_waiting_board : true;
document.getElementById('enableReceptionDesk').checked = 
    settings.enable_reception_desk !== undefined ? settings.enable_reception_desk : true;
```

2. **설정 저장** (1345-1347번째 줄):
```javascript
settings.enable_waiting_board = document.getElementById('enableWaitingBoard').checked;
settings.enable_reception_desk = document.getElementById('enableReceptionDesk').checked;
```

### 6.2 대기현황판 (`templates/waiting_board.html`)

**수정된 함수**: `initSSE()` (420-485번째 줄)

**로직 흐름**:
```javascript
async function initSSE() {
    // 1. SSE 상태 조회
    const response = await fetch('/api/store-settings/sse-status', { headers: getHeaders() });
    const status = await response.json();
    
    // 2. 활성화 여부 확인
    if (!status.enable_waiting_board) {
        // 3a. 비활성화: SSE 건너뛰기, 경고 표시
        updateConnectionStatus('disconnected');
        showDisabledMessage();
        return;
    }
    
    // 3b. 활성화: SSE 연결 수립
    eventSource = new EventSource(`/api/sse/stream?store_id=${storeId}`);
    // ... 이벤트 핸들러
}
```

**경고 메시지**:
- 위치: 고정, 우측 상단
- 색상: 주황색 (#f39c12)
- 내용: "실시간 업데이트가 비활성화되었습니다"
- 자동 닫기: 없음 (지속 표시)

### 6.3 대기접수 데스크 (`templates/reception.html`)

**수정된 함수**: `connectSSE()` (1465-1542번째 줄)

**대기현황판과의 차이점**:
- 시각적 경고 메시지 없음
- 조용히 건너뛰기 (콘솔 로그만)
- 동일한 조건부 로직

**이유**: 대기접수 데스크 SSE는 UX에 덜 중요함

---

## 7. 에러 처리

### 7.1 API 에러

| 시나리오 | 처리 방법 | 사용자 영향 |
|----------|-----------|-------------|
| SSE 상태 조회 실패 | 활성화로 가정, 에러 로그 | SSE 정상 연결 |
| 설정 저장 실패 | 에러 모달 표시 | 설정 저장 안 됨 |
| 마이그레이션 미실행 | 기본값으로 폴백 | 기능 활성화 상태 |

### 7.2 네트워크 에러

| 시나리오 | 처리 방법 | 사용자 영향 |
|----------|-----------|-------------|
| SSE 연결 실패 (활성화 시) | 자동 재연결 (지수 백오프) | 일시적 중단 |
| SSE 상태 확인 타임아웃 | 5초 후 활성화로 가정 | SSE 정상 연결 |

### 7.3 엣지 케이스

1. **페이지 열린 상태에서 설정 변경**:
   - 현재: 자동 새로고침 없음
   - 해결방법: 사용자가 페이지 새로고침 필요
   - 향후: 설정 변경 SSE 이벤트 고려

2. **부분 마이그레이션**:
   - 라우터의 폴백 로직으로 처리
   - 안전 업데이트 제외 목록으로 에러 방지

---

## 8. 성능 고려사항

### 8.1 네트워크 트래픽 감소

**기준선** (둘 다 활성화):
- SSE 연결: 매장당 2개 (대기현황판 + 대기접수 데스크)
- 하트비트: 30초마다
- 트래픽: 연결당 ~100 bytes/분

**최적화** (둘 다 비활성화):
- SSE 연결: 0개 (대기관리자 페이지는 여전히 연결)
- 트래픽 감소: 매장당 ~200 bytes/분
- 확장성: 100개 매장 = 20KB/분 절감

### 8.2 데이터베이스 영향

**추가 쿼리**:
- SSE 상태 확인: 페이지 로드당 1회
- 쿼리 복잡도: O(1) - store_id로 인덱싱
- 예상 영향: 무시할 수준 (< 1ms)

**저장 공간**:
- 추가 컬럼: 매장당 BOOLEAN 2개
- 저장 공간 오버헤드: 매장당 ~2 bytes
- 총계: 100개 매장에 < 1KB

---

## 9. 보안 고려사항

### 9.1 인증

- SSE 상태 엔드포인트는 인증 필요
- 매장 범위 접근 (X-Store-Id 헤더)
- CSRF 위험 없음 (GET 엔드포인트)

### 9.2 권한

- 사용자는 자신의 매장 설정만 수정 가능
- 권한 상승 위험 없음
- 매장별로 설정 격리

### 9.3 데이터 유효성 검사

- Pydantic을 통한 Boolean 타입 검증
- SQL 인젝션 위험 없음 (ORM 사용)
- XSS 위험 없음 (서버 측만)

---

## 10. 테스트 전략

### 10.1 단위 테스트

**필요한 테스트** (아직 미구현):

```python
# test_store_settings.py
def test_sse_status_endpoint():
    """SSE 상태가 올바른 값을 반환하는지 테스트"""
    
def test_sse_status_defaults():
    """설정을 찾을 수 없을 때 기본값 테스트"""
    
def test_update_sse_settings():
    """SSE 트래픽 설정 업데이트 테스트"""
```

### 10.2 통합 테스트

**테스트 시나리오**:

1. **설정 지속성**:
   - 설정 저장 → 페이지 새로고침 → 값 확인

2. **SSE 연결**:
   - 대기현황판 비활성화 → 페이지 열기 → SSE 요청 없음 확인

3. **대기관리자 영향 없음**:
   - 모두 비활성화 → 대기관리자 열기 → SSE 여전히 연결 확인

### 10.3 수동 테스트

상세한 수동 테스트 절차는 `walkthrough.md`의 "테스트 절차" 섹션 참조.

---

## 11. 배포

### 11.1 마이그레이션 단계

```bash
# 1. 데이터베이스 백업
cp waiting_system.db waiting_system.db.backup

# 2. 마이그레이션 실행
python3 migrate_add_sse_traffic_settings.py

# 3. 마이그레이션 확인
sqlite3 waiting_system.db "PRAGMA table_info(store_settings);"

# 4. 애플리케이션 재시작
# (배포 환경별로 다름)
```

### 11.2 롤백 계획

**옵션 1: Git 롤백**
```bash
git checkout main
# 애플리케이션 재시작
```

**옵션 2: 데이터베이스 롤백**
```sql
ALTER TABLE store_settings DROP COLUMN enable_waiting_board;
ALTER TABLE store_settings DROP COLUMN enable_reception_desk;
```

**옵션 3: 기능 토글**
- 관리 인터페이스를 통해 두 설정을 모두 TRUE로 설정
- 코드 변경 불필요

### 11.3 모니터링

**추적할 지표**:
- SSE 연결 수 (변경 전/후)
- 네트워크 트래픽 (bytes/분)
- SSE 상태 엔드포인트 에러율
- 페이지 로드 시간 (변경 없어야 함)

---

## 12. 향후 개선사항

### 12.1 잠재적 개선

1. **실시간 설정 업데이트**:
   - SSE를 통한 설정 변경 브로드캐스트
   - 새로고침 없이 자동 재연결/연결 해제

2. **매장별 분석**:
   - 매장별 SSE 사용량 추적
   - 비활성 기능에 대한 비활성화 권장

3. **세밀한 제어**:
   - 특정 SSE 이벤트 활성화/비활성화
   - 업데이트 빈도 조절

4. **관리자 오버라이드**:
   - 유지보수를 위한 시스템 전체 SSE 비활성화
   - 피크 시간대 임시 트래픽 감소

### 12.2 알려진 제한사항

1. **자동 새로고침 없음**: 설정 변경 시 페이지 새로고침 필요
2. **이진 제어**: 기능별 전체 활성화/비활성화만 가능 (부분 SSE 불가)
3. **지표 없음**: 앱 내에서 트래픽 감소 측정 안 됨
4. **대기관리자 항상 켜짐**: 대기관리자 페이지 SSE 비활성화 불가

---

## 13. 참고 자료

### 13.1 관련 파일

- `sse_manager.py` - SSE 연결 관리자
- `routers/sse.py` - SSE 스트림 엔드포인트
- `templates/manage.html` - 대기관리자 페이지 (영향 없음)

### 13.2 관련 문서

- `implementation_plan.md` - 원본 구현 계획
- `walkthrough.md` - 사용자 대상 문서
- `task.md` - 작업 분류 및 체크리스트

### 13.3 외부 리소스

- [Server-Sent Events 명세](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [FastAPI SSE 가이드](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [SQLAlchemy Boolean 타입](https://docs.sqlalchemy.org/en/14/core/type_basics.html#sqlalchemy.types.Boolean)

---

## 14. 부록

### 14.1 코드 스니펫

**완전한 SSE 상태 엔드포인트**:
```python
@router.get("/sse-status")
async def get_sse_status(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """SSE 연결 활성화 상태 조회"""
    settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()
    
    return {
        "enable_waiting_board": settings.enable_waiting_board if settings else True,
        "enable_reception_desk": settings.enable_reception_desk if settings else True
    }
```

### 14.2 데이터베이스 쿼리

**현재 설정 확인**:
```sql
SELECT enable_waiting_board, enable_reception_desk 
FROM store_settings 
WHERE store_id = ?;
```

**설정 업데이트**:
```sql
UPDATE store_settings 
SET enable_waiting_board = ?, enable_reception_desk = ? 
WHERE store_id = ?;
```

### 14.3 네트워크 트래픽 분석

**SSE 요청 예시**:
```
GET /api/sse/stream?store_id=1 HTTP/1.1
Host: localhost:8000
Accept: text/event-stream
Cache-Control: no-cache
```

**SSE 응답 예시**:
```
data: {"event":"ping","data":{"timestamp":1702627200}}

data: {"event":"new_user","data":{"id":123,"class_name":"1교시"}}
```

---

**문서 버전**: 1.0.0  
**최종 업데이트**: 2025-12-15  
**작성자**: 개발팀  
**검토 상태**: 대기 중
