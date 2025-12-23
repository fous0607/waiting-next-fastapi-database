import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Store {
    id: number;
    name: string;
    code: string;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
}

interface NoticeFormProps {
    title: string;
    setTitle: (value: string) => void;
    category: string;
    setCategory: (value: string) => void;
    targetType: 'all' | 'selected' | 'franchise' | 'program';
    setTargetType: (value: 'all' | 'selected' | 'franchise' | 'program') => void;
    selectedStores: number[];
    setSelectedStores: (value: number[]) => void;
    selectedFranchiseId: string;
    setSelectedFranchiseId: (value: string) => void;
    content: string;
    setContent: (value: string) => void;
    attachmentIds: number[];
    setAttachmentIds: (value: number[]) => void;
    stores: Store[];
    franchises: Franchise[];
    RichTextEditor: any;
    FileUploader: any;
}

const categoryLabels: Record<string, string> = {
    franchise: '프랜차이즈',
    store: '매장',
    selected: '일부 매장',
    program: '프로그램',
    general: '기타',
};

const targetTypeLabels: Record<string, string> = {
    all: '전체 매장',
    selected: '일부 매장',
    franchise: '프랜차이즈 공지',
    program: '프로그램 공지',
};

export function NoticeFormContent({
    title,
    setTitle,
    category,
    setCategory,
    targetType,
    setTargetType,
    selectedStores,
    setSelectedStores,
    selectedFranchiseId,
    setSelectedFranchiseId,
    content,
    setContent,
    attachmentIds,
    setAttachmentIds,
    stores,
    franchises,
    RichTextEditor,
    FileUploader,
}: NoticeFormProps) {
    return (
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="title">제목</Label>
                <Input
                    id="title"
                    placeholder="공지 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>

            <div className="grid gap-2">
                <Label>카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                        <SelectValue>{categoryLabels[category] || "카테고리 선택"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 100005, position: 'relative' }}>
                        <SelectItem value="franchise">프랜차이즈</SelectItem>
                        <SelectItem value="store">매장</SelectItem>
                        <SelectItem value="selected">일부 매장</SelectItem>
                        <SelectItem value="program">프로그램</SelectItem>
                        <SelectItem value="general">기타</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label>공지 대상</Label>
                <Select value={targetType} onValueChange={(value: any) => setTargetType(value)}>
                    <SelectTrigger>
                        <SelectValue>{targetTypeLabels[targetType] || "공지 대상을 선택하세요"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 100005, position: 'relative' }}>
                        <SelectItem value="all">전체 매장</SelectItem>
                        <SelectItem value="selected">일부 매장</SelectItem>
                        <SelectItem value="franchise">프랜차이즈 공지</SelectItem>
                        <SelectItem value="program">프로그램 공지</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {targetType === 'selected' && (
                <div className="grid gap-2">
                    <Label>매장 선택</Label>
                    <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                        {stores.map(store => (
                            <div key={store.id} className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                    id={`store-${store.id}`}
                                    checked={selectedStores.includes(store.id)}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedStores([...selectedStores, store.id]);
                                        } else {
                                            setSelectedStores(selectedStores.filter(id => id !== store.id));
                                        }
                                    }}
                                />
                                <label htmlFor={`store-${store.id}`} className="text-sm cursor-pointer">
                                    {store.name} ({store.code})
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(targetType === 'franchise' || targetType === 'program') && (
                <div className="grid gap-2">
                    <Label>프랜차이즈 선택</Label>
                    <Select value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
                        <SelectTrigger>
                            <SelectValue>
                                {selectedFranchiseId
                                    ? franchises.find(f => f.id.toString() === selectedFranchiseId)?.name || "프랜차이즈를 선택하세요"
                                    : "프랜차이즈를 선택하세요"
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 100005, position: 'relative' }}>
                            {franchises.map(franchise => (
                                <SelectItem key={franchise.id} value={franchise.id.toString()}>
                                    {franchise.name} ({franchise.code})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {targetType === 'program' && (
                        <p className="text-xs text-slate-500">
                            프로그램 공지는 선택한 프랜차이즈의 모든 매장에 표시되며, 설정에서 표시 여부를 제어할 수 있습니다.
                        </p>
                    )}
                </div>
            )}

            <div className="grid gap-2">
                <Label>내용</Label>
                <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="공지 내용을 입력하세요"
                />
            </div>

            <div className="grid gap-2">
                <Label>첨부파일</Label>
                <FileUploader
                    onFilesChange={setAttachmentIds}
                    maxFiles={5}
                    maxFileSize={10}
                />
            </div>
        </div>
    );
}
