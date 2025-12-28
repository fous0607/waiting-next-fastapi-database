import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { OwnerCharts } from '@/components/owner/OwnerCharts';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { format, subDays, subMonths, addDays, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

interface OwnerAnalyticsProps {
    stats: any;
    loading: boolean;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly';
    setPeriod: (period: 'hourly' | 'daily' | 'weekly' | 'monthly') => void;
    dateRange: DateRange | undefined;
    setDateRange: (range: DateRange | undefined) => void;
}

export function OwnerAnalytics({ stats, loading, period, setPeriod, dateRange, setDateRange }: OwnerAnalyticsProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Helper to calculate peak hours
    const getPeakTime = () => {
        if (!stats?.hourly_stats?.length) return '-';
        const sorted = [...stats.hourly_stats].sort((a: any, b: any) => b.waiting_count - a.waiting_count);
        const peak = sorted[0];
        if (peak.waiting_count === 0) return '-';
        return `${peak.hour}시`;
    };

    // Helper to calculate average waiting time
    const avgWaitTime = stats?.waiting_time_stats?.avg
        ? `${Math.round(stats.waiting_time_stats.avg)}분`
        : '-';

    // Helper to format date range display
    const getDateRangeDisplay = () => {
        if (!dateRange?.from) return "날짜 선택";
        const fromStr = format(dateRange.from, period === 'monthly' ? 'yyyy.MM' : 'yyyy.MM.dd', { locale: ko });

        // Only return single date if 'to' is missing or if it's the SAME day as 'from' (for non-monthly)
        if (!dateRange.to) {
            return fromStr;
        }

        // For monthly, always show range if 'to' is present
        // For others, only show range if they are different days
        if (period !== 'monthly' && format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
            return fromStr;
        }

        const toStr = format(dateRange.to, period === 'monthly' ? 'yyyy.MM' : 'yyyy.MM.dd', { locale: ko });
        return `${fromStr} ~ ${toStr}`;
    };

    const handlePrevDate = () => {
        if (!dateRange?.from || !dateRange?.to) return;
        if (period === 'monthly') {
            setDateRange({
                from: startOfMonth(subMonths(dateRange.from, 1)),
                to: endOfMonth(subMonths(dateRange.to, 1))
            });
        } else {
            setDateRange({
                from: subDays(dateRange.from, 7),
                to: subDays(dateRange.to, 7)
            });
        }
    };

    const handleNextDate = () => {
        if (!dateRange?.from || !dateRange?.to) return;
        if (period === 'monthly') {
            setDateRange({
                from: startOfMonth(addMonths(dateRange.from, 1)),
                to: endOfMonth(addMonths(dateRange.to, 1))
            });
        } else {
            setDateRange({
                from: addDays(dateRange.from, 7),
                to: addDays(dateRange.to, 7)
            });
        }
    };

    // Custom Month Selection UI for Monthly period
    const MonthPicker = () => {
        const currentYear = 2025; // User specifically asked to fix 2026 year bug
        const months = Array.from({ length: 12 }, (_, i) => i);

        return (
            <div className="p-3 bg-white border rounded-xl shadow-lg w-64">
                <div className="flex items-center justify-between mb-4 px-2">
                    <span className="font-bold text-slate-900">{currentYear}년</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {months.map((m) => {
                        const dStart = startOfMonth(new Date(currentYear, m, 1));
                        const dEnd = endOfMonth(new Date(currentYear, m, 1));

                        const isSelectedFrom = dateRange?.from && isSameMonth(dStart, dateRange.from);
                        const isSelectedTo = dateRange?.to && isSameMonth(dEnd, dateRange.to);
                        const isInRange = dateRange?.from && dateRange?.to && dStart >= startOfMonth(dateRange.from) && dEnd <= endOfMonth(dateRange.to);

                        return (
                            <button
                                key={m}
                                onClick={() => {
                                    if (!dateRange?.from || (dateRange.from && dateRange.to)) {
                                        // First click: Only set 'from'
                                        setDateRange({ from: dStart, to: undefined });
                                    } else {
                                        // Second click: Set 'to' (and ensure correct order)
                                        if (dStart < dateRange.from) {
                                            setDateRange({ from: dStart, to: endOfMonth(dateRange.from) });
                                        } else {
                                            setDateRange({ from: dateRange.from, to: dEnd });
                                        }
                                        setIsCalendarOpen(false); // Close ONLY on second selection
                                    }
                                }}
                                className={cn(
                                    "py-2.5 rounded-lg text-sm font-medium transition-all",
                                    (isSelectedFrom || isSelectedTo) ? "bg-rose-500 text-white" :
                                        isInRange ? "bg-rose-50 text-rose-600" :
                                            "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {m + 1}월
                            </button>
                        );
                    })}
                </div>
                {(dateRange?.from && isSameMonth(dateRange.from, dateRange.to || new Date(0))) ? (
                    <div className="mt-3 text-[10px] text-center text-slate-400">
                        종료 월을 선택하여 기간을 설정할 수 있습니다
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <div className="space-y-2.5 pb-20">
            {/* Period Selector Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mx-1">
                {(['hourly', 'daily', 'monthly'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative",
                            period === p
                                ? "bg-white text-slate-900 shadow-sm z-10"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {p === 'hourly' ? '시간대별' : p === 'daily' ? '일자별' : '월별'}
                    </button>
                ))}
            </div>

            {/* Date Range Navigator */}
            <div className="flex items-center justify-between px-4 py-2 bg-white rounded-xl border border-slate-100 mx-1 shadow-sm">
                <button onClick={handlePrevDate} className="p-1 rounded-full hover:bg-slate-50 text-slate-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                            <CalendarIcon className="w-4 h-4 text-slate-400" />
                            {getDateRangeDisplay()}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                        {period === 'monthly' ? (
                            <MonthPicker />
                        ) : (
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={(range, selectedDay) => {
                                    // If we already have a full range, start a new selection with the clicked day
                                    if (dateRange?.from && dateRange?.to) {
                                        setDateRange({ from: selectedDay, to: undefined });
                                        return;
                                    }

                                    setDateRange(range);

                                    // Close only when a full distinct range is selected
                                    if (range?.from && range?.to &&
                                        format(range.from, 'yyyy-MM-dd') !== format(range.to, 'yyyy-MM-dd')) {
                                        setIsCalendarOpen(false);
                                    }
                                }}
                                locale={ko}
                                initialFocus
                            />
                        )}
                    </PopoverContent>
                </Popover>

                <button onClick={handleNextDate} className="p-1 rounded-full hover:bg-slate-50 text-slate-400">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Key Insights Cards */}
            <div className="grid grid-cols-2 gap-3 mx-1">
                {(period === 'daily' || period === 'monthly') ? (
                    <>
                        <Card className="border-none shadow-sm bg-orange-50/50 overflow-hidden py-0 gap-0 min-h-0">
                            <CardContent className="px-3 py-2.5 flex flex-col justify-center min-h-0">
                                <div className="flex items-center gap-2 text-orange-900/60 mb-0.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">총 출석 인원</span>
                                </div>
                                <p className="text-sm font-bold text-orange-900 truncate">
                                    {stats?.total_attendance?.toLocaleString() || 0}명
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-indigo-50/50 overflow-hidden py-0 gap-0 min-h-0">
                            <CardContent className="px-3 py-2.5 flex flex-col justify-center min-h-0">
                                <div className="flex items-center gap-2 text-indigo-900/60 mb-0.5">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">총 신규 회원</span>
                                </div>
                                <p className="text-sm font-bold text-indigo-900 truncate">
                                    {stats?.new_members?.toLocaleString() || 0}명
                                </p>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <>
                        <Card className="border-none shadow-sm bg-indigo-50/50 overflow-hidden py-0 gap-0 min-h-0">
                            <CardContent className="px-3 py-2.5 flex flex-col justify-center min-h-0">
                                <div className="flex items-center gap-2 text-indigo-900/60 mb-0.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">가장 붐비는 시간</span>
                                </div>
                                <p className="text-sm font-bold text-indigo-900 truncate">
                                    {getPeakTime()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-orange-50/50 overflow-hidden py-0 gap-0 min-h-0">
                            <CardContent className="px-3 py-2.5 flex flex-col justify-center min-h-0">
                                <div className="flex items-center gap-2 text-orange-900/60 mb-0.5">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">평균 대기 시간</span>
                                </div>
                                <p className="text-sm font-bold text-orange-900">{avgWaitTime}</p>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Main Chart */}
            <div className="mx-1">
                <OwnerCharts
                    title={
                        period === 'hourly' ? "시간대별 방문 현황" :
                            period === 'daily' ? "일자별 방문 추이" : "월별 방문 추이"
                    }
                    data={stats?.hourly_stats || []}
                    loading={loading}
                    type="bar"
                />
            </div>

            {/* Retention Analysis */}
            <div className="mx-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-500" />
                    재방문 분석
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">재방문율 (기간 내)</span>
                        <span className="font-bold text-slate-900">
                            {stats?.retention_rate !== undefined ? `${stats.retention_rate}%` : '-'}
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${stats?.retention_rate || 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        * 기간 내 방문객 중 2회 이상 방문한 고객의 비율입니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
