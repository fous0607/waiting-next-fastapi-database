# 웨이팅 시스템 (Waiting Management System)

FastAPI 기반의 매장 대기 관리 시스템입니다. 교시별 대기자 관리, 일마감, 회원 관리 등의 기능을 제공합니다.

## 주요 기능

### 1. 일마감 기능
- 영업 개점/마감 관리
- 일자별 대기번호 자동 초기화 (1번부터 시작)
- 마감 시 자동 통계 계산 및 저장
- 일자별 데이터 조회

### 2. 클래스(교시) 관리
- 교시 등록 (시간, 수용 인원 설정)
- 교시별 대기 인원 관리
- 교시 활성화/비활성화

### 3. 대기현황판
- 실시간 대기 현황 표시
- 교시별 대기자 목록 표시
- 가로/세로 방향 설정 가능
- 자동 새로고침 (5초마다)

### 4. 대기 접수
- **데스크용 접수**: 키패드 UI로 빠른 접수
- **모바일용 접수**: 고객 셀프 접수 + 대기 조회
- 핸드폰번호 기반 접수 (010 고정)
- 회원 자동 매칭 (이름 표시)
- 자동 클래스 배치

### 5. 대기자 현황 관리
- 출석/취소 처리
- 대기 순서 변경 (위/아래)
- 교시 간 이동 (좌/우)
- 호출 기능
- 교시별 일괄 출석

### 6. 회원 관리
- 회원 등록/수정/삭제
- 이름/핸드폰번호 검색
- 엑셀 일괄 등록
- 엑셀 검수 기능 (오류 필터링)

### 7. 매장 설정
- 매장명 설정
- 대기현황판 표시 설정
  - 표시 클래스 개수
  - 리스트 방향 (가로/세로)
  - 클래스당 줄 수
- 관리자 비밀번호

## 시스템 요구사항

- Python 3.8 이상
- SQLite3 (기본 내장)

## 설치 방법

1. 저장소 클론 또는 다운로드

2. 가상환경 생성 및 활성화
```bash
# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화 (Mac/Linux)
source venv/bin/activate

# 가상환경 활성화 (Windows)
venv\Scripts\activate
```

3. 의존성 패키지 설치
```bash
pip install -r requirements.txt
```

4. 서버 실행
```bash
python main.py
```

5. 웹브라우저에서 접속
```
http://localhost:8000
```

## 프로젝트 구조

```
waiting/
├── main.py                 # FastAPI 애플리케이션 메인
├── database.py            # 데이터베이스 연결 설정
├── models.py              # SQLAlchemy 모델
├── schemas.py             # Pydantic 스키마
├── requirements.txt       # 의존성 패키지
├── routers/              # API 라우터
│   ├── daily_closing.py  # 일마감 API
│   ├── store_settings.py # 매장 설정 API
│   ├── class_management.py # 클래스 관리 API
│   ├── waiting.py        # 대기 접수 API
│   ├── waiting_board.py  # 대기자 관리 API
│   └── members.py        # 회원 관리 API
├── templates/            # HTML 템플릿
│   ├── index.html        # 메인 페이지
│   ├── waiting_board.html # 대기현황판
│   ├── reception.html    # 데스크 접수
│   ├── mobile.html       # 모바일 접수
│   ├── manage.html       # 대기자 관리
│   ├── members.html      # 회원 관리
│   └── settings.html     # 매장 설정
└── static/               # 정적 파일
    └── css/
        └── common.css    # 공통 스타일

```

## 사용 흐름

1. **초기 설정**
   - 매장 설정에서 매장명, 표시 설정 구성
   - 클래스 추가 (예: 1교시 10:00-11:00, 2교시 11:00-12:00)

2. **영업 시작**
   - 메인 페이지에서 "개점하기" 클릭
   - 대기번호 1번부터 시작

3. **대기 접수**
   - 데스크: 접수 화면에서 핸드폰번호 입력
   - 모바일: 고객이 직접 핸드폰번호 입력

4. **대기 관리**
   - 대기자 관리 화면에서 출석/취소 처리
   - 순서 변경, 교시 이동 가능
   - 교시별 일괄 출석

5. **대기현황판**
   - TV 또는 모니터에 표시
   - 실시간 대기 현황 확인

6. **일마감**
   - 메인 페이지에서 "일마감" 클릭
   - 통계 자동 계산 및 저장
   - 다음 날 다시 개점

## API 엔드포인트

### 일마감
- `POST /api/daily/open` - 개점
- `POST /api/daily/close` - 마감
- `GET /api/daily/current` - 현재 영업일 조회
- `GET /api/daily/check-status` - 영업 상태 확인
- `GET /api/daily/statistics/{date}` - 일별 통계

### 매장 설정
- `GET /api/store/` - 설정 조회
- `PUT /api/store/` - 설정 수정
- `POST /api/store/verify-password` - 비밀번호 확인

### 클래스 관리
- `GET /api/classes/` - 클래스 목록
- `POST /api/classes/` - 클래스 등록
- `PUT /api/classes/{id}` - 클래스 수정
- `DELETE /api/classes/{id}` - 클래스 비활성화
- `POST /api/classes/{id}/activate` - 클래스 활성화

### 대기 접수
- `POST /api/waiting/register` - 대기 접수
- `GET /api/waiting/check/{phone}` - 대기 조회
- `GET /api/waiting/list` - 대기자 목록
- `GET /api/waiting/list/by-class` - 클래스별 대기자 목록

### 대기자 관리
- `GET /api/board/display` - 대기현황판 데이터
- `PUT /api/board/{id}/status` - 상태 변경 (출석/취소)
- `POST /api/board/{id}/call` - 호출
- `PUT /api/board/{id}/order` - 순서 변경
- `PUT /api/board/{id}/move-class` - 클래스 이동
- `POST /api/board/batch-attendance` - 일괄 출석

### 회원 관리
- `GET /api/members/` - 회원 목록
- `POST /api/members/` - 회원 등록
- `PUT /api/members/{id}` - 회원 수정
- `DELETE /api/members/{id}` - 회원 삭제
- `POST /api/members/upload-excel` - 엑셀 업로드 검수
- `POST /api/members/bulk` - 일괄 등록

## 데이터베이스 스키마

### StoreSettings (매장 설정)
- 매장명, 표시 설정, 관리자 비밀번호

### DailyClosing (일마감)
- 영업일, 개점/마감 시간, 통계

### ClassInfo (클래스)
- 교시 번호/명, 시간, 수용 인원

### Member (회원)
- 이름, 핸드폰번호

### WaitingList (대기자)
- 대기번호, 핸드폰, 이름, 교시, 순서, 상태

## 추가 개선 가능 사항

1. **알림 기능**
   - SMS/카카오톡 알림
   - 대기 순서 임박 알림

2. **통계 대시보드**
   - 일/월별 방문자 통계
   - 교시별 이용률 분석

3. **노쇼 관리**
   - 호출 후 미응답 처리
   - 패널티 기록

4. **QR 코드**
   - 대기 접수 시 QR 생성
   - QR로 빠른 조회

5. **다국어 지원**
   - 한국어/영어 전환

6. **데이터 백업**
   - 자동 백업 스케줄링
   - 복구 기능

## 라이센스

MIT License

## 기술 스택

- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Excel**: openpyxl

## 지원 및 문의

문제가 발생하거나 개선 사항이 있다면 이슈를 등록해주세요.
