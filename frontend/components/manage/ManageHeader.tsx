"use client";

import { useWaitingStore } from "@/lib/store/useWaitingStore";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function ManageHeader() {
    const { storeName, businessDate, isConnected } = useWaitingStore();

    return (
        <div className="flex justify-between items-center py-4 mb-2 border-b">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span>{storeName || "매장 정보 없음"}</span>
                    </div>
                    <span>대기자 관리</span>
                    <span className="text-xs text-muted-foreground font-normal">(Next.js v1.0)</span>
                    {businessDate && (
                        <span className="text-lg font-bold bg-secondary px-4 py-1 rounded-full text-secondary-foreground">
                            {businessDate}
                        </span>
                    )}
                </h1>
                <p className="text-muted-foreground mt-1">대기자 출석, 취소, 순서 변경 관리</p>
            </div>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                    {isConnected ? '연결됨' : '연결 끊김'}
                </div>
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
