# 프랜차이즈 시스템 구현 계획

## 1. 개요

단일 매장 시스템을 프랜차이즈 멀티 매장 시스템으로 전환합니다.

## 2. 아키텍처 선택

**하이브리드 멀티테넌시** (Single DB with Strong Isolation)

- 단일 SQLite 데이터베이스 유지
- Franchise → Stores 계층 구조
- 모든 운영 테이블에 store_id FK 추가
- Role-based Access Control

## 3. 데이터베이스 스키마

### 신규 테이블

**Franchise (프랜차이즈)**
```python
- id: Integer (PK)
- name: String (프랜차이즈명)
- code: String (프랜차이즈 코드, unique)
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime
```

**Store (매장)**
```python
- id: Integer (PK)
- franchise_id: Integer (FK → Franchise)
- name: String (매장명)
- code: String (매장 코드, unique)
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime
```

**User (사용자)**
```python
- id: Integer (PK)
- username: String (unique)
- password_hash: String
- role: String (franchise_admin, store_admin)
- franchise_id: Integer (FK → Franchise, nullable)
- store_id: Integer (FK → Store, nullable)
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime
```

### 기존 테이블 수정

모든 운영 테이블에 `store_id` 컬럼 추가:
- StoreSettings
- DailyClosing
- ClassInfo
- Member
- WaitingList
- ClassClosure
- WaitingHistory

## 4. 구현 단계

### Phase 1: 데이터베이스 마이그레이션 (우선순위: P0)

1. 새 모델 정의 (models.py)
   - Franchise 모델
   - Store 모델
   - User 모델

2. 기존 모델 수정
   - 모든 운영 모델에 store_id 추가
   - relationships 정의

3. 마이그레이션 스크립트 작성
   - 새 테이블 생성
   - 기본 프랜차이즈/매장 생성
   - 기존 데이터 마이그레이션
   - store_id 컬럼 추가 및 데이터 연결

4. Pydantic 스키마 업데이트 (schemas.py)
   - Franchise schemas
   - Store schemas
   - User schemas
   - 기존 schemas에 store_id 추가

### Phase 2: 인증 시스템 (우선순위: P0)

1. 인증 유틸리티 작성
   - 비밀번호 해싱 (bcrypt)
   - JWT 토큰 생성/검증
   - 현재 사용자 가져오기 (dependency)

2. 인증 라우터 (routers/auth.py)
   - POST /api/auth/login
   - POST /api/auth/logout
   - GET /api/auth/me

3. 권한 체크 미들웨어
   - get_current_user
   - get_current_store
   - require_franchise_admin
   - require_store_admin

### Phase 3: API 라우터 (우선순위: P0)

1. 프랜차이즈 관리 (routers/franchise.py)
   - GET /api/franchise/ - 프랜차이즈 정보
   - PUT /api/franchise/ - 프랜차이즈 수정
   - GET /api/franchise/stats - 통계

2. 매장 관리 (routers/stores.py)
   - GET /api/stores/ - 매장 목록
   - POST /api/stores/ - 매장 생성
   - GET /api/stores/{store_id} - 매장 상세
   - PUT /api/stores/{store_id} - 매장 수정
   - DELETE /api/stores/{store_id} - 매장 비활성화

3. 사용자 관리 (routers/users.py)
   - GET /api/users/ - 사용자 목록
   - POST /api/users/ - 사용자 생성
   - PUT /api/users/{user_id} - 사용자 수정
   - DELETE /api/users/{user_id} - 사용자 비활성화

4. 기존 라우터 수정
   - 모든 쿼리에 store_id 필터 추가
   - 현재 매장 정보 dependency injection
   - SSE는 이미 store_id 지원 (수정 최소)

### Phase 4: 프론트엔드 (우선순위: P1)

1. 로그인 페이지 (templates/login.html)
   - 사용자명/비밀번호 입력
   - JWT 토큰 저장

2. 프랜차이즈 대시보드 (templates/franchise_dashboard.html)
   - 매장 목록
   - 매장별 간단한 통계
   - 매장 추가 버튼

3. 매장 관리 페이지 (templates/store_management.html)
   - 매장 추가/수정/비활성화
   - 사용자 관리

4. 매장 선택 (templates/store_selector.html)
   - 로그인 후 매장 선택
   - 세션에 저장

5. 기존 페이지 수정
   - 헤더에 현재 매장 정보 표시
   - API 호출 시 인증 토큰 포함

### Phase 5: 마이그레이션 및 테스트 (우선순위: P0)

1. 기존 데이터 마이그레이션
   - 단일 프랜차이즈 생성
   - 단일 매장 생성
   - 모든 기존 데이터를 해당 매장에 연결

2. 테스트 데이터 생성
   - 복수 프랜차이즈
   - 복수 매장
   - 테스트 사용자

## 5. URL 구조

### 세션 기반 (추천)

```
/ → 로그인 페이지 (미인증) / 대시보드 (인증됨)
/login → 로그인
/logout → 로그아웃

/dashboard → 프랜차이즈/매장 대시보드
/stores → 매장 관리 (franchise_admin만)
/users → 사용자 관리 (franchise_admin만)

# 기존 URL 유지 (현재 선택된 매장 기준)
/board → 대기현황판
/reception → 대기접수
/mobile → 모바일 접수
/manage → 대기자 관리
/members → 회원 관리
/settings → 매장 설정
```

## 6. 보안

1. 비밀번호 해싱: bcrypt (cost=12)
2. JWT 토큰: 1시간 만료
3. HTTP-only 쿠키 저장
4. CORS 설정
5. SQL Injection 방지 (SQLAlchemy ORM)
6. XSS 방지 (템플릿 이스케이핑)

## 7. 기술 스택

**새로운 의존성:**
- `passlib[bcrypt]` - 비밀번호 해싱
- `python-jose[cryptography]` - JWT
- `python-multipart` - 폼 데이터

**기존 유지:**
- FastAPI
- SQLAlchemy
- SQLite
- Jinja2 템플릿

## 8. 마이그레이션 순서

1. 새 테이블 생성 (Franchise, Store, User)
2. 기본 데이터 생성
   - Franchise: "본사"
   - Store: "1호점"
   - User: "admin" (franchise_admin)
3. 기존 테이블에 store_id 컬럼 추가 (nullable)
4. 모든 기존 데이터를 1호점에 연결
5. store_id NOT NULL 제약 조건 추가
6. Foreign Key 제약 조건 추가

## 9. 롤백 계획

1. 데이터베이스 백업 필수
2. 마이그레이션 실패 시 롤백 스크립트
3. 기존 시스템 병행 운영 가능하도록 설계

## 10. 완료 기준

- [ ] 프랜차이즈/매장/사용자 생성 가능
- [ ] 로그인/로그아웃 동작
- [ ] 매장별 데이터 완전 격리
- [ ] 기존 기능 모두 정상 동작
- [ ] 프랜차이즈 관리자가 모든 매장 조회 가능
- [ ] 매장 관리자는 자신의 매장만 관리 가능
