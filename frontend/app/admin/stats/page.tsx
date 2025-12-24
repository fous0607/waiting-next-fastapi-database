'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts';
import DonutChart from '@/components/analytics/DonutChart';
import StoreListTable, { StoreComparisonStat } from '@/components/analytics/StoreListTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { startOfYesterday, format, subDays, startOfMonth, endOfMonth, subMonths, isSameDay } from 'date-fns';
import { ChevronDown, BarChart3, TrendingUp, DollarSign, Users, UserPlus, Search } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { GlobalLoader } from '@/components/ui/GlobalLoader';

// --- Types ---
interface ChartData {
    labels: string[];
    values: number[];
    colors?: string[];
}

interface AnalyticsDashboard {
    total_stores: number;
    open_stores: number;
    total_waiting: number;
    total_attendance: number;
    waiting_time_stats: { max: number; min: number; avg: number };
    attendance_time_stats: { max: number; min: number; avg: number };
    total_revenue: number;
    total_visitors: number;
    new_members: number;
    retention_rate: number;
    hourly_stats: any[];
    store_stats: any[];
    store_comparison: StoreComparisonStat[];
    chart_data: any[];
    payment_stats?: ChartData;
    channel_stats?: ChartData;
}

type Period = 'daily' | 'weekly' | 'monthly';

function StatCard({ title, value, unit, trend, icon: Icon, color }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend !== undefined && (
                    <div className={cn(
                        "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                        trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                        {trend > 0 ? "+" : ""}{trend}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
                    <span className="text-sm font-bold text-slate-400">{unit}</span>
                </div>
            </div>
        </div>
    );
}

function StatsContent(): React.JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [period, setPeriod] = useState<Period>('daily');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [stats, setStats] = useState<AnalyticsDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStoreId, setSelectedStoreId] = useState<number | 'all'>('all');
    const [refetchKey, setRefetchKey] = useState(0);

    // Initial date range setup
    useEffect(() => {
        const today = new Date();
        const start = format(today, 'yyyy-MM-dd');
        const end = format(today, 'yyyy-MM-dd');
        setDateRange({ start, end });
    }, []);

    const fetchStats = async () => {
        if (!dateRange.start || !dateRange.end) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange.start) params.append('start_date', dateRange.start);
            if (dateRange.end) params.append('end_date', dateRange.end);
            params.append('period', period);
            if (selectedStoreId !== 'all') params.append('store_id', selectedStoreId.toString());

            const response = await api.get(`/franchise/stats/store-dashboard?${params.toString()}`);
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            fetchStats();
        }
    }, [dateRange, period, selectedStoreId, refetchKey]);

    const handleRangeChange = (range: { start: string; end: string }) => {
        setDateRange(range);
    };

    // Helper for aggregation (if needed)
    const availableStores = stats?.store_comparison || [];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                        <DateRangeSelector onRangeChange={handleRangeChange} />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="h-96 flex items-center justify-center">
                    <GlobalLoader message="통계 데이터를 분석하고 있습니다..." />
                </div>
            ) : stats ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Key Metrics Cards */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="전체 매출"
                            value={stats.total_revenue?.toLocaleString() || '0'}
                            unit="원"
                            trend={+12.5}
                            icon={DollarSign}
                            color="blue"
                        />
                        <StatCard
                            title="총 방문자"
                            value={stats.total_visitors?.toLocaleString() || '0'}
                            unit="명"
                            trend={+8.2}
                            icon={Users}
                            color="emerald"
                        />
                        <StatCard
                            title="신규 회원"
                            value={stats.new_members?.toLocaleString() || '0'}
                            unit="명"
                            trend={-2.4}
                            icon={UserPlus}
                            color="violet"
                        />
                        <StatCard
                            title="재방문율"
                            value={stats.retention_rate?.toFixed(1) || '0'}
                            unit="%"
                            trend={+5.1}
                            icon={TrendingUp}
                            color="orange"
                        />
                    </div>

                    {/* Revenue Chart */}
                    <Card className="border-none shadow-sm lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-slate-800">매출 추이</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.chart_data && stats.chart_data.length > 0 ? (
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.chart_data}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-slate-400">
                                    <p>데이터가 없습니다.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Detailed Table Section */}
                    <div className="lg:col-span-2">
                        <TimeStatsTable stats={stats.hourly_stats || []} loading={loading} />
                    </div>
                </div>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center text-slate-400">
                    <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                    <p>데이터가 없습니다.</p>
                </div>
            )}
        </div>
    );
}

function TimeStatsTable({ stats, loading }: { stats: any[], loading: boolean }) {
    if (loading) return <div className="p-10 text-center text-slate-400">Loading...</div>;

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">시간/일자</th>
                            <th className="px-6 py-4 text-right">총 대기 건수</th>
                            <th className="px-6 py-4 text-right">총 출석 건수</th>
                            <th className="px-6 py-4 text-right">취소 건수</th>
                            <th className="px-6 py-4 text-right">출석률</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stats.map((row, idx) => {
                            const total = (row.waiting_count || 0);
                            const attended = (row.attendance_count || 0);
                            const cancelled = (row.cancelled_count || 0);
                            const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{row.label}</td>
                                    <td className="px-6 py-4 text-right font-medium text-blue-600">{total}건</td>
                                    <td className="px-6 py-4 text-right font-medium text-emerald-600">{attended}건</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-500">{cancelled}건</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700">{rate}%</td>
                                </tr>
                            );
                        })}
                        {stats.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">데이터가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function StatsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><GlobalLoader /></div>}>
            <StatsContent />
        </Suspense>
    );
}
