# 공지사항 리치 텍스트 에디터 및 파일 첨부 기능 구현 계획

## 구현 완료

### 1. 리치 텍스트 에디터 (Tiptap) ✅
- **패키지 설치**: @tiptap/react, @tiptap/starter-kit 및 확장 기능들
- **컴포넌트**: `/frontend/components/RichTextEditor.tsx`
- **기능**:
  - 텍스트 서식: 굵게, 기울임, 밑줄
  - 제목: H1, H2, H3
  - 목록: 순서 있는 목록, 순서 없는 목록
  - 텍스트 색상 선택
  - 표 삽입 및 편집
  - 링크 삽입
  - 이미지 삽입 (URL)
  - 실행 취소/다시 실행

### 2. 데이터베이스 스키마 ✅
- **NoticeAttachment 모델 추가**:
  ```python
  class NoticeAttachment(Base):
      id: Integer (PK)
      notice_id: Integer (FK -> notices.id)
      filename: String (원본 파일명)
      stored_filename: String (저장된 파일명, UUID)
      file_size: Integer (bytes)
      file_type: String (MIME type)
      created_at: DateTime
  ```
- **Notice 모델 업데이트**:
  - `attachments` relationship 추가

### 3. 파일 저장 디렉토리 ✅
- `/backend/uploads/notices/` 디렉토리 생성

## 다음 단계 (구현 필요)

### 1. 파일 업로드 API
- **엔드포인트**: `POST /api/system/notices/upload`
- **기능**:
  - 파일 업로드 처리
  - 파일 크기 검증 (설정 가능)
  - 파일 타입 검증
  - UUID 기반 파일명 생성
  - 파일 저장
  - 첨부파일 정보 반환

### 2. 파일 다운로드 API
- **엔드포인트**: `GET /api/system/notices/download/{attachment_id}`
- **기능**:
  - 첨부파일 다운로드
  - 권한 체크

### 3. 공지사항 생성 API 수정
- 첨부파일 ID 목록 받기
- 공지사항과 첨부파일 연결

### 4. 공지사항 조회 API 수정
- 첨부파일 정보 포함하여 반환

### 5. 시스템 설정
- **파일 업로드 제한 설정**:
  - 최대 파일 크기 (MB)
  - 허용 파일 타입
  - 공지사항당 최대 첨부파일 수

### 6. 프론트엔드 파일 업로드 컴포넌트
- 드래그 앤 드롭 지원
- 파일 미리보기
- 업로드 진행률 표시
- 파일 삭제 기능

### 7. 공지사항 페이지 업데이트
- RichTextEditor 통합
- 파일 첨부 UI 추가
- 첨부파일 목록 표시

## 보안 고려사항
- 파일 타입 검증 (화이트리스트 방식)
- 파일 크기 제한
- 파일명 sanitization
- 권한 체크 (업로드, 다운로드)
- 바이러스 스캔 (선택사항)

## 설정 가능한 제한
- 최대 파일 크기: 10MB (기본값)
- 허용 파일 타입: 이미지(jpg, png, gif), 문서(pdf, doc, docx, xls, xlsx), 압축(zip)
- 공지사항당 최대 첨부파일 수: 5개 (기본값)
