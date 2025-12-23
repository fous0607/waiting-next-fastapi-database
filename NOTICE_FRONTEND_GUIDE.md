# 공지사항 검색, 카테고리, 수정 기능 - 프론트엔드 구현 가이드

## 필요한 변경사항

### 1. Notice 인터페이스에 category 추가

```typescript
export interface Notice {
    id: number;
    title: string;
    content: string;
    target_type: 'all' | 'selected' | 'franchise' | 'program';
    category?: string;  // 추가
    is_active: boolean;
    created_at: string;
    author_name?: string;
    franchise_id?: number | null;
    franchise_name?: string | null;
}
```

### 2. 카테고리 관련 상수 추가

```typescript
const categoryLabels: Record<string, string> = {
    franchise: '프랜차이즈',
    store: '매장',
    selected: '일부 매장',
    program: '프로그램',
    general: '기타',
};

const categoryColors: Record<string, string> = {
    franchise: 'bg-purple-100 text-purple-700',
    store: 'bg-blue-100 text-blue-700',
    selected: 'bg-slate-100 text-slate-700',
    program: 'bg-green-100 text-green-700',
    general: 'bg-orange-100 text-orange-700',
};
```

### 3. 상태 변수 추가

```typescript
// 검색 및 필터
const [searchQuery, setSearchQuery] = useState('');
const [categoryFilter, setCategoryFilter] = useState('all');

// 수정 모드
const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
const [editOpen, setEditOpen] = useState(false);

// 카테고리 (폼)
const [category, setCategory] = useState('general');
```

### 4. loadNotices 함수 수정 (검색 및 필터 지원)

```typescript
const loadNotices = async () => {
    try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
        
        const response = await fetch(`/api/system/notices?${params.toString()}`, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to load notices');
        }

        const data = await response.json();
        setNotices(data);
    } catch (e) {
        console.error(e);
        toast.error('공지사항을 불러오는데 실패했습니다.');
    } finally {
        setLoading(false);
    }
};

// 검색어나 필터 변경 시 자동 로드
useEffect(() => {
    const timer = setTimeout(() => {
        loadNotices();
    }, 300); // 디바운스
    return () => clearTimeout(timer);
}, [searchQuery, categoryFilter]);
```

### 5. 검색 바 및 필터 UI 추가

```tsx
<div className="flex gap-4 mb-4">
    {/* 검색 바 */}
    <Input
        placeholder="제목 또는 내용으로 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
    />
    
    {/* 카테고리 필터 */}
    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="카테고리" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="franchise">프랜차이즈</SelectItem>
            <SelectItem value="store">매장</SelectItem>
            <SelectItem value="selected">일부 매장</SelectItem>
            <SelectItem value="program">프로그램</SelectItem>
            <SelectItem value="general">기타</SelectItem>
        </SelectContent>
    </Select>
</div>
```

### 6. 공지사항 생성 폼에 카테고리 추가

```tsx
<div className="grid gap-2">
    <Label>카테고리</Label>
    <Select value={category} onValueChange={setCategory}>
        <SelectTrigger>
            <SelectValue placeholder="카테고리 선택" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="franchise">프랜차이즈</SelectItem>
            <SelectItem value="store">매장</SelectItem>
            <SelectItem value="selected">일부 매장</SelectItem>
            <SelectItem value="program">프로그램</SelectItem>
            <SelectItem value="general">기타</SelectItem>
        </SelectContent>
    </Select>
</div>
```

### 7. handleSubmit에 category 추가

```typescript
body: JSON.stringify({
    title,
    content,
    target_type: targetType,
    category: category,  // 추가
    target_store_ids: selectedStores,
    franchise_id: selectedFranchiseId ? parseInt(selectedFranchiseId) : null,
    attachment_ids: attachmentIds,
    is_active: true
}),
```

### 8. 수정 기능 추가

```typescript
const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setTargetType(notice.target_type);
    setCategory(notice.category || 'general');
    setSelectedFranchiseId(notice.franchise_id?.toString() || '');
    setEditOpen(true);
};

const handleUpdate = async () => {
    if (!editingNotice) return;
    
    try {
        setSubmitting(true);
        const response = await fetch(`/api/system/notices/${editingNotice.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                title,
                content,
                target_type: targetType,
                category: category,
                target_store_ids: selectedStores,
                franchise_id: selectedFranchiseId ? parseInt(selectedFranchiseId) : null,
                attachment_ids: attachmentIds,
                is_active: true
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to update notice');
        }

        toast.success('공지사항이 수정되었습니다.');
        setEditOpen(false);
        loadNotices();
    } catch (error) {
        console.error('Update error:', error);
        toast.error('공지사항 수정에 실패했습니다.');
    } finally {
        setSubmitting(false);
    }
};
```

### 9. 삭제 기능 추가

```typescript
const handleDelete = async (noticeId: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/system/notices/${noticeId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to delete notice');
        }

        toast.success('공지사항이 삭제되었습니다.');
        loadNotices();
    } catch (error) {
        console.error('Delete error:', error);
        toast.error('공지사항 삭제에 실패했습니다.');
    }
};
```

### 10. 테이블에 수정/삭제 버튼 추가

```tsx
import { Edit, Trash2 } from 'lucide-react';

<TableCell className="text-right">
    <div className="flex gap-2 justify-end">
        <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(notice)}
        >
            <Edit className="w-4 h-4" />
        </Button>
        <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(notice.id)}
            className="text-red-600 hover:text-red-700"
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    </div>
</TableCell>
```

### 11. 카테고리 배지 표시

```tsx
{notice.category && (
    <Badge className={categoryColors[notice.category]}>
        {categoryLabels[notice.category]}
    </Badge>
)}
```

## 완성된 기능

- ✅ 검색 (제목/내용)
- ✅ 카테고리 필터
- ✅ 카테고리 분류 (프랜차이즈, 매장, 일부 매장, 프로그램, 기타)
- ✅ 공지사항 수정
- ✅ 공지사항 삭제
- ✅ 카테고리 배지 표시

## 테스트 방법

1. 검색 바에 키워드 입력하여 검색 테스트
2. 카테고리 필터 선택하여 필터링 테스트
3. 공지사항 생성 시 카테고리 선택
4. 수정 버튼 클릭하여 기존 공지 수정
5. 삭제 버튼 클릭하여 공지 삭제
