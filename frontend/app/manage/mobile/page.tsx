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

    const handleAction = async (item: WaitingItem, action: 'call' | 'attend' | 'cancel') => {
        if (processingId) return;
        setProcessingId(item.id);

        try {
            if (action === 'call') {
                await api.post(`/waiting/${item.id}/call`);
                toast.success(`${item.waiting_number}번 호출됨`);
            } else if (action === 'attend') {
                await api.patch('/waiting/status', {
                    status: 'attended',
                    waiting_ids: [item.id]
                });
                toast.success(`${item.waiting_number}번 입장 완료`);
            } else if (action === 'cancel') {
                if (!confirm('정말 취소하시겠습니까?')) return;
                await api.patch('/waiting/status', {
                    status: 'cancelled',
                    waiting_ids: [item.id]
                });
                toast.success(`${item.waiting_number}번 취소됨`);
            }
            if (currentClassId) fetchWaitingList(currentClassId);
            fetchStoreStatus(); // Update counts
        } catch (error) {
            toast.error('요청 처리 실패');
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
            <div className="p-4 space-y-4">
                {currentClassId ? (
                    sortedList.length > 0 ? (
                        sortedList.map((item) => (
                            <Card key={item.id} className={`overflow-hidden transition-all ${item.status === 'called' ? 'border-orange-200 bg-orange-50 shadow-md ring-1 ring-orange-200' : ''}`}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold text-slate-900">#{item.waiting_number}</span>
                                                {item.revisit_count && item.revisit_count > 0 ? (
                                                    <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                        재방문 {item.revisit_count}
                                                    </span>
                                                ) : null}
                                                {item.status === 'called' && (
                                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                                                        호출중
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-medium text-lg mt-0.5">{item.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1 text-slate-600">
                                                <Users className="w-4 h-4" />
                                                <span className="font-bold">{classes.find(c => c.id === item.class_id)?.max_capacity}명</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {new Date(item.registered_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 접수
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-4">
                                        <Button
                                            onClick={() => handleAction(item, 'call')}
                                            variant={item.status === 'called' ? "outline" : "default"}
                                            className={item.status === 'called' ? "border-orange-200 text-orange-700 hover:bg-orange-100" : "bg-green-600 hover:bg-green-700 text-white"}
                                            disabled={!!processingId}
                                        >
                                            <Bell className="w-4 h-4 mr-1.5" />
                                            {item.status === 'called' ? '재호출' : '호출'}
                                        </Button>
                                        <Button
                                            onClick={() => handleAction(item, 'attend')}
                                            variant="secondary"
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                            disabled={!!processingId}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1.5" />
                                            입장
                                        </Button>
                                        <Button
                                            onClick={() => handleAction(item, 'cancel')}
                                            variant="outline"
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                            disabled={!!processingId}
                                        >
                                            <XCircle className="w-4 h-4 mr-1.5" />
                                            취소
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-12 text-muted-foreground bg-white rounded-lg border border-dashed">
                            대기자가 없습니다.
                        </div>
                    )
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        클래스를 선택해주세요.
                    </div>
                )}
            </div>

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
