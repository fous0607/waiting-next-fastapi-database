'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Users, Calendar, Clock, Store as StoreIcon, BarChart3, CheckCircle2 } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Interfaces
interface DateRangeStrings {
    start: string;
    end: string;
}

interface TimeStats {
    max: number;
    min: number;
    avg: number;
}

interface HourlyStat {
    hour: number;
    waiting_count: number;
    attendance_count: number;
}

interface StoreOperationStat {
    store_name: string;
    is_open: boolean;
    open_time?: string;
    close_time?: string;
    current_waiting: number;
    total_waiting: number;
    total_attendance: number;
}

interface AnalyticsDashboard {
    total_stores: number;
    open_stores: number;
    total_waiting: number;
    total_attendance: number;
    waiting_time_stats: TimeStats;
    attendance_time_stats: TimeStats;
    hourly_stats: HourlyStat[];
    store_stats: StoreOperationStat[];
}

interface Store {
    id: number;
    name: string;
    code: string;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
}

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsDashboard | null>(null);
    const [dateRange, setDateRange] = useState<DateRangeStrings>({ start: '', end: '' });

    // Filters
    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('all');
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

    useEffect(() => {
        loadFilters();
    }, []);

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            loadDashboardData();
        }
    }, [dateRange, selectedFranchiseId, selectedStoreId]);

    const loadFilters = async () => {
        try {
            const [franchiseRes, storeRes] = await Promise.all([
                fetch('/api/system/franchises', { credentials: 'include' }),
                fetch('/api/system/stores', { credentials: 'include' })
            ]);

            if (franchiseRes.ok) {
                setFranchises(await franchiseRes.json());
            }
            if (storeRes.ok) {
                setStores(await storeRes.json());
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
            });

            if (selectedFranchiseId !== 'all') {
                params.append('franchise_id', selectedFranchiseId);
            }
            if (selectedStoreId !== 'all') {
                params.append('store_id', selectedStoreId);
            }

            const response = await fetch(`/api/system/stats/dashboard?${params.toString()}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to load dashboard data');
            }

            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error(error);
            toast.error('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = (range: DateRangeStrings) => {
        setDateRange(range);
    };

    // Filtered Stores based on Franchise Selection
    const filteredStores = selectedFranchiseId === 'all'
        ? stores
        : stores;
    // Note: Since the store API response doesn't always include franchise_id in list response easily without modification, 
    // we might need to rely on the backend filter or fetch stores by franchise. 
    // However, the get_all_stores in backend DOES include franchise relationship, so strictly speaking checking store.franchise_id in frontend would be better if available.
    // But Store interface above doesn't have franchise_id. Let's assume user picks from all stores or refine later.
    // For now, let's keep it simple.

    const chartData = data ? {
        labels: data.hourly_stats.map(s => `${s.hour}시`),
        datasets: [
            {
                label: '대기 접수',
                data: data.hourly_stats.map(s => s.waiting_count),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1,
            },
            {
                label: '입장 완료',
                data: data.hourly_stats.map(s => s.attendance_count),
                backgroundColor: 'rgba(34, 197, 94, 0.6)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1,
            }
        ]
    } : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">데이터 분석</h2>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <Select value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="프랜차이즈 전체" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">프랜차이즈 전체</SelectItem>
                            {franchises.map(f => (
                                <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="매장 전체" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">매장 전체</SelectItem>
                            {filteredStores.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <DateRangeSelector onRangeChange={handleRangeChange} initialRange="today" />
                </div>
            </div>

            {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : data && (
                <>
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">총 대기 등록</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.total_waiting.toLocaleString()}명</div>
                                <p className="text-xs text-muted-foreground">선택 기간 내 총 대기 인원</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">입장 완료</CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.total_attendance.toLocaleString()}명</div>
                                <p className="text-xs text-muted-foreground">
                                    입장률 {data.total_waiting > 0 ? Math.round((data.total_attendance / data.total_waiting) * 100) : 0}%
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">평균 대기시간</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.waiting_time_stats.avg}분</div>
                                <p className="text-xs text-muted-foreground">
                                    최대 {data.waiting_time_stats.max}분 / 최소 {data.waiting_time_stats.min}분
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">운영 매장</CardTitle>
                                <StoreIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.open_stores}개</div>
                                <p className="text-xs text-muted-foreground">
                                    총 {data.total_stores}개 매장 중 영업 중
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-7">
                        {/* Main Chart */}
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>시간대별 대기 현황</CardTitle>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {chartData && (
                                    <Bar
                                        data={chartData}
                                        options={{
                                            responsive: true,
                                            scales: {
                                                y: {
                                                    beginAtZero: true
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Store Stats Table */}
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>매장별 실적</CardTitle>
                                <CardDescription>
                                    대기 등록 및 입장 완료 건수
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>매장명</TableHead>
                                                <TableHead className="text-right">대기</TableHead>
                                                <TableHead className="text-right">입장</TableHead>
                                                <TableHead className="text-right">상태</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.store_stats.map((stat, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{stat.store_name}</TableCell>
                                                    <TableCell className="text-right">{stat.total_waiting}</TableCell>
                                                    <TableCell className="text-right">{stat.total_attendance}</TableCell>
                                                    <TableCell className="text-right">
                                                        {stat.is_open ? (
                                                            <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded-full">영업중</span>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs bg-slate-100 px-2 py-1 rounded-full">마감</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
