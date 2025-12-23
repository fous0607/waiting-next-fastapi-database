import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GripVertical, ArrowLeft, ArrowRight, Bell, UserX, Check, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WaitingItemProps {
    item: any;
    onMoveClass: (id: number, direction: 'prev' | 'next') => void;
    onStatusChange: (id: number, status: string) => void;
    onCall: (id: number) => void;
    onInsertEmpty: (id: number) => void;
    isFirstClass?: boolean;
    isLastClass?: boolean;
}

export function WaitingItem({
    item,
    onMoveClass,
    onStatusChange,
    onCall,
    onInsertEmpty,
    isFirstClass,
    isLastClass
}: WaitingItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none', // Required for PointerSensor
    };

    if (item.is_empty_seat) {
        return (
            <Card ref={setNodeRef} style={style} className="mb-3 p-4 flex items-center justify-between bg-gray-50 opacity-80 border-dashed">
                <div className="flex items-center gap-4">
                    <div {...attributes} {...listeners} className="cursor-grab text-gray-400">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="text-gray-500 font-medium">빈 좌석</div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => onStatusChange(item.id, 'cancelled')}>제거</Button>
            </Card>
        )
    }

    return (
        <Card ref={setNodeRef} style={style} className="mb-3 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" className="cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
                    <GripVertical className="h-5 w-5" />
                </Button>

                <div className="flex items-center gap-4 min-w-[150px]">
                    <span className="text-2xl font-bold text-primary min-w-[40px] text-center">{item.waiting_number}</span>
                    <div>
                        <div className="font-bold text-lg">{item.display_name}</div>
                        <div className="text-sm text-gray-500">{item.phone && item.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</div>
                    </div>
                </div>

                <div className="hidden md:block">
                    <Badge variant="outline" className="text-xs">{item.class_order}번째</Badge>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    disabled={isFirstClass}
                    onClick={() => onMoveClass(item.id, 'prev')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    disabled={isLastClass}
                    onClick={() => onMoveClass(item.id, 'next')}
                >
                    <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="w-px h-8 bg-gray-200 mx-2 hidden sm:block"></div>

                <Button variant="default" size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => onCall(item.id)}>
                    <Bell className="h-4 w-4 mr-1" /> 호출
                </Button>
                <Button variant="outline" size="sm" onClick={() => onInsertEmpty(item.id)}>
                    <UserPlus className="h-4 w-4 mr-1" /> 빈좌석
                </Button>
                <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onStatusChange(item.id, 'attended')}>
                    <Check className="h-4 w-4 mr-1" /> 출석
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onStatusChange(item.id, 'cancelled')}>
                    <UserX className="h-4 w-4 mr-1" /> 취소
                </Button>
            </div>
        </Card>
    );
}
