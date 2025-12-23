'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Building,
    Store,
    Users,
    UserCog,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    TrendingUp
} from 'lucide-react';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts';
import DonutChart from '@/components/analytics/DonutChart';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// --- Interfaces matching the new API response ---

interface TimeStats {
    max: number;
    min: number;
    avg: number;
}

interface HourlyStat {
    hour?: number;
    label: string;
    waiting_count: number;
    attendance_count: number;
}

interface StoreComparisonStat {
    store_id: number;
    store_name: string;
    total_sales: number;
    waiting_count: number;
    attendance_count: number;
    avg_sales_per_person: number;
    conversion_rate: number;
}

interface ChartData {
    labels: string[];
    values: number[];
    colors?: string[];
}

interface SystemStats {
    total_stores: number;
    open_stores: number;
    total_waiting: number;
    total_attendance: number;
    waiting_time_stats: TimeStats;
    attendance_time_stats: TimeStats;
    hourly_stats: HourlyStat[];
    store_comparison: StoreComparisonStat[];
    payment_stats?: ChartData;
    channel_stats?: ChartData;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [period, setPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('hourly');

    // Fetch data when filters change
    useEffect(() => {
        if (!dateRange.start || !dateRange.end) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                // Determine API endpoint
                // We use get_franchise_dashboard_stats via generic superadmin route or /stats logic.
                // Assuming we are logged in as superadmin or franchise admin.
                // Using the previously identified endpoint: /api/franchise/stats/dashboard (user's franchise) or specific one.
                // Since this is "Superadmin", we might need a system-wide one but the user context suggests franchise management screen.
                // Let's assume the user is a franchise admin for now as per previous context "Franchise Management".
                // If System Admin, the backend handles it.

                const response = await api.get('/franchise/stats/dashboard', {
                    params: {
                        start_date: dateRange.start,
                        end_date: dateRange.end,
                        period: period
                    }
                });
                setStats(response.data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [dateRange, period]);

    const handleDateRangeChange = (range: { start: string; end: string }) => {
        setDateRange(range);
    };

    if (!stats && loading) {
        return <div className="p-8 flex items-center justify-center h-screen">Loading...</div>;
    }

    // Default empty state to prevent crash
    // Default empty state to prevent crash
    const safeStats: SystemStats = stats || {
        total_stores: 0,
        open_stores: 0,
        total_waiting: 0,
        total_attendance: 0,
        waiting_time_stats: { max: 0, min: 0, avg: 0 },
        attendance_time_stats: { max: 0, min: 0, avg: 0 },
        store_comparison: [],
        hourly_stats: [],
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">종합 현황 (통계)</h1>
                <p className="text-slate-500 mt-2">매장의 대기 및 출석 현황 리포트입니다.</p>
            </div>

            {/* Controls Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                {/* Period Tabs */}
                <div className="flex space-x-6">
                    {['hourly', 'daily', 'weekly', 'monthly'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p as any)}
                            className={cn(
                                "pb-4 text-sm font-medium transition-all relative",
                                period === p
                                    ? "text-slate-900 font-bold"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {p === 'hourly' && '시간별'}
                            {p === 'daily' && '일별'}
                            {p === 'weekly' && '주별'}
                            {p === 'monthly' && '월별'}
                            {period === p && (
                                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Date Selector */}
                <div className="flex items-center">
                    <DateRangeSelector onRangeChange={handleDateRangeChange} initialRange="today" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-3xl border-slate-100 shadow-sm p-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-slate-500">총 대기 건수</span>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{safeStats.total_waiting.toLocaleString()}<span className="text-lg font-normal text-slate-500 ml-1">건</span></div>
                        <p className="text-xs text-slate-400 mt-1">선택 기간 전체</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-100 shadow-sm p-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-slate-500">총 출석 건수</span>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{safeStats.total_attendance.toLocaleString()}<span className="text-lg font-normal text-slate-500 ml-1">건</span></div>
                        <p className="text-xs text-slate-400 mt-1">선택 기간 전체</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-100 shadow-sm p-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-slate-500">평균 대기 시간</span>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{safeStats.waiting_time_stats.avg}<span className="text-lg font-normal text-slate-500 ml-1">분</span></div>
                        <p className="text-xs text-slate-400 mt-1">등록부터 출석까지</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-slate-100 shadow-sm p-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-sm font-medium text-slate-500">출석 전환율</span>
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        {/* Safe calculation */}
                        <div className="text-3xl font-bold text-slate-900">
                            {safeStats.total_waiting > 0
                                ? Math.round((safeStats.total_attendance / safeStats.total_waiting) * 100)
                                : 0
                            }%
                        </div>
                        <p className="text-xs text-slate-400 mt-1">대기 대비 출석률</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Trend Chart */}
            <div className="w-full">
                <AnalyticsCharts data={safeStats.hourly_stats} periodType={period} />
            </div>

            {/* Store List Table & Pie Charts */}
            <div className="space-y-8">

                {/* Store List Table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">매장명</th>
                                    <th className="px-6 py-4 text-right">총 매출</th>
                                    <th className="px-6 py-4 text-right">순 매출</th>
                                    <th className="px-6 py-4 text-right">대기 건수</th>
                                    <th className="px-6 py-4 text-right">출석 건수</th>
                                    <th className="px-6 py-4 text-right">객단가</th>
                                    <th className="px-6 py-4 text-right">매장 매출</th>
                                    <th className="px-6 py-4 text-right">배달 매출</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {safeStats.store_comparison.map((store) => (
                                    <tr key={store.store_id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{store.store_name}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-700">{store.total_sales.toLocaleString()}원</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{Math.round(store.total_sales * 0.9).toLocaleString()}원</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{store.waiting_count}건</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{store.attendance_count}건</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{store.avg_sales_per_person.toLocaleString()}원</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{Math.round(store.total_sales * 0.8).toLocaleString()}원</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{Math.round(store.total_sales * 0.2).toLocaleString()}원</td>
                                    </tr>
                                ))}
                                {safeStats.store_comparison.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">데이터가 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Donut Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {safeStats.channel_stats && (
                        <div className="h-[400px]">
                            <DonutChart title="채널 매출 점유율" data={safeStats.channel_stats} />
                        </div>
                    )}
                    {safeStats.payment_stats && (
                        <div className="h-[400px]">
                            <DonutChart title="결제 수단 점유율" data={safeStats.payment_stats} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
