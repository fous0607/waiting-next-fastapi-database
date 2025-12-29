import { Card } from "@/components/ui/card";

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

        const lastCalled = new Date(item.last_called_at).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - lastCalled) / (1000 * 60);

        return diffMinutes < 2; // Show "Calling" only for 2 minutes
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-red-600 animate-pulse bg-white/90 px-4 py-1 rounded-full shadow-sm border border-red-200">
                        호출중 {item.call_count > 1 && `(${item.call_count})`}
                    </span>
                </div>
            )}

            <div className="flex flex-col items-end max-w-[70%] z-10">
                <span className="font-bold truncate text-slate-800" style={{ fontSize: 'var(--board-font-size)', fontFamily: 'var(--board-font-family)' }}>{item.display_name}</span>
            </div>
        </Card>
    );
}
