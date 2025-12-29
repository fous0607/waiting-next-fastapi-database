'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWaitingStore, WaitingItem } from '@/lib/store/useWaitingStore';
import { usePolling } from '@/hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Phone, User as UserIcon, Users, CheckCircle, XCircle, Bell, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

function MobileManagerContent() {
    usePolling(5000);
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        waitingList,
        currentClassId,
        fetchStoreStatus,
        fetchClasses,
        fetchWaitingList,
        storeName,
        isLoading,
        classes,
        setStoreId,
        selectClass
    } = useWaitingStore();

    const [processingId, setProcessingId] = useState<number | null>(null);
    const [cancelTarget, setCancelTarget] = useState<WaitingItem | null>(null);

    useEffect(() => {
        const storeId = searchParams.get('store') || localStorage.getItem('selected_store_id');
        if (storeId) {
            setStoreId(storeId);
        }
        fetchStoreStatus();
        fetchClasses();
    }, [searchParams, setStoreId, fetchStoreStatus, fetchClasses]);

    // Derived state for the current waiting list
    const currentList = currentClassId ? (waitingList[currentClassId] || []) : [];

    // Sort by status (waiting first, then called)
    const sortedList = [...currentList].sort((a, b) => {
        // Pinned (called) items first
        if (a.status === 'called' && b.status !== 'called') return -1;
        if (a.status !== 'called' && b.status === 'called') return 1;
        return a.waiting_number - b.waiting_number;
    });

    const handleAction = async (item: WaitingItem, action: 'call' | 'attend') => {
        if (processingId) return;
        setProcessingId(item.id);

        try {
            if (action === 'call') {
                await api.post(`/board/${item.id}/call`);
                toast.success(`${item.waiting_number}번 호출됨`);
            } else if (action === 'attend') {
                await api.put(`/board/${item.id}/status`, { status: 'attended' });
                toast.success(`${item.waiting_number}번 입장 완료`);
            }
            if (currentClassId) fetchWaitingList(currentClassId);
            fetchStoreStatus(); // Update counts
        } catch (error) {
            toast.error('요청 처리 실패');
        } finally {
            setProcessingId(null);
        }
    };

    const confirmCancel = async () => {
        if (!cancelTarget) return;
        setProcessingId(cancelTarget.id);
        try {
            await api.put(`/board/${cancelTarget.id}/status`, { status: 'cancelled' });
            toast.success(`${cancelTarget.waiting_number}번 취소됨`);
            if (currentClassId) fetchWaitingList(currentClassId);
            fetchStoreStatus();
            setCancelTarget(null);
        } catch (error) {
            toast.error('취소 실패');
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20"> {/* pb-20 for safe bottom area */}
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="-ml-2" onClick={() => router.push('/manage')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold truncate max-w-[200px]">{storeName}</h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        fetchClasses();
                        if (currentClassId) fetchWaitingList(currentClassId);
                    }}
                >
                    <RefreshCw className="h-5 w-5" />
                </Button>
            </div>

            {/* Class Selector */}
            <div className="px-4 py-3 overflow-x-auto whitespace-nowrap bg-white border-b no-scrollbar">
                <div className="flex gap-2">
                    {classes.map((cls) => (
                        <Button
                            key={cls.id}
                            variant={currentClassId === cls.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => selectClass(cls.id)}
                            className="rounded-full"
                        >
                            {cls.class_name} ({cls.current_count}팀)
                        </Button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-2 space-y-2">
                {currentClassId ? (
                    sortedList.length > 0 ? (
                        sortedList.map((item) => (
                            <Card key={item.id} className={`relative overflow-hidden transition-all shadow-sm ${item.status === 'called' ? 'border-orange-400 bg-orange-50' : 'border-slate-200'}`}>
                                <CardContent className="flex flex-col p-2.5 gap-2">
                                    {/* Info Row: Simple & Compact */}
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {/* Number */}
                                            <div className={`flex items-center justify-center rounded-md px-2 py-1 min-w-[2.5rem] ${item.status === 'called' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                                                <span className={`text-2xl font-black leading-none ${item.status === 'called' ? 'text-orange-600' : 'text-slate-800'}`}>
                                                    #{item.waiting_number}
                                                </span>
                                            </div>

                                            {/* Name & People Count */}
                                            <div className="flex flex-col leading-tight min-w-0">
                                                <div className="flex items-baseline gap-1.5">
                                                    <h3 className="text-xl font-bold truncate text-slate-900">
                                                        {item.name || item.phone.slice(-4)}
                                                    </h3>
                                                    <span className="text-sm font-medium text-slate-500 shrink-0">
                                                        {item.people_count}명
                                                    </span>
                                                    {/* Revisit Badge (Inline) */}
                                                    {item.revisit_count && item.revisit_count > 0 && (
                                                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                                            재방문 {item.revisit_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 font-medium">
                                                    {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 접수
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        {item.status === 'called' && (
                                            <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse whitespace-nowrap ml-2">
                                                호출중
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons: Full Width Row */}
                                    <div className="grid grid-cols-10 gap-1.5 w-full">
                                        <Button
                                            onClick={() => handleAction(item, 'call')}
                                            variant={item.status === 'called' ? "outline" : "default"}
                                            size="sm"
                                            className={`col-span-3 h-10 text-sm font-bold shadow-sm ${item.status === 'called' ? "border-orange-200 text-orange-700 hover:bg-orange-50" : "bg-green-600 hover:bg-green-700 text-white"}`}
                                            disabled={!!processingId}
                                        >
                                            <Bell className="w-4 h-4 mr-1" />
                                            {item.status === 'called' ? '재호출' : '호출'}
                                        </Button>
                                        <Button
                                            onClick={() => handleAction(item, 'attend')}
                                            variant="secondary"
                                            size="sm"
                                            className="col-span-5 h-10 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                            disabled={!!processingId}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            입장
                                        </Button>
                                        <Button
                                            onClick={() => setCancelTarget(item)}
                                            variant="outline"
                                            size="sm"
                                            className="col-span-2 h-10 text-sm font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                            disabled={!!processingId}
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-20 text-muted-foreground bg-white rounded-xl border border-dashed flex flex-col items-center gap-2">
                            <Users className="w-8 h-8 opacity-20" />
                            <span>대기자가 없습니다</span>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 text-muted-foreground">
                        클래스를 선택해주세요
                    </div>
                )}
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
                <DialogContent className="w-[90%] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">대기 취소</DialogTitle>
                        <DialogDescription className="text-base text-slate-600">
                            #{cancelTarget?.waiting_number} {cancelTarget?.name || '고객'}님의 대기를<br />취소하시겠습니까?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 mt-4">
                        <Button variant="outline" onClick={() => setCancelTarget(null)} className="flex-1 h-12 text-lg rounded-xl">
                            아니오
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmCancel}
                            className="flex-1 h-12 text-lg rounded-xl bg-red-600 hover:bg-red-700"
                        >
                            네, 취소합니다
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Stats Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around text-center text-xs shadow-md">
                <div className="flex-1 border-r">
                    <div className="font-bold text-slate-800 text-lg">{classes.reduce((acc, c) => acc + c.current_count, 0)}</div>
                    <div className="text-muted-foreground">총 대기</div>
                </div>
                <div className="flex-1">
                    {/* Placeholder for future features */}
                    <div className="font-bold text-slate-800 text-lg">-</div>
                    <div className="text-muted-foreground">완료</div>
                </div>
            </div>
        </div>
    );
}

export default function MobileWaitManager() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>}>
            <MobileManagerContent />
        </Suspense>
    );
}
