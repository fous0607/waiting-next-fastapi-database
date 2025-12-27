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
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);
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
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform flex-shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-0.5 truncate">{title}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{value}</h3>
                    <span className="text-[11px] font-bold text-slate-400">{unit}</span>
                </div>
            </div>
            {trend !== undefined && (
                <div className={cn(
                    "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full absolute top-3 right-3",
                    trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                    {trend > 0 ? "+" : ""}{trend}%
                </div>
            )}
        </div>
    );
}

function StatsContent(): React.JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const view = searchParams.get('view') || 'hourly';
    const [period, setPeriod] = useState<Period>('weekly');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [stats, setStats] = useState<AnalyticsDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStoreId, setSelectedStoreId] = useState<number | 'all'>('all');
    const [refetchKey, setRefetchKey] = useState(0);

    // Initial date range setup (Default to This Week)
    useEffect(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - (day === 0 ? 6 : day - 1);
        const monday = new Date(today.setDate(diff));

        const start = format(monday, 'yyyy-MM-dd');
        const end = format(new Date(), 'yyyy-MM-dd');
        setDateRange({ start, end });
    }, []);

    const fetchStats = async () => {
        if (!dateRange.start || !dateRange.end) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange.start) params.append('start_date', dateRange.start);
            if (dateRange.end) params.append('end_date', dateRange.end);

            // Force 'daily' period when in 'period' view (Date Range View)
            // Hourly view uses 'hourly'
            const effectivePeriod = view === 'hourly' ? 'hourly' : 'daily';
            params.append('period', effectivePeriod);

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
    }, [dateRange, selectedStoreId, refetchKey, view]); // Removed 'period' dependency as it's no longer used

    const handleRangeChange = (range: { start: string; end: string }) => {
        setDateRange(range);
    };

    // Helper for aggregation (if needed)
    const availableStores = stats?.store_comparison || [];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                        <DateRangeSelector onRangeChange={handleRangeChange} />
                    </div>
                </div>

                {/* Period selector removed as requested by user */}
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
                            title="총 방문자"
                            value={stats.total_waiting?.toLocaleString() || '0'}
                            unit="명"
                            trend={+12.5}
                            icon={Users}
                            color="blue"
                        />
                        <StatCard
                            title="총 출석"
                            value={stats.total_attendance?.toLocaleString() || '0'}
                            unit="명"
                            trend={+8.2}
                            icon={UserPlus}
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

                    {/* Charts based on view */}
                    {view === 'hourly' ? (
                        <>
                            {/* Hourly Stats Chart */}
                            <Card className="border-none shadow-sm lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold text-slate-800">시간대별 대기 및 출석 현황</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.hourly_stats && stats.hourly_stats.length > 0 ? (
                                        <div className="h-[300px] w-full">
                                            <Bar
                                                data={{
                                                    labels: stats.hourly_stats.map((s: any) => `${s.hour || s.label}시`),
                                                    datasets: [
                                                        {
                                                            label: '대기 접수',
                                                            data: stats.hourly_stats.map((s: any) => s.waiting_count || 0),
                                                            backgroundColor: 'rgba(59, 130, 246, 0.6)',
                                                            borderColor: 'rgb(59, 130, 246)',
                                                            borderWidth: 1,
                                                        },
                                                        {
                                                            label: '입장 완료',
                                                            data: stats.hourly_stats.map((s: any) => s.attendance_count || 0),
                                                            backgroundColor: 'rgba(34, 197, 94, 0.6)',
                                                            borderColor: 'rgb(34, 197, 94)',
                                                            borderWidth: 1,
                                                        }
                                                    ]
                                                }}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        y: {
                                                            beginAtZero: true
                                                        }
                                                    }
                                                }}
                                            />
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
                        </>
                    ) : (
                        <>
                            {/* Period-based Analytics Chart */}
                            <div className="lg:col-span-2">
                                <AnalyticsCharts
                                    data={stats.hourly_stats || []}
                                    periodType={period === 'daily' ? 'daily' : period === 'weekly' ? 'weekly' : 'monthly'}
                                />
                            </div>

                            {/* Detailed Table Section */}
                            <div className="lg:col-span-2">
                                <TimeStatsTable stats={stats.hourly_stats || []} loading={loading} />
                            </div>
                        </>
                    )}
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
