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
    const [showMonthStats, setShowMonthStats] = useState(true);

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
            setShowMonthStats(true);
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
                <DialogDescription className="sr-only">
                    {member.name}님의 출석 현황 및 방문 이력입니다.
                </DialogDescription>
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
                        <a
                            href={`tel:${member.phone}`}
                            className="text-lg font-bold text-slate-200 hover:text-white transition-colors tracking-wide block mt-1"
                        >
                            {formatPhone(member.phone)}
                        </a>
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
                                    mode="single" // Using 'single' without onSelect makes it read-only but interactive
                                    selected={undefined}
                                    modifiers={{ attended: attendedDates }}
                                    modifiersStyles={{
                                        attended: {
                                            backgroundColor: '#f43f5e', // rose-500
                                            color: 'white',
                                            fontWeight: 'bold',
                                            borderRadius: '100%'
                                        }
                                    }}
                                    locale={ko}
                                    className="p-3 bg-white rounded-lg" // Ensure padding for navigation buttons
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                    <span>출석</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {/* Stats Card */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-500">
                                        {showMonthStats ? '이번달 출석' : '총 출석 횟수'}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowMonthStats(!showMonthStats)}
                                        className="h-6 text-[11px] px-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    >
                                        {showMonthStats ? '전체 보기' : '이번달 보기'}
                                    </Button>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                                        {displayCount}
                                    </span>
                                    <span className="text-lg font-bold text-slate-400">회</span>
                                </div>
                            </div>

                            {/* Recent History */}
                            <div className="space-y-3 flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-sm font-bold text-slate-900">최근 방문 이력</h3>
                                    {historyData?.last_visit && safeParseDate(historyData.last_visit) && (
                                        <span className="text-[10px] text-slate-400">
                                            마지막: {format(safeParseDate(historyData.last_visit)!, 'MM.dd')}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-0 relative pl-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                                    {/* Timeline line - Extended height to cover scrolling area visual */}
                                    <div className="absolute left-[15px] top-3 bottom-0 w-[2px] bg-slate-100" />

                                    {isLoading ? (
                                        <div className="py-8 text-center text-slate-400 text-xs">
                                            불러오는 중...
                                        </div>
                                    ) : !historyData?.history?.length ? (
                                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                                            방문 이력이 없습니다.
                                        </div>
                                    ) : (
                                        historyData.history.map((h: any, i: number) => {
                                            const date = safeParseDate(h.business_date);
                                            return (
                                                <div key={h.id} className="relative pl-8 py-2.5 group">
                                                    <div className={cn(
                                                        "absolute left-[10px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-[2px] border-white shadow-sm z-10",
                                                        "bg-slate-300"
                                                    )} />
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            {/* Date: YY.MM.DD */}
                                                            <span className="text-sm font-bold text-slate-600 min-w-[60px]">
                                                                {date ? format(date, 'yy.MM.dd') : '--.--.--'}
                                                            </span>

                                                            <div className="flex items-center gap-2">
                                                                {h.start_time && (
                                                                    <span className="text-sm font-black text-slate-900">
                                                                        {h.start_time.substring(0, 5)}
                                                                    </span>
                                                                )}
                                                                <span className="text-sm font-bold text-slate-700">
                                                                    {h.class_name || '1교시'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className={cn(
                                                            "text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm mr-3",
                                                            h.status === 'attended' ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {h.status === 'attended' ? '출석' : '결석'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                    {/* Registration Date (가입일) */}
                                    {historyData?.member?.created_at && (
                                        <div className="relative pl-8 py-3 group">
                                            <div className="absolute left-[10px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-[2px] border-emerald-500 bg-white z-10" />
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[11px] font-bold text-emerald-600 min-w-[48px]">
                                                        {format(parseISO(historyData.member.created_at), 'yy.MM.dd')}
                                                    </span>
                                                    <span className="text-sm font-black text-emerald-700">신규 가입</span>
                                                </div>
                                                <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shadow-sm">
                                                    최초등록
                                                </div>
                                            </div>
                                        </div>
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
