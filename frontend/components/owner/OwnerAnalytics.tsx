import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { OwnerCharts } from '@/components/owner/OwnerCharts';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, subMonths, addDays, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

interface OwnerAnalyticsProps {
    stats: any;
    loading: boolean;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly';
    setPeriod: (period: 'hourly' | 'daily' | 'weekly' | 'monthly') => void;
    startDate: Date;
    setStartDate: (date: Date) => void;
}

export function OwnerAnalytics({ stats, loading, period, setPeriod, startDate, setStartDate }: OwnerAnalyticsProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Helper to calculate peak hours
    const getPeakTime = () => {
        if (!stats?.hourly_stats?.length) return '-';
        const sorted = [...stats.hourly_stats].sort((a: any, b: any) => b.waiting_count - a.waiting_count);
        const peak = sorted[0];
        // If the count is 0, it's not really a peak time
        if (peak.waiting_count === 0) return '-';
        return `${peak.hour}시`;
    };

    // Helper to calculate average waiting time
    const avgWaitTime = stats?.time_stats?.avg
        ? `${Math.round(stats.time_stats.avg)}분`
        : '-';

    // Helper to format date range display
    const getDateRangeDisplay = () => {
        if (period === 'hourly') {
            return format(startDate, 'yyyy.MM.dd (eee)', { locale: ko });
        }
        if (period === 'daily') {
            // "Recent Daily" usually implies a range (e.g. last 7 days). 
            // Here we assume startDate is the end of the range or start. 
            // Let's assume startDate determines the anchor.
            // For now, let's just show the anchor date or month.
            return format(startDate, 'yyyy.MM.dd', { locale: ko }) + " 기준 7일";
        }
        if (period === 'monthly') {
            return format(startDate, 'yyyy년 MM월', { locale: ko });
        }
        return format(startDate, 'yyyy.MM.dd', { locale: ko });
    };

    const handlePrevDate = () => {
        if (period === 'hourly') setStartDate(subDays(startDate, 1));
        else if (period === 'daily') setStartDate(subDays(startDate, 7));
        else if (period === 'monthly') setStartDate(subMonths(startDate, 1));
    };

    const handleNextDate = () => {
        if (period === 'hourly') setStartDate(addDays(startDate, 1));
        else if (period === 'daily') setStartDate(addDays(startDate, 7));
        else if (period === 'monthly') setStartDate(addMonths(startDate, 1));
    };

    return (
        <div className="space-y-4 pb-20">
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

            {/* Date Navigator */}
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
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                                if (date) {
                                    setStartDate(date);
                                    setIsCalendarOpen(false);
                                }
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>

                <button onClick={handleNextDate} className="p-1 rounded-full hover:bg-slate-50 text-slate-400">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Key Insights Cards */}
            <div className="grid grid-cols-2 gap-3 mx-1">
                <Card className="border-none shadow-sm bg-indigo-50/50">
                    <CardContent className="p-4 flex flex-col justify-between h-[100px]">
                        <div className="flex items-center gap-2 text-indigo-900/60">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold">가장 붐비는 시간</span>
                        </div>
                        {/* Adjusted size and handling null/empty state */}
                        <p className="text-lg font-bold text-indigo-900 truncate">
                            {getPeakTime()}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-orange-50/50">
                    <CardContent className="p-4 flex flex-col justify-between h-[100px]">
                        <div className="flex items-center gap-2 text-orange-900/60">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold">평균 대기 시간</span>
                        </div>
                        <p className="text-lg font-bold text-orange-900">{avgWaitTime}</p>
                    </CardContent>
                </Card>
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
                    type={period === 'hourly' ? 'bar' : 'line'}
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
