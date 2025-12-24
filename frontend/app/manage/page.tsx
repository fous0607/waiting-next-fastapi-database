
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
        <div className="container max-w-7xl mx-auto p-4 h-screen flex flex-col pb-10"> {/* Added pb-10 for footer space */}
            <ManageHeader />
            <QuickRegister />

            <div className="mt-4 flex-1 flex flex-col min-h-0">
                <ClassTabs />
                <div className="flex-1 overflow-y-auto no-scrollbar mt-4 border rounded-md">
                    <WaitingList />
                </div>
            </div>

            <Toaster />
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
