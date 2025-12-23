"use client";

import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { Wifi, WifiOff } from "lucide-react";

export function ManageFooter() {
    const { isConnected, selectedStoreId } = useWaitingStore();

    return (
        <div className="fixed bottom-0 left-0 right-0 h-8 bg-black/80 text-white flex items-center px-4 text-xs z-50">
            <div className={`flex items-center gap-2 ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>
                    {isConnected ? "실시간 서버 연결됨" : "연결 끊김 (재접속 중...)"}
                    <span className="opacity-50 ml-1">({selectedStoreId || 'N/A'})</span>
                </span>
            </div>
            <div className="ml-auto text-gray-400">
                System Ready
            </div>
        </div>
    );
}
