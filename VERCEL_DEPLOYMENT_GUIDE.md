# Vercel 배포 및 PostgreSQL 연동 가이드

## 아키텍처 개요
사용자분의 환경(NAS, Docker)을 고려했을 때 가장 이상적인 구조입니다.
1.  **Frontend:** Vercel (클라우드)에서 배포되어 전 세계 어디서든 빠르게 접속
2.  **Backend:** NAS (Docker)에서 실행되어 데이터 처리
3.  **Database:** NAS (Docker)에 있는 PostgreSQL 사용

## 1단계: Backend PostgreSQL 연결 (NAS 작업)

### 1-1. `docker-compose.yaml` 설정 (이미 추가됨)
제가 `docker-compose.yaml` 파일에 `DATABASE_URL` 설정을 추가해 두었습니다. 본인의 PostgreSQL 정보에 맞게 수정해야 합니다.
```yaml
environment:
  - DATABASE_URL=postgresql://[아이디]:[비밀번호]@[NAS_IP]:[포트]/waiting_system
```
*   **주의:** Docker 컨테이너 내부에서 Host(NAS)의 DB에 접근하려면 `host.docker.internal` 또는 NAS의 `내부 IP`(예: 192.168.0.x)를 사용해야 합니다.

### 1-2. 코드 적용
코드는 이미 준비되어 있습니다. `backend/database.py`가 자동으로 `DATABASE_URL` 환경 변수를 감지하여 SQLite 대신 PostgreSQL을 사용합니다.
- 변경 후 `docker-compose up -d --build`로 백엔드를 재시작하면 DB 연결이 전환됩니다.

---

## 2단계: Vercel에 Frontend 배포

### 2-1. Vercel 프로젝트 생성
1.  [Vercel 대시보드](https://vercel.com/dashboard) 접속
2.  **"Add New..."** -> **"Project"** 클릭
3.  **"Import Git Repository"**에서 방금 올린 `waiting-next-fastapi-database` 저장소 선택 (GitHub 연동 필요)

### 2-2. 배포 설정 (중요!)
Vercel 설정 화면에서 다음 항목을 정확히 입력해야 합니다.

*   **Framework Preset:** Next.js (자동 선택됨)
*   **Root Directory:** `frontend` (Edit 버튼 눌러서 선택 필수!)
*   **Environment Variables (환경 변수):**
    *   `NEXT_PUBLIC_API_URL`: `https://posagent.kr:[백엔드포트]/api`
        *   (설명: 사용자의 브라우저가 접속할 NAS 백엔드의 **외부 주소**입니다. HTTPS 적용 권장)

### 2-3. Deploy 클릭
설정이 끝났으면 **"Deploy"** 버튼을 누릅니다. 잠시 후 배포가 완료되고 URL이 생성됩니다.

---

## 3단계: 네트워크 확인
이 구조가 작동하려면 외부(Vercel에서 접속한 사용자 브라우저)에서 NAS의 Backend로 접속이 가능해야 합니다.

1.  공유기에서 **포트 포워딩** 확인: `8088` (또는 백엔드 포트) -> NAS IP
2.  **CORS 설정:** 현재 백엔드(`main.py`)의 `CORSMiddleware` 설정이 Vercel 도메인을 허용해야 합니다. (기본적으로 `allow_origins=["*"]`라면 문제없음)
