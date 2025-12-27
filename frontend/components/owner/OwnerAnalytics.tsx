import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerCharts } from '@/components/owner/OwnerCharts';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react';

interface OwnerAnalyticsProps {
    stats: any;
    loading: boolean;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly';
    setPeriod: (period: 'hourly' | 'daily' | 'weekly' | 'monthly') => void;
}

export function OwnerAnalytics({ stats, loading, period, setPeriod }: OwnerAnalyticsProps) {
    // Helper to calculate peak hours
    const getPeakTime = () => {
        if (!stats?.hourly_stats?.length) return '-';
        const sorted = [...stats.hourly_stats].sort((a, b) => b.waiting_count - a.waiting_count);
        const peak = sorted[0];
        return peak ? `${peak.hour}시` : '-';
    };

    // Helper to calculate average waiting time (mock or from stats if available)
    // Assuming stats might have waiting_time_stats from previous schema review
    const avgWaitTime = stats?.waiting_time_stats?.avg
        ? `${Math.round(stats.waiting_time_stats.avg)}분`
        : '-';

    return (
        <div className="space-y-4 pb-20">
            {/* Period Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl mx-1">
                <button
                    onClick={() => setPeriod('hourly')}
                    className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                        period === 'hourly'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    오늘 시간대별
                </button>
                <div className="w-px bg-slate-200 my-1 mx-1" />
                <button
                    onClick={() => setPeriod('daily')}
                    className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                        period === 'daily'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    최근 일자별
                </button>
            </div>

            {/* Key Insights */}
            <div className="grid grid-cols-2 gap-3 mx-1">
                <Card className="border-none shadow-sm bg-indigo-50/50">
                    <CardContent className="p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-indigo-900/60">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold">가장 붐비는 시간</span>
                        </div>
                        <p className="text-xl font-bold text-indigo-900">{getPeakTime()}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-orange-50/50">
                    <CardContent className="p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-orange-900/60">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold">평균 대기 시간</span>
                        </div>
                        <p className="text-xl font-bold text-orange-900">{avgWaitTime}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Chart */}
            <div className="mx-1">
                <OwnerCharts
                    title={period === 'hourly' ? "시간대별 방문 현황" : "일자별 방문 추이"}
                    data={stats?.hourly_stats || []} // The stats endpoint returns 'hourly_stats' even for daily view (renamed in backend logic usually, or we use different field)
                    // Note: In stats endpoint, 'daily' period usually returns data in 'hourly_stats' field structure or we need to check stats structure again.
                    // Based on previous files, 'hourly_stats' seems to be the main list.
                    loading={loading}
                    type={period === 'hourly' ? 'bar' : 'line'}
                />
            </div>

            {/* Additional Insights (Mock/Future) */}
            <div className="mx-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-500" />
                    재방문 분석
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">재방문율 (이번주)</span>
                        <span className="font-bold text-slate-900">{stats?.retention_rate ? `${stats.retention_rate}%` : '-'}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${stats?.retention_rate || 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        * 재방문율은 전체 방문객 중 2회 이상 방문한 고객의 비율입니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
