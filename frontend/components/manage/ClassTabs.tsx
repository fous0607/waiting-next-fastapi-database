
"use client";

import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export function ClassTabs() {
    const { classes, currentClassId, selectClass, closedClasses, fetchClasses, hideClosedClasses, toggleHideClosedClasses } = useWaitingStore();

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    if (classes.length === 0) {
        return <div className="p-4 text-center text-gray-500">운영 중인 교시가 없습니다.</div>;
    }

    // Filter classes: Show if (NOT hidden) OR (NOT closed) OR (IS Currently Selected even if closed)
    const visibleClasses = classes.filter(cls =>
        !hideClosedClasses || !closedClasses.has(cls.id) || cls.id === currentClassId
    );

    return (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            <Button
                variant="outline"
                size="icon"
                onClick={toggleHideClosedClasses}
                className={cn(
                    "flex-shrink-0 h-[4.5rem] w-12 rounded-lg border-dashed mr-2",
                    !hideClosedClasses ? "text-primary border-primary bg-primary/5" : "text-muted-foreground"
                )}
                title={hideClosedClasses ? "마감된 교시 보이기" : "마감된 교시 숨기기"}
            >
                {hideClosedClasses ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>

            {visibleClasses.map((cls) => {
                const isActive = currentClassId === cls.id;
                const isClosed = closedClasses.has(cls.id);

                return (
                    <button
                        key={cls.id}
                        onClick={() => selectClass(cls.id)}
                        className={cn(
                            "flex flex-col items-center justify-center min-w-[100px] px-4 py-3 rounded-lg border transition-all duration-200",
                            isActive
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : "bg-card text-card-foreground border-border hover:bg-accent",
                            isClosed && !isActive && "opacity-50 grayscale bg-gray-100 dark:bg-gray-800"
                        )}
                    >
                        <span className="text-lg font-bold whitespace-nowrap">
                            {cls.class_name}
                            {isClosed && <span className="text-xs ml-1">(마감)</span>}
                        </span>
                        <span className={cn(
                            "text-sm font-medium mt-1 px-2 py-0.5 rounded-full",
                            isActive ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground"
                        )}>
                            {cls.current_count}명
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
