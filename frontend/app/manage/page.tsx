
"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSSE } from "@/hooks/useSSE";
import { ManageHeader } from "@/components/manage/ManageHeader";
import { QuickRegister } from "@/components/manage/QuickRegister";
import { ClassTabs } from "@/components/manage/ClassTabs";
import { WaitingList } from "@/components/manage/WaitingList";
import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { Toaster } from "@/components/ui/sonner";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { Home, Users, Settings, Activity, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

function ManageContent() {
    useSSE(); // Initialize Real-time connection
    const searchParams = useSearchParams();
    const { fetchStoreStatus, fetchClasses, setStoreId, isLoading, isConnected } = useWaitingStore();

    useEffect(() => {
        const storeId = searchParams.get('store');
        if (storeId) {
            setStoreId(storeId);
        }
        // Fetch Store Info and Classes
        fetchStoreStatus();
        fetchClasses();
    }, [searchParams, setStoreId, fetchStoreStatus, fetchClasses]);

    // Polling fallback when SSE is disconnected
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let isActive = true;

        const poll = async () => {
            if (!isActive) return;

            if (!isConnected) {
                // console.log('Polling for updates...');
                await Promise.all([
                    fetchStoreStatus(),
                    fetchClasses()
                ]);

                if (isActive) {
                    timeoutId = setTimeout(poll, 20000); // 20s interval
                }
            }
        };

        if (!isConnected) {
            poll();
        }

        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [isConnected, fetchStoreStatus, fetchClasses]);

    if (isLoading) {
        return <GlobalLoader message="데이터를 불러오는 중입니다..." />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-52 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    <Button
                        variant="ghost"
                        className="mb-8 -ml-3 text-slate-500 hover:text-slate-900 w-full justify-start"
                        onClick={() => (window.location.href = '/')}
                    >
                        <Home className="w-5 h-5 mr-2" />
                        메인으로
                    </Button>

                    <div className="flex items-center gap-3 mb-10 px-1">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 tracking-tight">대기자 관리</h1>
                            <p className="text-[11px] text-slate-500 font-medium">관리자 패널</p>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-12 px-3 rounded-xl transition-all bg-slate-900 text-white hover:bg-slate-800"
                        >
                            <Users className="w-5 h-5 mr-3 text-white" />
                            대기 현황
                        </Button>
                        <Link href="/settings">
                            <Button
                                variant="ghost"
                                className="w-full justify-start h-12 px-3 rounded-xl transition-all text-slate-600 hover:bg-slate-100"
                            >
                                <Settings className="w-5 h-5 mr-3 text-slate-400" />
                                매장 설정
                            </Button>
                        </Link>
                        <Link href="/admin/stats">
                            <Button
                                variant="ghost"
                                className="w-full justify-start h-12 px-3 rounded-xl transition-all text-slate-600 hover:bg-slate-100"
                            >
                                <BarChart3 className="w-5 h-5 mr-3 text-slate-400" />
                                데이터 분석
                            </Button>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-1">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{storeName || 'Store'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{isConnected ? '연결됨' : '연결 끊김'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 h-screen flex flex-col overflow-hidden">
                <ManageHeader />
                <QuickRegister />

                <div className="mt-4 flex-1 flex flex-col min-h-0">
                    <ClassTabs />
                    <div className="flex-1 overflow-y-auto no-scrollbar mt-1 border rounded-xl bg-white shadow-sm overflow-hidden">
                        <WaitingList />
                    </div>
                </div>

                <Toaster />
            </main>
        </div>
    );
}

export default function ManagePage() {
    return (
        <Suspense fallback={<GlobalLoader message="페이지 로딩 중..." />}>
            <ManageContent />
        </Suspense>
    );
}
