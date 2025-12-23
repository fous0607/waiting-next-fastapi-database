import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { WaitingItem } from './waiting-item';

interface WaitingListProps {
    items: any[];
    onDragEnd: (event: DragEndEvent) => void;
    onMoveClass: (id: number, direction: 'prev' | 'next') => void;
    onStatusChange: (id: number, status: string) => void;
    onCall: (id: number) => void;
    onInsertEmpty: (id: number) => void;
    isFirstClass?: boolean;
    isLastClass?: boolean;
}

export function WaitingList({
    items,
    onDragEnd,
    onMoveClass,
    onStatusChange,
    onCall,
    onInsertEmpty,
    isFirstClass,
    isLastClass
}: WaitingListProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevent drag on click
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2 pb-20">
                    {items.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <div className="text-4xl mb-2">📭</div>
                            <p>대기자가 없습니다</p>
                        </div>
                    ) : (
                        items.map((item) => (
                            <WaitingItem
                                key={item.id}
                                item={item}
                                onMoveClass={onMoveClass}
                                onStatusChange={onStatusChange}
                                onCall={onCall}
                                onInsertEmpty={onInsertEmpty}
                                isFirstClass={isFirstClass}
                                isLastClass={isLastClass}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </DndContext>
    );
}
