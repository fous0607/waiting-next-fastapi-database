'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWaitingStore, WaitingItem } from '@/lib/store/useWaitingStore';
import { usePolling } from '@/hooks/usePolling';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Phone, User as UserIcon, Users, CheckCircle, XCircle, Bell, ArrowLeft, DoorClosed } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useOperationLabels } from '@/hooks/useOperationLabels';
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
        closedClasses,
        setStoreId,
        selectClass,
        closeClass,
        storeSettings
    } = useWaitingStore();

    const labels = useOperationLabels(storeSettings?.operation_type || 'general');

    const [processingId, setProcessingId] = useState<number | null>(null);
    const [cancelTarget, setCancelTarget] = useState<WaitingItem | null>(null);
    const [closeTargetId, setCloseTargetId] = useState<number | null>(null);

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

    const totalWaiting = classes.reduce((sum, cls) => sum + (cls.current_count || 0), 0);
    const totalAttended = classes.reduce((sum, cls) => sum + ((cls.total_count || 0) - (cls.current_count || 0)), 0);

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

    const handleCloseClass = async () => {
        if (!closeTargetId) return;
        try {
            await closeClass(closeTargetId);
            toast.success(`${labels.classLabel}가 마감되었습니다.`);
            setCloseTargetId(null);
            fetchClasses();
        } catch (error) {
            toast.error(`${labels.classLabel} 마감 실패`);
        }
    };

    // Business Hours & Break Time Calculation (Client-side)
    const [statusInfo, setStatusInfo] = useState<{ isBreak: boolean, isClosed: boolean }>({ isBreak: false, isClosed: false });

    useEffect(() => {
        const updateStatus = () => {
            if (!storeSettings) return;
            const now = new Date();
            const nowStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            const isClosed = (storeSettings.business_start_time && storeSettings.business_end_time) ?
                (nowStr < storeSettings.business_start_time.substring(0, 5) || nowStr > storeSettings.business_end_time.substring(0, 5)) : false;

            const isBreak = (storeSettings.enable_break_time && storeSettings.break_start_time && storeSettings.break_end_time) ?
                (nowStr >= storeSettings.break_start_time.substring(0, 5) && nowStr <= storeSettings.break_end_time.substring(0, 5)) : false;

            setStatusInfo({ isBreak, isClosed });
        };

        updateStatus();
        const interval = setInterval(updateStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [storeSettings]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    const renderPartySize = (item: any) => {
        if (!item.party_size_details) {
            return item.total_party_size ? `${item.total_party_size}명` : '';
        }

        try {
            const details = JSON.parse(item.party_size_details);
            const detailLabels: string[] = [];
            let configMap: Record<string, string> = {};
            try {
                const configs = JSON.parse(storeSettings?.party_size_config || '[]');
                configs.forEach((c: any) => { configMap[c.id] = c.label; });
            } catch (e) { }

            Object.entries(details).forEach(([id, count]) => {
                const numCount = Number(count);
                if (numCount > 0) {
                    const label = configMap[id] || id;
                    detailLabels.push(`${label} ${numCount}`);
                }
            });

            if (detailLabels.length === 0) return `${item.total_party_size}명`;
            return `${detailLabels.join(', ')} (총 ${item.total_party_size}명)`;
        } catch (e) {
            return `${item.total_party_size}명`;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20"> {/* pb-20 for safe bottom area */}
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="-ml-2" onClick={() => router.push('/manage')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold truncate max-w-[150px] leading-tight">{storeName}</h1>
                        {statusInfo.isBreak ? (
                            <span className="text-[10px] font-bold text-orange-500 leading-tight">브레이크 타임</span>
                        ) : statusInfo.isClosed ? (
                            <span className="text-[10px] font-bold text-red-500 leading-tight">영업 종료</span>
                        ) : (
                            <span className="text-[10px] font-bold text-green-500 leading-tight">영업 중</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-1">
                    {currentClassId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCloseTargetId(currentClassId)}
                            title={`${labels.classLabel} 마감`}
                        >
                            <DoorClosed className="h-5 w-5 text-slate-600" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            fetchClasses();
                            if (currentClassId) fetchWaitingList(currentClassId);
                        }}
                    >
                        <RefreshCw className="h-5 w-5 text-slate-600" />
                    </Button>
                </div>
            </div>

            {/* Class Selector */}
            <div className="px-4 py-3 overflow-x-auto whitespace-nowrap bg-white border-b no-scrollbar">
                <div className="flex gap-2">
                    {classes.filter(cls => !closedClasses.has(cls.id)).map((cls) => (
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
            <div className="p-1 space-y-1">
                {currentClassId ? (
                    sortedList.length > 0 ? (
                        sortedList.map((item) => (
                            <Card key={item.id} className={`relative overflow-hidden transition-all shadow-sm ${item.status === 'called' ? 'border-orange-400 bg-orange-50' : 'border-slate-200'}`}>
                                <CardContent className="flex flex-col px-2 py-1 gap-1">
                                    {/* Info Row: Type & Compact */}
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {/* Number */}
                                            <div className={`flex items-center justify-center rounded-md px-1.5 py-0.5 min-w-[2.2rem] ${item.status === 'called' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                                                <span className={`text-xl font-black leading-none ${item.status === 'called' ? 'text-orange-600' : 'text-slate-800'}`}>
                                                    #{item.waiting_number}
                                                </span>
                                            </div>

                                            {/* Name & People Count */}
                                            <div className="flex flex-col leading-tight min-w-0">
                                                <div className="flex items-baseline gap-1.5">
                                                    <h3 className="text-lg font-bold truncate text-slate-900">
                                                        {item.name || item.phone.slice(-4)}
                                                    </h3>

                                                    {/* Revisit Badge (Inline) */}
                                                    {item.revisit_count && item.revisit_count > 0 && (
                                                        <span className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                                            재방문 {item.revisit_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                                    <span>{new Date(item.registered_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 접수</span>
                                                    {(item.total_party_size ?? 0) > 0 && (
                                                        <>
                                                            <span className="text-slate-200">|</span>
                                                            <span className="text-blue-600 font-bold">{renderPartySize(item)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        {item.status === 'called' && (
                                            <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap ml-2">
                                                호출중
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons: Full Width Row */}
                                    <div className="grid grid-cols-10 gap-1 w-full">
                                        <Button
                                            onClick={() => handleAction(item, 'call')}
                                            variant={item.status === 'called' ? "outline" : "default"}
                                            size="sm"
                                            className={`col-span-3 h-9 text-xs font-bold shadow-sm ${item.status === 'called' ? "border-orange-200 text-orange-700 hover:bg-orange-50" : "bg-green-600 hover:bg-green-700 text-white"}`}
                                            disabled={!!processingId}
                                        >
                                            <Bell className="w-3.5 h-3.5 mr-1" />
                                            {item.status === 'called' ? '재호출' : '호출'}
                                        </Button>
                                        <Button
                                            onClick={() => handleAction(item, 'attend')}
                                            variant="secondary"
                                            size="sm"
                                            className="col-span-5 h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                            disabled={!!processingId}
                                        >
                                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                            입장
                                        </Button>
                                        <Button
                                            onClick={() => setCancelTarget(item)}
                                            variant="outline"
                                            size="sm"
                                            className="col-span-2 h-9 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                            disabled={!!processingId}
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
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

            {/* Class Close Confirmation Dialog */}
            <Dialog open={!!closeTargetId} onOpenChange={(open) => !open && setCloseTargetId(null)}>
                <DialogContent className="w-[90%] rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">교시 마감</DialogTitle>
                        <DialogDescription className="text-base text-slate-600">
                            현재 교시의 접수를 마감하시겠습니까?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 mt-4">
                        <Button variant="outline" onClick={() => setCloseTargetId(null)} className="flex-1 h-12 text-lg rounded-xl">
                            취소
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleCloseClass}
                            className="flex-1 h-12 text-lg rounded-xl"
                        >
                            확인
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Stats Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t py-2 flex justify-around text-center text-xs shadow-md">
                <div className="flex-1 border-r flex flex-col items-center justify-center">
                    <div className="font-bold text-slate-800 text-lg">{totalWaiting}</div>
                    <div className="text-muted-foreground">총 대기</div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="font-bold text-slate-800 text-lg">{totalAttended}</div>
                    <div className="text-muted-foreground">출석</div>
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
