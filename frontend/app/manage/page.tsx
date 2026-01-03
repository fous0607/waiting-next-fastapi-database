
"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { ManageHeader } from "@/components/manage/ManageHeader";
import { QuickRegister } from "@/components/manage/QuickRegister";
import { ClassTabs } from "@/components/manage/ClassTabs";
import { WaitingList } from "@/components/manage/WaitingList";
import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { Toaster } from "@/components/ui/sonner";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { ScreenIdentitySelector, IdentityStatus } from '@/components/settings/ScreenIdentitySelector';
import { useState } from 'react';

function ManageContent() {
    usePolling(5000); // Poll every 5 seconds
    const searchParams = useSearchParams();
    const { fetchStoreStatus, fetchClasses, setStoreId, isLoading, isConnected } = useWaitingStore();
    const [hasIdentity, setHasIdentity] = useState(false);

    useEffect(() => {
        const storeId = searchParams.get('store');
        if (storeId) {
            setStoreId(storeId);
        }
        // Fetch Store Info and Classes
        fetchStoreStatus();
        fetchClasses();
    }, [searchParams, setStoreId, fetchStoreStatus, fetchClasses]);

    // Manual polling removed - replaced by usePolling (SWR)

    if (isLoading) {
        return <GlobalLoader message="데이터를 불러오는 중입니다..." />;
    }

    return (
        <div className="w-full px-4 py-4 h-screen flex flex-col pb-10"> {/* Full width layout */}
            <ScreenIdentitySelector category="management" onSelected={() => setHasIdentity(true)} />
            {hasIdentity && (
                <>
                    <IdentityStatus />
                    <ManageHeader />
                    <QuickRegister />

                    <div className="mt-4 flex-1 flex flex-col min-h-0">
                        <ClassTabs />
                        <div className="flex-1 overflow-y-auto no-scrollbar mt-1 border rounded-md">
                            <WaitingList />
                        </div>
                    </div>

                    <Toaster />
                </>
            )}
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
