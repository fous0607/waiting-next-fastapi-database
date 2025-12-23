# 공지사항 입력 문제 해결 방법

## 문제 원인
`NoticeFormContent` 컴포넌트가 함수로 정의되어 있어서 매번 재생성되고, 이로 인해 입력 필드가 포커스를 잃는 문제가 발생합니다.

## 해결 방법

### 방법 1: useMemo 사용 (권장)

```tsx
// 1. useMemo import 추가 (이미 완료)
import React, { useState, useEffect, useMemo } from 'react';

// 2. NoticeFormContent를 useMemo로 감싸기
const NoticeFormContent = useMemo(() => (
    <div className="grid gap-4 py-4">
        {/* 기존 내용 */}
    </div>
), [title, category, targetType, selectedStores, selectedFranchiseId, content, attachmentIds, stores, franchises]);
```

### 방법 2: 인라인 JSX 사용 (간단)

다이얼로그에서 `<NoticeFormContent />` 대신 직접 JSX를 작성:

```tsx
<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
        <DialogTitle>새 공지사항 등록</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
        {/* 폼 내용 직접 작성 */}
    </div>
    <DialogFooter>
        {/* 버튼들 */}
    </DialogFooter>
</DialogContent>
```

### 방법 3: 별도 컴포넌트 파일로 분리

```tsx
// components/NoticeForm.tsx
export function NoticeForm({ title, setTitle, category, setCategory, ... }) {
    return (
        <div className="grid gap-4 py-4">
            {/* 폼 내용 */}
        </div>
    );
}

// 사용
<NoticeForm 
    title={title}
    setTitle={setTitle}
    category={category}
    setCategory={setCategory}
    ...
/>
```

## 현재 적용된 수정

1. ✅ `useMemo` import 추가
2. ⏳ `NoticeFormContent`를 `useMemo`로 감싸기 (수동 적용 필요)

## 수동 수정 방법

파일: `/frontend/app/superadmin/notices/page.tsx`

1. 309번 줄 찾기:
```tsx
const NoticeFormContent = () => (
```

2. 다음으로 변경:
```tsx
const NoticeFormContent = useMemo(() => (
```

3. 419번 줄 (NoticeFormContent의 마지막) 찾기:
```tsx
    );
```

4. 다음으로 변경:
```tsx
    ), [title, category, targetType, selectedStores, selectedFranchiseId, content, attachmentIds, stores, franchises]);
```

## 테스트 방법

1. 수정 후 페이지 새로고침
2. "공지 등록" 클릭
3. 제목 입력 필드에 여러 글자 입력
4. 리치 텍스트 에디터에 여러 글자 입력
5. 모든 글자가 정상적으로 입력되는지 확인
