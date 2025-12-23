"use client";

import { Loader2 } from "lucide-react";

interface GlobalLoaderProps {
    message?: string;
}

export function GlobalLoader({ message = "로딩 중..." }: GlobalLoaderProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-medium text-slate-600 animate-pulse">{message}</p>
            </div>
        </div>
    );
}
