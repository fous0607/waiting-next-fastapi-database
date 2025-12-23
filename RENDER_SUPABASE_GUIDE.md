# Render + Supabase 배포 가이드

**Frontend & Backend:** Render.com
**Database:** Supabase (PostgreSQL)
이 조합은 **안정성과 비용 효율이 가장 뛰어난 추천 구성**입니다.

## 1단계: Supabase 데이터베이스 생성 (무료)
1.  [Supabase](https://supabase.com/) 가입 및 로그인.
2.  **"New Project"** 클릭.
3.  Region을 **한국(Seoul)**로 선택하세요! (매우 중요: 속도 차이 큼)
4.  Database Password를 설정하고 **꼭 기억해두세요**.
5.  프로젝트가 생성되면 **Settings -> Database** 메뉴로 이동.
6.  **Connection String** -> **URI** 탭을 클릭.
7.  주소를 복사하세요. (형식: `postgresql://postgres:[비번]@db.xxx.supabase.co:5432/postgres`)
    *   복사한 주소의 `[YOUR-PASSWORD]` 부분을 아까 설정한 비번으로 바꿔야 합니다.

## 2단계: Render 배포 설정
1.  [Render Dashboard](https://dashboard.render.com/) 접속.
2.  **New +** -> **Blueprint** 선택.
3.  GitHub 저장소(`waiting-next-fastapi-database`) 연결.
4.  Render가 `render.yaml`을 인식하여 2개 서비스(Backend, Frontend)를 보여줍니다.
5.  **Backend 서비스 설정 창**에서:
    *   `DATABASE_URL` 항목에 **1단계에서 복사한 Supabase 주소**를 붙여넣으세요.
6.  **"Apply"** 버튼 클릭 -> 배포 시작!

## 3단계: 확인
배포가 완료되면 Render에서 제공하는 Frontend URL로 접속해 보세요.
Supabase DB와 연결되어 정상적으로 회원가입/로그인이 될 것입니다.

---
**Tip:** Supabase는 일주일간 접속이 없으면 "Pause(일시정지)" 됩니다. 대시보드에 들어가서 버튼만 누르면 다시 켜지니 걱정 마세요.
