# Next.js Waiting Manager Migration Walkthrough

## 🚀 Migration Status
Successfully migrated the **Waiting Manager** (`/manage`) page to Next.js 16.
The new system runs side-by-side with the legacy FastAPI backend.

### Key Features Implemented
- **Next.js 16 App Router**: Modern, server-first architecture.
- **Zustand Store**: Centralized state management for waiting lists, replacing scattered global variables.
- **Real-time Updates (SSE)**: `useSSE` hook automatically handles connection and events (`new_user`, `status_changed`, etc.).
- **Drag & Drop**: Implemented using `@dnd-kit` for smoother, touch-friendly reordering.
- **Shadcn UI**: Modern, accessible components (Cards, Badges, Dropdowns).
- **Zero-Config Proxy**: `next.config.ts` automatically proxies API requests to `localhost:8000`.

## 🛠️ How to Run & Test

You need **two** terminal windows running simultaneously.

### 1. Start Backend (Legacy Server)
If not already running:
```bash
# In the root directory
source venv/bin/activate
python main.py
```
> Server runs on `http://localhost:8000`

### 3. 매장 설정 (Store Settings)
- **URL**: `http://localhost:3000/settings`
- **주요 기능**:
    - **탭 구조**: 기본 설정, 클래스 관리, 고급 설정(준비중) 탭으로 구성
    - **기본 설정**: 매장명, 테마 색상(4종), 현황판 표시 설정 변경 및 즉시 반영
    - **클래스 관리**: 
        - 평일/주말/공휴일 탭 구분
        - 클래스 추가/수정/삭제 (CRUD) 기능
        - 순서, 시간, 정원 설정
    - **공휴일 관리**: 공휴일 클래스 설정 가능 (캘린더 연동 예정)

### 4. 주요 기술적 변경사항
- **Store**: `useWaitingStore` (Zustand) + `useSSE` (Real-time events)
- **Settings**: `react-hook-form` + `zod` 검증, `SettingsPage` Suspense 적용
- **Styling**: `shadcn/ui` (Tabs, Cards, Forms, Dialog, Table) + Tailwind v4

### 2. Start Frontend (Next.js)
```bash
# Open a new terminal
cd frontend
npm run dev
```
> Frontend runs on `http://localhost:3000`

### 3. Access new Waiting Manager
Open your browser to: **[http://localhost:3000/manage?store=1](http://localhost:3000/manage?store=1)**

> [!NOTE]
> Ensure you have `store=1` (or your active store ID) in the URL parameter, as the local storage logic mirrors the legacy system.

## 확인 방법 (Verification)

1. **서버 실행**:
   ```bash
   # Backend
   python main.py
   
   # Frontend
   cd frontend
   npm run dev
   ```

2. **매장 설정 테스트**:
   - `/settings` 페이지 접속
   - '기본 설정'에서 테마 변경 후 '저장' 클릭 -> 색상 변경 확인
   - '클래스 관리' 탭에서 '평일 클래스' 추가/수정/삭제 테스트

3. **대기 관리자 테스트**:
   - `/manage` 페이지 접속
   - 위에서 추가한 클래스가 탭에 반영되었는지 확인

- [ ] **Real-time**:
    1. Open `http://localhost:8000/reception` (Legacy Desk) in another tab.
    2. Register a new user.
    3. Watch it appear instantly on `localhost:3000/manage`.
- [ ] **Drag & Drop**: Try dragging a user to change order.
- [ ] **Status Change**: Click the menu icon -> "Cancel" or "Attend" and verify it updates.

## 📸 Screenshots
(Screenshots can be added here once functionality is visually verified)

## Next Steps
- Migrate `board` (Waiting Display) and `reception` (Kiosk) pages.
- Production build setup (exporting static files or using Node.js server).
