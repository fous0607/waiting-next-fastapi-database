import { Card } from "@/components/ui/card";
import { useWaitingStore } from "@/lib/store/useWaitingStore";

interface BoardCardProps {
    item: any;
}

export function BoardCard({ item }: BoardCardProps) {
    if (item.is_empty_seat) {
        return (
            <div className="mb-2 p-3 bg-slate-50 border border-dashed rounded-lg flex items-center justify-center opacity-50 h-14">
                <span className="text-sm text-slate-400 font-medium">빈 좌석</span>
            </div>
        )
    }

    const isCalled = (() => {
        if (item.call_count <= 0 || !item.last_called_at) return false;

        const now = new Date().getTime();
        const dateStr = item.last_called_at;

        // 1. Try parsing as is (Local/Browser default)
        let lastCalled = new Date(dateStr).getTime();
        let diffSeconds = (now - lastCalled) / 1000;

        // 2. Fix for Vercel/UTC mismatch
        // If the server sends UTC (e.g., 09:00) but browser treats as Local (09:00 KST),
        // the diff will be ~9 hours (32400s).
        // If so, try interpreting as UTC by valid ISO string or appending 'Z'.
        if (diffSeconds > 30000) { // If older than ~8.3 hours
            const lastCalledUTC = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime();
            const diffUTC = (now - lastCalledUTC) / 1000;
            // If UTC interpretation makes it "recent" (e.g. 0-60s), use it.
            // Allow slightly negative for clock skew (-5s).
            if (diffUTC > -10 && diffUTC < 30000) {
                diffSeconds = diffUTC;
            }
        }

        // Use custom duration from store state (default 60s)
        const displayDuration = useWaitingStore.getState().storeSettings?.calling_status_display_second || 60;

        return diffSeconds > -10 && diffSeconds < displayDuration;
    })();

    return (
        <Card className={`relative h-full p-3 flex flex-row items-center justify-between shadow-sm border-l-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isCalled
            ? "border-l-red-500 bg-red-50 border-red-200"
            : "border-l-primary"
            }`}>
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center min-w-[50px]">
                    <span className="font-black text-slate-700 leading-none" style={{ fontSize: 'var(--board-font-size)', fontFamily: 'var(--board-font-family)' }}>{item.class_order}</span>
                </div>
            </div>

            {isCalled && (
                <div className="absolute inset-x-0 -top-3 flex items-center justify-center pointer-events-none z-20">
                    <span className="text-sm font-black text-red-600 animate-pulse bg-white px-2 py-0.5 rounded-full shadow-md border border-red-200 flex items-center gap-1">
                        호출중
                        {item.call_count > 1 && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0 rounded-full border border-red-200 min-w-[1rem] text-center">
                                {item.call_count}
                            </span>
                        )}
                    </span>
                </div>
            )}

            <div className="flex flex-col items-end max-w-[70%] z-10">
                <span className="font-bold truncate text-slate-800" style={{ fontSize: 'var(--board-font-size)', fontFamily: 'var(--board-font-family)' }}>{item.display_name}</span>
            </div>
        </Card>
    );
}
