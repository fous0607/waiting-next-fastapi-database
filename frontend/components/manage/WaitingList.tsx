"use client";

import {
    DndContext,
    closestCenter,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState, useEffect } from "react";
import { useWaitingStore, type WaitingItem as WaitingItemType } from "@/lib/store/useWaitingStore";
import { WaitingItem } from "./WaitingItem";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function WaitingList() {
    const { currentClassId, waitingList, fetchWaitingList, reorderWaitingList } = useWaitingStore();
    const [items, setItems] = useState<WaitingItemType[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);

    useEffect(() => {
        const list = currentClassId && waitingList[currentClassId] ? waitingList[currentClassId] : [];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(list);
    }, [currentClassId, waitingList]);

    // Sensors for Drag & Drop
    // Using PointerSensor only - it handles both mouse and touch events
    // This is more reliable across different devices
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        setActiveId(null);

        if (active.id !== over?.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over?.id);

            // 1. Optimistic Global Store Update (Prevents revert on unrelated re-renders)
            if (currentClassId) {
                reorderWaitingList(currentClassId, oldIndex, newIndex);
            }

            // 2. Local State Update (Smooth animation)
            setItems((items) => arrayMove(items, oldIndex, newIndex));

            // 3. API Call to Persist
            const draggedId = active.id;
            const targetId = over?.id;

            if (draggedId && targetId) {
                // Determine swap target based on move direction
                // If moving down, we want to place AFTER the target. Backend swap replaces target?
                // Let's rely on the simple swap/insert logic. The backend logic "inserts at target position".
                // If moving down from 0 to 2 (items: A, B, C). A on C. 
                // Old: A(0), B(1), C(2). 
                // New: B(0), C(1), A(2). 
                // Backend: dragged=A, target=C. 
                // Logic: A.order = C.order. 
                // If C is at 2, A becomes 2. Correct.

                api.put(`/board/${draggedId}/swap/${targetId}`)
                    .then(() => toast.success("순서가 변경되었습니다."))
                    .catch(() => {
                        toast.error("순서 변경 실패");
                        // Revert on failure
                        if (currentClassId) fetchWaitingList(currentClassId);
                    });
            }
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    if (!currentClassId) {
        return <div className="text-center py-10 text-muted-foreground">교시를 선택해주세요.</div>;
    }

    if (items.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">대기자가 없습니다.</div>;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 p-2 pb-20">
                    {items.map((item, index) => (
                        <div key={item.id}>
                            <WaitingItem item={item} index={index} />
                        </div>
                    ))}
                </div>
            </SortableContext>

            <DragOverlay
                dropAnimation={{
                    duration: 200,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}
            >
                {activeId ? (
                    <div className="rotate-2 scale-105 shadow-2xl">
                        <WaitingItem
                            item={items.find(item => item.id === activeId)!}
                            index={items.findIndex(item => item.id === activeId)}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
