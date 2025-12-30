
"use client";

import { AutoResizingText } from "@/components/ui/AutoResizingText";
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
    GripVertical,
    ClipboardList,
    UserPlus
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { MemberDetailModal } from "../owner/MemberDetailModal";

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

    const { classes, fetchWaitingList, fetchClasses, revisitBadgeStyle } = useWaitingStore();
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
    const [isMemberDetailOpen, setIsMemberDetailOpen] = useState(false);
    const [newName, setNewName] = useState(item.name || "");

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
            fetchClasses(); // Update counts
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
            fetchClasses(); // Update counts
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

    // Prepare member object for modal
    const memberForModal = item.member_id ? {
        id: item.member_id,
        name: item.name || "",
        phone: item.phone,
    } : null;

    const renderPartySize = () => {
        if (!item.party_size_details) {
            return item.total_party_size ? `${item.total_party_size}명` : '';
        }

        try {
            const details = JSON.parse(item.party_size_details);
            const detailLabels: string[] = [];
            let configMap: Record<string, string> = {};
            try {
                const configs = JSON.parse(useWaitingStore.getState().storeSettings?.party_size_config || '[]');
                configs.forEach((c: any) => { configMap[c.id] = c.label; });
            } catch (e) { }

            Object.entries(details).forEach(([id, count]) => {
                const numCount = Number(count);
                if (numCount > 0) {
                    const label = configMap[id] || id;
                    detailLabels.push(`${label} ${numCount}`);
                }
            });

            if (detailLabels.length === 0) return `${item.total_party_size ?? 0}명`;
            return `${detailLabels.join(', ')} (총 ${item.total_party_size ?? 0}명)`;
        } catch (e) {
            return `${item.total_party_size ?? 0}명`;
        }
    };

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
                    "hover:shadow-md transition-all relative overflow-hidden py-1", // changed overflow-visible to hidden for cleaner borders, remove py-3
                    item.status === 'called' && "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20",
                    isDragging && "shadow-2xl border-primary border-2 bg-primary/5"
                )}>
                    {/* Revisit Badge - Top Right Absolute inside Card */}
                    {item.revisit_count != null && item.revisit_count > 0 && (
                        <div className="absolute top-1 right-1 z-20">
                            {(() => {
                                const style = revisitBadgeStyle || 'indigo_solid';
                                let badgeClass = "bg-indigo-600 text-white hover:bg-indigo-700 px-2 py-0.5 text-[10px] font-bold shadow-sm whitespace-nowrap rounded-full";

                                if (style === 'amber_outline') {
                                    badgeClass = "bg-amber-50 text-amber-600 border border-amber-400 px-2 py-0.5 text-[10px] font-bold shadow-sm whitespace-nowrap rounded-lg";
                                } else if (style === 'emerald_pill') {
                                    badgeClass = "bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-black shadow-sm whitespace-nowrap rounded-full";
                                } else if (style === 'rose_gradient') {
                                    badgeClass = "bg-gradient-to-r from-rose-400 to-pink-500 text-white px-2 py-0.5 text-[10px] font-bold shadow-md whitespace-nowrap rounded-md";
                                } else if (style === 'sky_glass') {
                                    badgeClass = "bg-sky-400/30 text-sky-800 backdrop-blur-md border border-sky-300 px-2 py-0.5 text-[10px] font-bold shadow-sm whitespace-nowrap rounded-full";
                                }

                                return (
                                    <div className={cn("inline-flex items-center justify-center transition-all", badgeClass)}>
                                        재방문 {item.revisit_count}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <CardContent className="flex flex-col p-3 gap-2">
                        {/* Top: Info Row */}
                        <div className="flex items-center justify-between gap-2 w-full">
                            <div className={cn(
                                "flex items-center gap-2 overflow-hidden flex-1 min-w-0",
                                (item.revisit_count ?? 0) > 0 && "pr-16" // Prevent overlap with badge
                            )}>
                                {/* Drag Handle & Number */}
                                <div
                                    {...listeners}
                                    className={cn(
                                        "flex items-center cursor-grab select-none rounded active:bg-slate-100 transition-colors py-1 px-1 shrink-0",
                                        isDragging ? "cursor-grabbing" : "cursor-grab"
                                    )}
                                >
                                    <GripVertical className="w-4 h-4 text-slate-300 mr-1" />
                                    <span className="text-xl font-black text-primary leading-none">#{item.waiting_number}</span>
                                </div>

                                {/* Name (Clickable for Phone Lookup) & Party Size */}
                                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 flex-wrap">
                                    <div
                                        onClick={() => setIsPhoneDialogOpen(true)}
                                        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -ml-1 transition-colors shrink-0"
                                        title="클릭하여 연락처 확인"
                                    >
                                        <h3 className="text-xl font-black truncate leading-tight text-slate-900 dark:text-slate-100 tracking-tight">
                                            {item.name || "비회원"}
                                        </h3>
                                    </div>

                                    {/* Party Size Details (Prominent - Replaces Phone) */}
                                    {(item.total_party_size ?? 0) > 0 && (
                                        <div className="flex-1 min-w-0 max-w-[60%]">
                                            <AutoResizingText className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                {renderPartySize()}
                                            </AutoResizingText>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Middle: Party Size & Status (Bundled with actions in one dense row if possible, or stacked compactly) */}
                        {/* User requested actions to move LEFT to reduce width. We'll combine status and actions. */}

                        <div className="flex items-center justify-start gap-1 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {/* Status Info */}
                            <div className="flex items-center gap-1 shrink-0">
                                {item.status === 'called' && (
                                    <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 px-1 py-0 h-5 text-[10px] whitespace-nowrap">호출중</Badge>
                                )}
                            </div>

                            {/* Actions - Compacted */}
                            <div className="flex items-center gap-1 ml-auto">
                                {/* Reverted to Side-by-Side Arrows (User Request) */}
                                <div className="flex items-center gap-0.5 mr-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 bg-white hover:bg-slate-100 text-slate-500 border-slate-200 shadow-sm"
                                        onClick={() => handleOrderChange('up')}
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 bg-white hover:bg-slate-100 text-slate-500 border-slate-200 shadow-sm"
                                        onClick={() => handleOrderChange('down')}
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </Button>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCall}
                                    className="h-8 px-2 text-xs font-bold gap-1 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors shadow-sm whitespace-nowrap"
                                >
                                    <BellRing className="w-3 h-3" />
                                    {useWaitingStore.getState().storeSettings?.detail_mode === 'pickup' ? "준비" : "호출"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStatusUpdate('attended')}
                                    className={cn(
                                        "h-8 px-2 text-xs font-bold gap-1 bg-white transition-colors shadow-sm whitespace-nowrap",
                                        useWaitingStore.getState().storeSettings?.detail_mode === 'pickup'
                                            ? "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                            : "hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                                    )}
                                >
                                    {useWaitingStore.getState().storeSettings?.detail_mode === 'pickup' ? (
                                        <>
                                            <CheckCircle className="w-3 h-3" /> 수령
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-3 h-3" /> 입장
                                        </>
                                    )}
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-5 p-0 hover:bg-slate-100">
                                            <MoreHorizontal className="w-4 h-4 text-slate-500" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setIsNameDialogOpen(true)}>이름 변경</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusUpdate('cancelled')}>취소</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setIsMoveDialogOpen(true)}>교시 이동</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setIsMemberDetailOpen(true)} disabled={!item.member_id}>회원 상세</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
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

            <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>이름 등록</DialogTitle>
                        <DialogDescription>
                            본인 확인을 위해 성함을 입력해 주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <Input
                            placeholder="성함 입력"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    try {
                                        await api.put(`/board/${item.id}/name`, { name: newName });
                                        toast.success("이름이 등록되었습니다.");
                                        setIsNameDialogOpen(false);
                                        if (item.class_id) fetchWaitingList(item.class_id);
                                    } catch (err) {
                                        toast.error("이름 등록 실패");
                                    }
                                }
                            }}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsNameDialogOpen(false)}>취소</Button>
                            <Button onClick={async () => {
                                try {
                                    await api.put(`/board/${item.id}/name`, { name: newName });
                                    toast.success("이름이 등록되었습니다.");
                                    setIsNameDialogOpen(false);
                                    if (item.class_id) fetchWaitingList(item.class_id);
                                } catch (err) {
                                    toast.error("이름 등록 실패");
                                }
                            }}>저장</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
                <DialogContent className="sm:max-w-[300px]">
                    <DialogHeader>
                        <DialogTitle>연락처 정보</DialogTitle>
                        <DialogDescription>
                            고객님의 전체 연락처입니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-6 bg-slate-50 rounded-xl my-2">
                        <span className="text-3xl font-black font-mono tracking-wider text-slate-800">
                            {item.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                        </span>
                    </div>
                </DialogContent>
            </Dialog>

            {memberForModal && (
                <MemberDetailModal
                    member={memberForModal}
                    open={isMemberDetailOpen}
                    onClose={() => setIsMemberDetailOpen(false)}
                />
            )}
        </>
    );
}
