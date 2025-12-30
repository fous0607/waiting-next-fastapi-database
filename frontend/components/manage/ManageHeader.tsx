"use client";

import { useWaitingStore } from "@/lib/store/useWaitingStore";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { SSEMonitor } from "./SSEMonitor";

export function ManageHeader() {
    const { storeName, businessDate, isConnected, selectedStoreId, storeSettings } = useWaitingStore();
    const [showMonitor, setShowMonitor] = useState(false);

    // Business Hours & Break Time Calculation (Client-side)
    const now = new Date();
    const nowStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const isClosed = (storeSettings?.business_start_time && storeSettings?.business_end_time) ?
        (nowStr < storeSettings.business_start_time.substring(0, 5) || nowStr > storeSettings.business_end_time.substring(0, 5)) : false;

    const isBreak = (storeSettings?.enable_break_time && storeSettings?.break_start_time && storeSettings?.break_end_time) ?
        (nowStr >= storeSettings.break_start_time.substring(0, 5) && nowStr <= storeSettings.break_end_time.substring(0, 5)) : false;

    return (
        <div className="flex justify-between items-center py-4 mb-2 border-b">
            <SSEMonitor open={showMonitor} onOpenChange={setShowMonitor} storeId={selectedStoreId || undefined} />
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span>{storeName || "매장 정보 없음"}</span>
                        {selectedStoreId && <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">ID: {selectedStoreId}</span>}
                    </div>
                    <span>대기자 관리</span>
                    {businessDate && (
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold bg-secondary px-4 py-1 rounded-full text-secondary-foreground">
                                {businessDate}
                            </span>
                            {isBreak ? (
                                <span className="text-sm font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full border border-orange-200">휴게 시간</span>
                            ) : isClosed ? (
                                <span className="text-sm font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full border border-red-200">영업 종료</span>
                            ) : (
                                <span className="text-sm font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200">영업 중</span>
                            )}
                        </div>
                    )}
                </h1>
            </div>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                    {isConnected ? '연결됨' : '연결 끊김'}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowMonitor(true)} className="text-slate-500 hover:text-slate-900" title="연결 모니터링">
                    <Activity className="w-5 h-5" />
                </Button>
                <ModeToggle />
                <Link href="/">
                    <Button variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        메인으로
                    </Button>
                </Link>
            </div>
        </div>
    );
}
