# Vercel 배포 가이드

## 1. Supabase PostgreSQL 마이그레이션

로컬 SQLite에서 **Supabase PostgreSQL**로 데이터베이스를 성공적으로 전환했습니다.

### 마이그레이션 상태
- **연결**: 성공 (`aws-1-ap-northeast-2.pooler.supabase.com:5432`)
- **테이블**: 모든 시스템 테이블이 새 데이터베이스에 자동 생성됨
- **데이터**: 데이터베이스가 초기화됨 (빈 상태)

### 사용자 다음 단계
1. **서버 재시작**: 백엔드 서버를 재시작하여 새 데이터베이스 연결을 완전히 적용
   - `Ctrl+C`로 중지 후 `python main.py` 또는 시작 스크립트 실행
2. **초기 설정**: 새 데이터베이스이므로 첫 시작 시 `superadmin` 계정이 자동 생성됨
3. **로그인 확인**: 초기 superadmin 자격 증명으로 로그인하여 전체 기능 확인

### 기술 세부사항
- **설정**: `backend/.env`를 Transaction Pooler 연결 문자열로 업데이트
- **드라이버**: `psycopg2-binary`가 연결 처리 확인
- **시간대**: PostgreSQL 세션이 자동으로 `Asia/Seoul`로 설정됨

---

## 2. Vercel 백엔드 배포 문제 해결

Vercel에 백엔드를 배포할 때 **500 Internal Server Error**가 발생했습니다.
로그를 확인한 결과 `OSError: [Errno 30] Read-only file system: 'logs'` 오류가 발견되었습니다. 
이는 서버가 읽기 전용 서버리스 환경에서 로그 파일을 생성하려고 시도했기 때문입니다.

### 적용한 변경사항

#### 1) 백엔드 분리
- 전용 `backend/vercel.json` 생성
- `backend/` 디렉토리를 루트로 하는 별도의 `waiting-backend` Vercel 프로젝트 생성 권장

#### 2) 환경 변수 설정
- Frontend의 `NEXT_PUBLIC_API_URL`이 새 Backend URL을 가리키도록 설정
  - 예: `https://waiting-backend-neon.vercel.app`

#### 3) Logger 수정
- `backend/core/logger.py` 수정
- Vercel에서 실행 시 파일 로깅 비활성화 (`VERCEL=1` 환경 변수로 감지)

#### 4) 데이터베이스 초기화 수정
- `backend/main.py`의 `Base.metadata.create_all(bind=engine)` 호출을 Vercel 환경에서 비활성화
- 콜드 스타트 시 동기 데이터베이스 스키마 체크로 인한 타임아웃 및 500 오류 방지

### 검증 단계
1. **백엔드 재배포**: Push하면 새 배포가 트리거됨. "Ready" 상태 확인
2. **백엔드 상태 확인**: `https://waiting-backend-neon.vercel.app/docs` 방문
   - 500 오류 대신 Swagger UI가 로드되어야 함
3. **Frontend 로그인**: 백엔드가 작동하면 Frontend에서 로그인 시도
   - 성공적으로 인증되어야 함

---

## 3. 백엔드 성능 최적화 (리전 변경)

### 문제
백엔드가 작동하더라도 "너무 느림" 현상 발생

### 원인
- Vercel의 기본 함수 리전: "Washington, D.C., USA (iad1)"
- Supabase PostgreSQL 데이터베이스 위치: "Seoul, South Korea (ap-northeast-2)"
- 대륙 간 지연으로 인해 데이터베이스 상호작용이 크게 느려짐

### 해결 방법
Vercel 대시보드 설정에서 `waiting-backend` 프로젝트의 **Function Region**을 **`Seoul, South Korea (icn1)`**로 변경

---

## 4. 실시간 업데이트 마이그레이션 (SSE → Polling)

### 문제
Vercel의 Serverless 환경에서 Server-Sent Events(SSE)가 작동하지 않음
- 사용자가 새로고침해야만 대기자 목록이 업데이트됨
- "실시간 모니터링"에 활성 연결이 표시되지 않음

### 원인
현재 SSE 구현(`sse_manager.py`)은 **서버 메모리**에 연결 정보를 저장합니다.
Vercel은 요청마다 **새로운 서버(함수)를 실행하고 즉시 종료**합니다 (Stateless).

**예시:**
1. 고객이 SSE 연결 → A 서버 실행 (연결 목록: [고객1])
2. 직원이 대기 등록 → B 서버 실행 (연결 목록: [없음])
3. B 서버는 A 서버의 고객1을 모름 → **알림 실패**

### 해결 방법
Frontend를 **SWR을 사용한 Short Polling**으로 마이그레이션

#### 왜 이 변경이 문제를 해결하는가?
- **Stateless 호환**: Polling은 특정 서버 인스턴스에 대한 지속적인 연결이 필요하지 않음. Vercel의 임시 함수와 완벽하게 작동
- **신뢰성**: 시스템이 5초마다 최신 데이터를 가져와 "연결"이 끊어졌더라도 동기화 보장
- **통합 로직**: "관리자 뷰", "대기현황판", "접수 데스크" 모두 동일한 신뢰할 수 있는 polling 메커니즘 사용

### 변경 사항 요약
1. **새 Hook**: `usePolling.ts` 생성 - `useSWR`을 사용하여 5초마다 데이터 가져오기
2. **관리자 페이지**: `useSSE()`를 `usePolling()`으로 교체
3. **현황판 & 접수대**: `EventSource` 로직을 `useSWR` polling으로 교체
4. **모니터링**: `SSEMonitor`를 "Serverless Polling Mode"를 반영하도록 업데이트
5. **백업**: 원본 SSE 파일을 `.bak` 확장자로 백업

### 검증 방법
1. **배포**: 변경사항을 Push (완료)
2. **테스트**: 
   - 한 탭에서 대기현황판 열기
   - 다른 탭에서 관리자 화면 열기
   - 대기 고객 추가
3. **확인**: 현황판이 수동 새로고침 없이 **약 5초 이내**에 자동으로 업데이트되어야 함

---

## 전체 배포 체크리스트

### Backend (Vercel)
- [x] 별도의 `waiting-backend` Vercel 프로젝트 생성
- [x] Root Directory를 `backend`로 설정
- [x] 환경 변수 설정:
  - `DATABASE_URL` (Supabase Transaction Pooler)
  - `PUBLIC_DATA_API_KEY`
- [x] Function Region을 `Seoul, South Korea (icn1)`로 설정
- [x] Logger 파일 쓰기 비활성화 (`VERCEL` 환경 변수 체크)
- [x] DB 초기화 비활성화 (콜드 스타트 최적화)

### Frontend (Vercel)
- [x] 환경 변수 설정:
  - `NEXT_PUBLIC_API_URL=https://waiting-backend-neon.vercel.app`
- [x] SSE를 SWR Polling으로 마이그레이션
- [x] `swr` 패키지 설치

### 최종 확인
- [ ] Backend `/docs` 페이지 접속 확인
- [ ] Frontend 로그인 성공 확인
- [ ] 실시간 업데이트 작동 확인 (5초 이내 자동 갱신)
- [ ] 모든 페이지 정상 작동 확인 (관리자, 현황판, 접수대)
