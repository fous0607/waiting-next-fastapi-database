'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts';
import DonutChart from '@/components/analytics/DonutChart';
import StoreListTable, { StoreComparisonStat } from '@/components/analytics/StoreListTable';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { startOfYesterday, format, subDays, startOfMonth, endOfMonth, subMonths, isSameDay } from 'date-fns';
import { ChevronDown } from 'lucide-react';

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
    hourly_stats: any[];
    store_stats: any[];
    store_comparison: StoreComparisonStat[];
    payment_stats?: ChartData;
    channel_stats?: ChartData;
}

export default function FranchiseStatsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewParam = searchParams.get('view');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsDashboard | null>(null);

    // UI State
    const [selectedStoreId, setSelectedStoreId] = useState<number | 'all'>('all');
    const [refetchKey, setRefetchKey] = useState(0);

    const [paramDateRange, setParamDateRange] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    const handleCustomRangeChange = (range: { start: string; end: string }) => {
        setParamDateRange(range);
    };

    // --- Fetch Data ---
    useEffect(() => {
        if (!paramDateRange.start) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await api.get('/franchise/stats/dashboard', {
                    params: {
                        start_date: paramDateRange.start,
                        end_date: paramDateRange.end,
                        period: 'daily',
                        store_id: selectedStoreId === 'all' ? undefined : selectedStoreId
                    }
                });
                setData(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [paramDateRange, selectedStoreId, refetchKey]);

    // --- Aggregations ---
    const totalAttendance = data?.total_attendance || 0;
    const totalWaiting = data?.total_waiting || 0;
    const currentWaitingTotal = data?.store_comparison.reduce((acc, s) => acc + (s.current_waiting || 0), 0) || 0;
    const currentAttendanceTotal = data?.store_comparison.reduce((acc, s) => acc + (s.today_attended || 0), 0) || 0;

    // --- Chart Data Preparation ---
    const getChartData = () => {
        return data?.hourly_stats || [];
    };

    // --- Helpers for Store Selector ---
    const availableStores = data?.store_comparison || [];

    // --- Render ---
    return (
        <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
            {/* Header Title */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">매장 관리 (통계)</h2>
            </div>

            {/* Filters Area */}
            <div className="space-y-4">
                {/* Filters Row: Presets + DatePicker + StoreSelector */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm overflow-visible">
                    <div className="flex items-center gap-4 overflow-x-auto overflow-y-visible">
                        <DateRangeSelector
                            onRangeChange={handleCustomRangeChange}
                            initialRange={undefined}
                            selectedRange={paramDateRange}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Store Selector */}
                        <div className="relative">
                            <select
                                className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                                value={selectedStoreId}
                                onChange={(e) => setSelectedStoreId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            >
                                <option value="all">전체 매장</option>
                                {availableStores.map(store => (
                                    <option key={store.store_id} value={store.store_id}>{store.store_name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        <button
                            onClick={() => {
                                setRefetchKey(prev => prev + 1);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            조회
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart Section */}
            <AnalyticsCharts
                data={getChartData()}
                periodType="daily"
            />

            {/* Detailed Table Section */}
            <div>
                <TimeStatsTable stats={data?.hourly_stats || []} loading={loading} />
            </div>

        </div>
    );
}

// New Component: TimeStatsTable
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
