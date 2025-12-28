import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import useSWR from 'swr';
import api from "@/lib/api";
import { cn } from '@/lib/utils';
import { Calendar } from "@/components/ui/calendar";

interface Member {
    id: number;
    name: string;
    phone: string;
    created_at?: string;
    visit_count?: number;
    last_visit?: string;
    days_since?: number;
}

interface MemberDetailModalProps {
    member: Member | null;
    open: boolean;
    onClose: () => void;
}

export function MemberDetailModal({ member, open, onClose }: MemberDetailModalProps) {
    const [view, setView] = useState<'info' | 'calendar'>('info');
    const [showMonthStats, setShowMonthStats] = useState(false);

    // Fetch full history
    const { data: historyData, isLoading } = useSWR(
        member && open ? `/franchise/stats/member-history/${member.id}` : null,
        async (url) => {
            const res = await api.get(url);
            return res.data;
        }
    );

    // Reset view when opening new member
    React.useEffect(() => {
        if (open) {
            setView('info');
            setShowMonthStats(false);
        }
    }, [open, member?.id]);

    if (!member) return null;

    const formatPhone = (phone: string) => {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    };

    // Calculate stats
    // Safe date parsing helper
    const safeParseDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        try {
            const parsed = parseISO(dateStr);
            if (isNaN(parsed.getTime())) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    };

    const totalVisits = historyData?.total_attended || 0;
    const currentMonthVisits = historyData?.history?.filter((h: any) => {
        const date = safeParseDate(h.business_date);
        return h.status === 'attended' && date && isSameMonth(date, new Date())
    }).length || 0;

    const displayCount = showMonthStats ? currentMonthVisits : totalVisits;

    const attendedDates = historyData?.history
        ?.filter((h: any) => h.status === 'attended')
        .map((h: any) => safeParseDate(h.business_date))
        .filter((d: Date | null): d is Date => d !== null) || [];

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[340px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                {/* Header */}
                <div className="bg-slate-900 p-6 pb-8 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                    </button>

                    <div className="relative z-10">
                        <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center mb-3 shadow-inner ring-4 ring-slate-800/50">
                            <User className="w-8 h-8 text-slate-400" />
                        </div>
                        <DialogTitle className="text-xl font-bold mb-1">{member.name}</DialogTitle>
                        <DialogDescription className="text-slate-400 font-medium tracking-wide">
                            {formatPhone(member.phone)}
                        </DialogDescription>
                    </div>
                </div>

                {/* Body */}
                <div className="bg-slate-50 relative -mt-4 rounded-t-3xl p-5 min-h-[300px] flex flex-col">

                    {view === 'calendar' ? (
                        <div className="flex-1 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-rose-500" />
                                    출석 캘린더
                                </h3>
                                <div className="text-xs font-medium px-2 py-1 bg-rose-50 text-rose-600 rounded-full">
                                    출석일 {attendedDates.length}일
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
                                <Calendar
                                    mode="default"
                                    modifiers={{ attended: attendedDates }}
                                    modifiersStyles={{
                                        attended: {
                                            backgroundColor: '#10b981', // emerald-500
                                            color: 'white',
                                            fontWeight: 'bold',
                                            borderRadius: '100%'
                                        }
                                    }}
                                    locale={ko}
                                    className="p-0 pointer-events-none" // View only
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span>출석</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {/* Stats Card */}
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowMonthStats(!showMonthStats)}
                                        className={cn(
                                            "h-7 text-xs font-bold rounded-full px-3 transition-colors",
                                            showMonthStats
                                                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        )}
                                    >
                                        {showMonthStats ? '이번달' : '전체'}
                                    </Button>
                                </div>
                                <div className="pr-16">
                                    <span className="text-xs font-bold text-slate-400 block mb-1">
                                        {showMonthStats ? '이번달 출석' : '총 출석 횟수'}
                                    </span>
                                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                                        {displayCount}
                                        <span className="text-lg font-bold text-slate-400 ml-1">회</span>
                                    </span>
                                </div>
                            </div>

                            {/* Recent History */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-bold text-slate-900">최근 방문 이력</h3>
                                    {historyData?.last_visit && safeParseDate(historyData.last_visit) && (
                                        <span className="text-[10px] text-slate-400">
                                            마지막: {format(safeParseDate(historyData.last_visit)!, 'MM.dd')}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-0 relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-slate-100" />

                                    {isLoading ? (
                                        <div className="py-8 text-center text-slate-400 text-xs">
                                            불러오는 중...
                                        </div>
                                    ) : !historyData?.history?.length ? (
                                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                                            방문 이력이 없습니다.
                                        </div>
                                    ) : (
                                        historyData.history.slice(0, 5).map((h: any, i: number) => (
                                            <div key={h.id} className="relative pl-6 py-2 group">
                                                <div className={cn(
                                                    "absolute left-0 top-3 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
                                                    h.status === 'attended' ? "bg-emerald-500" : "bg-slate-300"
                                                )} />
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center group-hover:border-slate-200 transition-colors">
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-700">
                                                            {safeParseDate(h.business_date)
                                                                ? format(safeParseDate(h.business_date)!, 'yyyy.MM.dd')
                                                                : '-'
                                                            }
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            {h.class_name}
                                                        </div>
                                                    </div>
                                                    <div className={cn(
                                                        "text-xs font-bold px-2 py-1 rounded-lg",
                                                        h.status === 'attended' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                                                    )}>
                                                        {h.status === 'attended' ? '출석' : '결석'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="bg-white p-4 pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                    {view === 'info' ? (
                        <>
                            <Button
                                variant="outline"
                                className="h-12 rounded-2xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => setView('calendar')}
                            >
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                상세
                            </Button>
                            <Button
                                className="h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800"
                                onClick={onClose}
                            >
                                닫기
                            </Button>
                        </>
                    ) : (
                        <Button
                            className="h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 col-span-2"
                            onClick={() => setView('info')}
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            목록으로 확인
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
