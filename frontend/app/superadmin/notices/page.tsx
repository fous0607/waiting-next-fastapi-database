'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { NoticeFormContent } from '@/components/NoticeFormContent';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
    ssr: false,
    loading: () => <div className="border rounded-md p-4 min-h-[200px] bg-slate-50">에디터 로딩 중...</div>
});

const FileUploader = dynamic(() => import('@/components/FileUploader'), {
    ssr: false,
    loading: () => <div className="border rounded-md p-4 bg-slate-50">파일 업로더 로딩 중...</div>
});

export interface Notice {
    id: number;
    title: string;
    content: string;
    target_type: 'all' | 'selected' | 'franchise' | 'program';
    category: string;
    is_active: boolean;
    created_at: string;
    author_name?: string;
    franchise_id?: number | null;
    franchise_name?: string | null;
    target_store_ids?: number[];
}

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

const targetTypeLabels: Record<string, string> = {
    all: '전체 매장',
    selected: '일부 매장',
    franchise: '프랜차이즈 공지',
    program: '프로그램 공지',
};

const targetTypeColors: Record<string, string> = {
    all: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    selected: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    franchise: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    program: 'bg-green-100 text-green-700 hover:bg-green-200',
};

const categoryLabels: Record<string, string> = {
    general: '일반',
    urgent: '긴급',
    event: '이벤트',
    system: '시스템',
};

export default function NoticePage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [stores, setStores] = useState<Store[]>([]);
    const [franchises, setFranchises] = useState<Franchise[]>([]);

    // Form State
    const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('general');
    const [targetType, setTargetType] = useState<'all' | 'selected' | 'franchise' | 'program'>('all');
    const [selectedStores, setSelectedStores] = useState<number[]>([]);
    const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
    const [attachmentIds, setAttachmentIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadNotices();
    }, []);

    useEffect(() => {
        if (open || editOpen) {
            loadStores();
            loadFranchises();
        }
    }, [open, editOpen]);

    const loadNotices = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/system/notices', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to load notices');
            }

            const data = await response.json();
            setNotices(data);
        } catch (error) {
            console.error(error);
            toast.error('공지사항을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const loadStores = async () => {
        try {
            const response = await fetch('/api/system/stores', {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to load stores');
            const data = await response.json();
            setStores(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadFranchises = async () => {
        try {
            const response = await fetch('/api/system/franchises', {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to load franchises');
            const data = await response.json();
            setFranchises(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreateOpen = () => {
        setTitle('');
        setContent('');
        setCategory('general');
        setTargetType('all');
        setSelectedStores([]);
        setSelectedFranchiseId('');
        setAttachmentIds([]);
        setEditingNoticeId(null);
        setOpen(true);
    };

    const handleEdit = (notice: Notice) => {
        setEditingNoticeId(notice.id);
        setTitle(notice.title);
        setContent(notice.content);
        setCategory(notice.category || 'general');
        setTargetType(notice.target_type);
        setSelectedStores(notice.target_store_ids || []);
        setSelectedFranchiseId(notice.franchise_id ? notice.franchise_id.toString() : '');
        // 첨부파일은 현재 로직상 새로 업로드하지 않으면 유지됨 (빈 배열이면 업데이트 안 함)
        setAttachmentIds([]);
        setEditOpen(true);
    };

    const handleSubmit = async () => {
        if (!title || !content) {
            toast.error('제목과 내용을 입력해주세요.');
            return;
        }
        if (targetType === 'selected' && selectedStores.length === 0) {
            toast.error('대상 매장을 선택해주세요.');
            return;
        }
        if ((targetType === 'franchise' || targetType === 'program') && !selectedFranchiseId) {
            toast.error('프랜차이즈를 선택해주세요.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                title,
                content,
                category,
                target_type: targetType,
                target_store_ids: selectedStores,
                franchise_id: selectedFranchiseId ? parseInt(selectedFranchiseId) : null,
                attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
                is_active: true
            };

            const response = await fetch('/api/system/notices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to create notice');

            toast.success('공지사항이 등록되었습니다.');
            setOpen(false);
            loadNotices();
        } catch (error) {
            console.error(error);
            toast.error('공지사항 등록 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingNoticeId) return;
        if (!title || !content) {
            toast.error('제목과 내용을 입력해주세요.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                title,
                content,
                category,
                target_type: targetType,
                target_store_ids: selectedStores,
                franchise_id: selectedFranchiseId ? parseInt(selectedFranchiseId) : null,
                attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined, // 첨부파일 변경 사항 있을 때만 보냄
            };

            const response = await fetch(`/api/system/notices/${editingNoticeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to update notice');

            toast.success('공지사항이 수정되었습니다.');
            setEditOpen(false);
            loadNotices();
        } catch (error) {
            console.error(error);
            toast.error('공지사항 수정 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, noticeId: number) => {
        e.stopPropagation(); // 행 클릭 이벤트 전파 방지
        if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`/api/system/notices/${noticeId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to delete notice');

            toast.success('공지사항이 삭제되었습니다.');
            loadNotices();
        } catch (error) {
            console.error(error);
            toast.error('공지사항 삭제 실패');
        }
    };

    // Memoize the form content to prevent unnecessary re-renders of the editor
    const MemoizedFormContent = useMemo(() => (
        <NoticeFormContent
            title={title}
            setTitle={setTitle}
            category={category}
            setCategory={setCategory}
            targetType={targetType}
            setTargetType={setTargetType as any}
            selectedStores={selectedStores}
            setSelectedStores={setSelectedStores}
            selectedFranchiseId={selectedFranchiseId}
            setSelectedFranchiseId={setSelectedFranchiseId}
            content={content}
            setContent={setContent}
            attachmentIds={attachmentIds}
            setAttachmentIds={setAttachmentIds}
            stores={stores}
            franchises={franchises}
            RichTextEditor={RichTextEditor}
            FileUploader={FileUploader}
        />
    ), [title, category, targetType, selectedStores, selectedFranchiseId, content, attachmentIds, stores, franchises]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">공지사항 관리</h2>

                </div>

                {/* Create Dialog */}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateOpen}>
                            <Plus className="w-4 h-4 mr-2" />
                            공지 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>새 공지사항 등록</DialogTitle>
                            <DialogDescription>
                                새로운 공지사항을 등록합니다. 대상과 내용을 입력해주세요.
                            </DialogDescription>
                        </DialogHeader>

                        {MemoizedFormContent}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                등록하기
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>공지사항 수정</DialogTitle>
                            <DialogDescription>
                                등록된 공지사항의 내용을 수정합니다.
                            </DialogDescription>
                        </DialogHeader>

                        {MemoizedFormContent}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditOpen(false)}>취소</Button>
                            <Button onClick={handleUpdate} disabled={submitting}>
                                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                수정 저장
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[80px] text-center">No</TableHead>
                                <TableHead className="w-[100px] text-center">분류</TableHead>
                                <TableHead>제목</TableHead>
                                <TableHead className="w-[150px] text-center">대상</TableHead>
                                <TableHead className="w-[150px]">작성자</TableHead>
                                <TableHead className="w-[150px]">작성일</TableHead>
                                <TableHead className="w-[80px] text-center">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                    </TableCell>
                                </TableRow>
                            ) : notices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                                        등록된 공지사항이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                notices.map((notice, idx) => (
                                    <TableRow
                                        key={notice.id}
                                        className="cursor-pointer hover:bg-slate-50"
                                        onClick={() => handleEdit(notice)}
                                    >
                                        <TableCell className="text-center font-medium text-slate-500">
                                            {notices.length - idx}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-normal">
                                                {categoryLabels[notice.category] || '일반'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-slate-900">{notice.title}</div>
                                            <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                                                {(notice.content || '').replace(/<[^>]*>?/gm, '')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                <Badge variant="secondary" className={targetTypeColors[notice.target_type]}>
                                                    {targetTypeLabels[notice.target_type]}
                                                </Badge>
                                                {notice.franchise_name && (
                                                    <span className="text-xs text-slate-600">
                                                        {notice.franchise_name}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {notice.author_name || '관리자'}
                                        </TableCell>
                                        <TableCell className="text-slate-500">
                                            {new Date(notice.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => handleDelete(e, notice.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
