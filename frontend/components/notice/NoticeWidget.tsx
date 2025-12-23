import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, X, ChevronRight } from 'lucide-react';
import { noticeService, Notice } from '@/lib/services/noticeService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button'; // Assuming Button component exists

export default function NoticeWidget() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [showAllModal, setShowAllModal] = useState(false);

    useEffect(() => {
        loadNotices();
    }, []);

    const loadNotices = async () => {
        try {
            const data = await noticeService.getStoreNotices();
            setNotices(data); // Store all notices
        } catch (error) {
            console.error('Failed to load notices', error);
        }
    };

    if (notices.length === 0) return null;

    // Only show top 2 in the widget
    const displayNotices = notices.slice(0, 2);

    return (
        <>
            <Card className="mb-2 border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="py-1 px-4 bg-white flex flex-row items-center justify-between border-b border-slate-100">
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setShowAllModal(true)}
                        title="전체 공지사항 보기"
                    >
                        <Megaphone className="w-3.5 h-3.5 text-blue-500" />
                        <h3 className="text-xs font-semibold text-slate-700">공지사항</h3>
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="flex flex-col gap-0 p-0">
                        {displayNotices.map((notice) => (
                            <div
                                key={notice.id}
                                onClick={() => setSelectedNotice(notice)}
                                className="flex items-center justify-between px-3 py-1 hover:bg-slate-50 cursor-pointer transition-colors border-b last:border-0 border-slate-50 group"
                            >
                                <span className="text-[12px] font-medium text-slate-900 truncate pr-4 flex-1">
                                    {notice.title}
                                </span>
                                <span className="text-[11px] text-slate-500 whitespace-nowrap text-right min-w-fit">
                                    {new Date(notice.created_at).toLocaleDateString()} | {notice.author_name || '관리자'}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">공지</Badge>
                            <span className="text-xs text-slate-400">
                                {selectedNotice && new Date(selectedNotice.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <DialogTitle className="text-lg font-bold leading-snug">
                            {selectedNotice?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs pt-1">
                            작성자: {selectedNotice?.author_name || '관리자'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] mt-4 overflow-y-auto border rounded-md p-3 bg-slate-50">
                        {/* Render HTML content safely */}
                        <div
                            className="text-sm text-slate-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: selectedNotice?.content || '' }}
                        />
                    </div>
                    <DialogFooter className="sm:justify-end">
                        <Button variant="secondary" onClick={() => setSelectedNotice(null)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* All Notices Modal */}
            <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>전체 공지사항</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-1">
                        <div className="space-y-1">
                            {notices.map((notice) => (
                                <div
                                    key={notice.id}
                                    onClick={() => {
                                        setSelectedNotice(notice);
                                        // Optional: keep All Modal open or close it? usually nice to keep it or just open detail on top.
                                        // If we open detail, detail modal needs to be on top. Radix dialogs can stack.
                                    }}
                                    className="p-3 hover:bg-slate-50 rounded-md cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                >
                                    <div className="font-medium text-sm text-slate-900 mb-1">{notice.title}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(notice.created_at).toLocaleDateString()} | {notice.author_name || '관리자'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowAllModal(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
