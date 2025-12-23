
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WaitingItem as WaitingItemType, useWaitingStore } from "@/lib/store/useWaitingStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Phone,
    MoreHorizontal,
    BellRing,
    CheckCircle,
    XCircle,
    ArrowRightLeft,
    ArrowUp,
    ArrowDown,
    GripVertical
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner"; // Assuming sonner is installed as per list_dir

interface WaitingItemProps {
    item: WaitingItemType;
    index: number;
}

export function WaitingItem({ item, index }: WaitingItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const { classes, fetchWaitingList } = useWaitingStore();
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 10 : 'auto',
        position: 'relative' as const,
        scale: isDragging ? '1.05' : '1',
    };

    const handleStatusUpdate = async (status: string) => {
        try {
            await api.put(`/board/${item.id}/status`, { status });
            toast.success("상태가 변경되었습니다.");
            if (item.class_id) fetchWaitingList(item.class_id);
        } catch (e) {
            toast.error("상태 변경 실패");
        }
    };

    const handleCall = async () => {
        try {
            await api.post(`/board/${item.id}/call`);
            toast.success("호출되었습니다.");
        } catch (e) {
            toast.error("호출 실패");
        }
    };

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const handleMoveClass = async (targetClassId: number, e?: React.MouseEvent) => {
        try {
            await api.put(`/board/${item.id}/move-class`, { target_class_id: targetClassId });
            toast.success("교시 이동이 완료되었습니다.");
            setIsMoveDialogOpen(false);
            if (item.class_id) fetchWaitingList(item.class_id);
            fetchWaitingList(targetClassId);
        } catch (error) {
            const err = error as any;
            toast.error(err.response?.data?.detail || "교시 이동 실패");
        }
    };

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const handleOrderChange = async (direction: 'up' | 'down', e?: React.MouseEvent) => {
        try {
            await api.put(`/board/${item.id}/order`, { direction });
            toast.success("순서가 변경되었습니다.");
            if (item.class_id) fetchWaitingList(item.class_id);
        } catch (error) {
            const err = error as any;
            toast.error(err.response?.data?.detail || "순서 변경 실패");
        }
    };

    const availableClasses = classes.filter(c => c.id !== item.class_id);

    if (item.is_empty_seat) {
        return (
            <div ref={setNodeRef} style={style} {...attributes}>
                <Card className="bg-gray-50 dark:bg-gray-900 border-dashed opacity-80">
                    <CardContent className="flex items-center justify-between p-3 h-14">
                        <div
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing flex items-center p-3 -ml-3 rounded-lg transition-all active:scale-110 active:bg-gray-200 dark:active:bg-gray-700"
                        >
                            <GripVertical className="w-8 h-8 text-gray-400 mr-2 transition-transform" />
                            <span className="text-gray-400 font-bold text-sm">빈 좌석</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate('cancelled')} className="h-6 text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> 제거
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <div ref={setNodeRef} style={style} {...attributes}>
                <Card className={cn(
                    "hover:shadow-md transition-all",
                    item.status === 'called' && "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20",
                    isDragging && "shadow-2xl border-primary border-2 bg-primary/5"
                )}>
                    <CardContent className="flex items-center p-3">
                        {/* Drag Handle - Draggable area with grip icon */}
                        <div
                            {...listeners}
                            className={cn(
                                "flex flex-col items-center justify-center mr-3 min-w-[3.5rem] cursor-grab select-none p-2 -ml-2 rounded-lg transition-all",
                                isDragging ? "scale-110 bg-primary/20 cursor-grabbing" : "active:scale-110 active:bg-primary/10 active:cursor-grabbing"
                            )}
                        >
                            <GripVertical className={cn(
                                "w-6 h-6 mb-0.5 transition-all",
                                isDragging ? "text-primary scale-110" : "text-muted-foreground/50 active:scale-110"
                            )} />
                            <span className="text-xl font-black text-primary">{item.waiting_number}</span>
                            <span className="text-[10px] text-muted-foreground">{index + 1}번째</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                                <h3 className="text-base font-bold truncate">{item.name || item.phone.slice(-4)}</h3>
                                {item.status === 'called' && <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 px-1.5 py-0 text-[10px]">호출됨</Badge>}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                                <Phone className="w-3 h-3 mr-1" />
                                {item.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                            {/* Arrow buttons - Always visible and larger for touch */}
                            <div className="flex flex-col gap-1 mr-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 touch-manipulation"
                                    onClick={() => handleOrderChange('up')}
                                    title="순서 올리기"
                                >
                                    <ArrowUp className="w-5 h-5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 touch-manipulation"
                                    onClick={() => handleOrderChange('down')}
                                    title="순서 내리기"
                                >
                                    <ArrowDown className="w-5 h-5" />
                                </Button>
                            </div>

                            <Button variant="outline" size="icon" onClick={handleCall} className="hidden sm:flex" title="호출">
                                <BellRing className="w-4 h-4 text-orange-500" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleStatusUpdate('attended')} className="hidden sm:flex" title="출석">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleCall}>
                                        <BellRing className="w-4 h-4 mr-2" /> 호출
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusUpdate('attended')}>
                                        <CheckCircle className="w-4 h-4 mr-2" /> 출석 처리
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusUpdate('cancelled')}>
                                        <XCircle className="w-4 h-4 mr-2" /> 취소 처리
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsMoveDialogOpen(true)}>
                                        <ArrowRightLeft className="w-4 h-4 mr-2" /> 교시 이동
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>교시 이동</DialogTitle>
                        <DialogDescription>
                            이동할 교시를 선택해주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 mt-4">
                        {availableClasses.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">이동 가능한 교시가 없습니다.</div>
                        ) : (
                            availableClasses.map((cls) => (
                                <Button
                                    key={cls.id}
                                    variant="outline"
                                    className="justify-between h-auto py-3"
                                    onClick={() => handleMoveClass(cls.id)}
                                >
                                    <span>{cls.class_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {cls.current_count}/{cls.max_capacity}명
                                    </span>
                                </Button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
