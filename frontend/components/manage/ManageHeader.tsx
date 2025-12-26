"use client";

import { useWaitingStore } from "@/lib/store/useWaitingStore";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { SSEMonitor } from "./SSEMonitor";

export function ManageHeader() {
    const { storeName, businessDate, isConnected, selectedStoreId } = useWaitingStore();
    const [showMonitor, setShowMonitor] = useState(false);

    return (
        <div className="flex justify-between items-center py-4 mb-2 border-b">
            <SSEMonitor open={showMonitor} onOpenChange={setShowMonitor} storeId={selectedStoreId || undefined} />
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <span className="text-slate-900 tracking-tight">대기 현황 관리</span>
                    {businessDate && (
                        <span className="text-lg font-bold bg-secondary/50 text-secondary-foreground px-4 py-1 rounded-lg">
                            {businessDate}
                        </span>
                    )}
                </h1>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setShowMonitor(true)} className="text-slate-500 hover:text-slate-900" title="연결 모니터링">
                    <Activity className="w-5 h-5" />
                </Button>
                <ModeToggle />
            </div>
        </div>
    );
}
