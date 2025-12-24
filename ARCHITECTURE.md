# 프로젝트 아키텍처 가이드

## 🏗️ 시스템 구조 개요

이 프로젝트는 **듀얼 프론트엔드 아키텍처**를 사용합니다:

### 1️⃣ Next.js 프론트엔드 (Vercel 배포)
- **배포 URL**: https://waiting-next-fastapi-database.vercel.app
- **위치**: `/frontend` 디렉토리
- **기술 스택**: Next.js 16, React, TypeScript, Tailwind CSS, Shadcn UI
- **담당 페이지**:
  - `/login` - 로그인
  - `/admin/*` - 관리자 대시보드 (대기자 관리, 회원 관리, 출석 관리, 통계)
  - `/superadmin/*` - 슈퍼관리자 대시보드
  - `/settings` - 설정 페이지 ⚠️ **중요**
  - `/board` - 대기현황판 (Next.js 버전)

### 2️⃣ 백엔드 Jinja2 템플릿 (로컬 서버)
- **접속 URL**: http://localhost:8088 또는 http://posagent.kr:8088
- **위치**: `/backend/templates` 디렉토리
- **기술 스택**: FastAPI, Jinja2, Vanilla JavaScript, CSS
- **담당 페이지**:
  - `/` - 메인 대시보드 (index.html)
  - `/waiting-board` - 대기현황판 (Jinja2 버전)
  - `/reception` - 대기접수 데스크
  - `/admin/settings` - 설정 페이지 (Jinja2 버전) ⚠️ **중요**

---

## ⚠️ 중요: UI 수정 시 주의사항

### 설정 페이지 (Settings)
설정 페이지는 **두 곳**에 존재합니다:

#### Vercel 배포 (프로덕션)
- **파일**: `/frontend/components/settings/GeneralSettings.tsx`
- **URL**: https://waiting-next-fastapi-database.vercel.app/settings
- **수정 후**: Git push → Vercel 자동 배포 (1-2분 소요)

#### 로컬 백엔드
- **파일**: `/backend/templates/components/settings/store_tab.html`
- **URL**: http://localhost:8088/admin/settings
- **수정 후**: 백엔드 서버 재시작 필요

### 대기현황판 (Waiting Board)
대기현황판도 **두 곳**에 존재합니다:

#### Next.js 버전 (Vercel)
- **파일**: `/frontend/app/board/page.tsx`
- **URL**: https://waiting-next-fastapi-database.vercel.app/board

#### Jinja2 버전 (로컬)
- **파일**: `/backend/templates/waiting_board.html`
- **JavaScript**: `/backend/static/js/waiting_board.js`
- **CSS**: `/backend/static/css/waiting_board.css`
- **URL**: http://localhost:8088/waiting-board

---

## 📝 수정 작업 체크리스트

### UI 컴포넌트 추가/수정 시

1. **어느 환경에서 사용되는가?**
   - Vercel 프로덕션? → `/frontend` 수정
   - 로컬 백엔드? → `/backend/templates` 수정
   - **둘 다?** → 양쪽 모두 수정 필요! ⚠️

2. **설정 관련 변경사항**
   ```bash
   # 1. Next.js 프론트엔드 수정
   frontend/components/settings/GeneralSettings.tsx
   
   # 2. 백엔드 Jinja2 템플릿 수정
   backend/templates/components/settings/store_tab.html
   
   # 3. 백엔드 JavaScript 로직 확인 (필요시)
   backend/static/js/settings.js
   ```

3. **대기현황판 관련 변경사항**
   ```bash
   # 1. Next.js 버전
   frontend/app/board/page.tsx
   
   # 2. Jinja2 버전
   backend/templates/waiting_board.html
   backend/static/js/waiting_board.js
   backend/static/css/waiting_board.css
   ```

---

## 🔄 배포 프로세스

### Vercel (Next.js 프론트엔드)
```bash
git add frontend/
git commit -m "feat: ..."
git push
# → Vercel 자동 배포 (1-2분)
```

### 로컬 백엔드 (Jinja2)
```bash
# 서버 재시작
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8088
```

---

## 🎯 실전 예시: 글자 크기 옵션 추가

최근 "현황판 글자 크기에 50px, 60px, 70px 추가" 작업:

### ❌ 실수한 경우
```bash
# backend/templates/components/settings/store_tab.html만 수정
# → Vercel에서는 변경사항이 보이지 않음!
```

### ✅ 올바른 방법
```bash
# 1. Next.js 프론트엔드 수정
frontend/components/settings/GeneralSettings.tsx

# 2. 백엔드 Jinja2 템플릿 수정
backend/templates/components/settings/store_tab.html

# 3. 커밋 & 푸시
git add frontend/ backend/
git commit -m "feat: Add 50px, 60px, 70px font size options"
git push
```

---

## 📚 참고: 파일 구조

```
프로젝트 루트/
├── frontend/                    # Next.js 프론트엔드 (Vercel)
│   ├── app/
│   │   ├── admin/              # 관리자 페이지
│   │   ├── superadmin/         # 슈퍼관리자 페이지
│   │   ├── settings/           # 설정 페이지 ⚠️
│   │   └── board/              # 대기현황판 (Next.js)
│   └── components/
│       └── settings/
│           └── GeneralSettings.tsx  # 설정 UI ⚠️
│
└── backend/                     # FastAPI 백엔드
    ├── templates/               # Jinja2 템플릿
    │   ├── index.html          # 메인 대시보드
    │   ├── waiting_board.html  # 대기현황판 (Jinja2) ⚠️
    │   └── components/
    │       └── settings/
    │           └── store_tab.html  # 설정 UI (Jinja2) ⚠️
    └── static/
        ├── js/
        │   ├── settings.js     # 설정 로직
        │   └── waiting_board.js # 현황판 로직
        └── css/
            └── waiting_board.css
```

---

## 💡 팁

1. **Vercel 배포 확인**: https://vercel.com/dashboard 에서 배포 상태 확인
2. **브라우저 캐시**: 변경사항이 안 보이면 `Cmd+Shift+R` (강력 새로고침)
3. **개발 시**: 로컬에서 테스트 후 Vercel 배포
4. **의심스러울 때**: 양쪽 다 확인하고 수정!

---

**마지막 업데이트**: 2024-12-24
