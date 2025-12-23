# 공지사항 검색, 카테고리, 수정 기능 구현 완료

## 🎉 추가된 기능

### 1. 카테고리 분류 ✅
- **프랜차이즈**: 프랜차이즈 관련 공지
- **매장**: 매장 관련 공지  
- **일부 매장**: 선택된 매장 공지
- **프로그램**: 프로그램 관련 공지
- **기타**: 일반 공지

### 2. 검색 기능 ✅
- 제목 및 내용으로 검색
- 실시간 검색 지원
- API: `GET /api/system/notices?search={keyword}`

### 3. 카테고리 필터 ✅
- 카테고리별 공지사항 필터링
- API: `GET /api/system/notices?category={category}`

### 4. 공지사항 수정 ✅
- 기존 공지사항 수정 기능
- API: `PUT /api/system/notices/{notice_id}`
- 제목, 내용, 카테고리, 대상, 첨부파일 모두 수정 가능

### 5. 공지사항 삭제 ✅
- API: `DELETE /api/system/notices/{notice_id}`

## 📊 백엔드 API 변경사항

### 데이터베이스:
```sql
ALTER TABLE notices ADD COLUMN category VARCHAR DEFAULT 'general';
```

### Notice 모델:
```python
category = Column(String, default="general")  # franchise, store, selected, program, general
```

### API 엔드포인트:

#### 1. 공지사항 조회 (검색 및 필터링)
```
GET /api/system/notices?search={keyword}&category={category}
```

#### 2. 공지사항 생성
```
POST /api/system/notices
Body: {
  "title": "제목",
  "content": "내용",
  "category": "franchise",  // 추가됨
  "target_type": "all",
  "attachment_ids": [1, 2, 3]
}
```

#### 3. 공지사항 수정
```
PUT /api/system/notices/{notice_id}
Body: {
  "title": "수정된 제목",
  "content": "수정된 내용",
  "category": "store",
  "target_type": "selected",
  "target_store_ids": [1, 2],
  "attachment_ids": [4, 5]
}
```

#### 4. 공지사항 삭제
```
DELETE /api/system/notices/{notice_id}
```

## 🔜 프론트엔드 구현 필요

다음 컴포넌트를 업데이트해야 합니다:

### 1. 검색 바 추가
```tsx
<Input
  placeholder="제목 또는 내용으로 검색..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

### 2. 카테고리 필터 추가
```tsx
<Select value={categoryFilter} onValueChange={setCategoryFilter}>
  <SelectItem value="all">전체</SelectItem>
  <SelectItem value="franchise">프랜차이즈</SelectItem>
  <SelectItem value="store">매장</SelectItem>
  <SelectItem value="selected">일부 매장</SelectItem>
  <SelectItem value="program">프로그램</SelectItem>
  <SelectItem value="general">기타</SelectItem>
</Select>
```

### 3. 수정 버튼 및 다이얼로그
- 공지사항 목록에 수정 버튼 추가
- 수정 다이얼로그 (기존 데이터 로드)
- PUT API 호출

### 4. 삭제 버튼
- 삭제 확인 다이얼로그
- DELETE API 호출

## 카테고리 매핑

```typescript
const categoryLabels = {
  franchise: '프랜차이즈',
  store: '매장',
  selected: '일부 매장',
  program: '프로그램',
  general: '기타'
};

const categoryColors = {
  franchise: 'bg-purple-100 text-purple-700',
  store: 'bg-blue-100 text-blue-700',
  selected: 'bg-slate-100 text-slate-700',
  program: 'bg-green-100 text-green-700',
  general: 'bg-orange-100 text-orange-700'
};
```

## 구현 진행률
- ✅ 백엔드 API: 100%
- ⏳ 프론트엔드 UI: 0%
