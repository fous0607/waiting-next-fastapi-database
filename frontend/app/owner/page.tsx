'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users,
    TrendingUp,
    Briefcase,
    Calendar,
    RefreshCw,
    LogOut,
    ChevronRight,
    Search,
    Menu,
    Bell,
    UserPlus,
    DollarSign,
    Info,
    Store,
    BarChart3
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from "sonner";
import api from "@/lib/api";
import { OwnerKpi } from '@/components/owner/OwnerKpi';
import { OwnerCharts } from '@/components/owner/OwnerCharts';
import { OwnerAnalytics } from '@/components/owner/OwnerAnalytics';
import { OwnerMembers } from '@/components/owner/OwnerMembers';
import { cn } from '@/lib/utils';
import { DateRange } from "react-day-picker";

export default function OwnerDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [storeName, setStoreName] = useState('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'members'>('dashboard');
    const [period, setPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('hourly');

    // 1. Separate States for each view type
    // Common Range (Hourly & Daily): Week Range (default: This Week)
    const [commonRange, setCommonRange] = useState<DateRange | undefined>({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 })
    });

    // Monthly: Month Range (default: This Month)
    const [monthlyRange, setMonthlyRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    // 2. Computed current range based on active period
    const getCurrentRange = (): DateRange | undefined => {
        if (period === 'monthly') {
            return monthlyRange;
        }
        // For hourly, daily, weekly -> return commonRange
        return commonRange;
    };

    // Today for display
    const today = new Date();
    const dateStr = format(today, 'yyyy년 MM월 dd일 EEEE', { locale: ko });

    useEffect(() => {
        const name = localStorage.getItem('selected_store_name');
        if (name) setStoreName(name);
        fetchStats();
    }, []);

    // 3. Unified Date Change Handler
    const handleDateRangeChange = (newRange: DateRange | undefined) => {
        if (!newRange?.from) return;

        if (period === 'monthly') {
            setMonthlyRange(newRange);
        } else {
            // Update Common Range (Hourly / Daily / Weekly)
            setCommonRange(newRange);
        }
    };

    const fetchStats = async () => {
        setRefreshing(true);
        try {
            const currentRange = getCurrentRange();
            const startStr = currentRange?.from ? format(currentRange.from, 'yyyy-MM-dd') : '';
            const endStr = currentRange?.to ? format(currentRange.to, 'yyyy-MM-dd') : startStr;

            let query = `/franchise/stats/store-dashboard?period=${period}`;
            if (startStr) query += `&start_date=${startStr}`;
            if (endStr) query += `&end_date=${endStr}`;

            const response = await api.get(query);
            setStats(response.data);

        } catch (error) {
            console.error("Failed to fetch owner stats", error);
            toast.error("데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Handle period changes (View Switching)
    const handleSetPeriod = (newPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly') => {
        setPeriod(newPeriod);
        // We DO NOT reset dates here anymore, promoting persistence/syncing as per requirements
    };

    useEffect(() => {
        if (!loading && activeTab !== 'members') fetchStats();
        // Depend on the specific state variables instead of a single dateRange
    }, [period, activeTab, commonRange, monthlyRange]);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error("Logout error", error);
        } finally {
            localStorage.clear();
            document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            window.location.href = '/login';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Top Bar */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-5 pt-2 pb-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-rose-500 p-1.5 rounded-lg">
                            <Store className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 leading-tight">
                                {storeName || '매장 대시보드'}
                            </h1>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Owner View</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchStats}
                            className={cn("p-2 rounded-full text-slate-500 hover:bg-slate-50 transition-all", refreshing && "animate-spin")}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="px-5 pt-1.5 pb-24 min-h-[calc(100vh-64px)]">
                {activeTab === 'dashboard' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Welcome Card */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-4 text-white shadow-xl relative overflow-hidden">
                            <div className="relative z-10 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <p className="text-slate-400 text-xs font-medium">
                                            {dateStr}
                                            {stats?.store_stats?.[0]?.open_time && (
                                                <span className="ml-2 py-0.5 px-1.5 rounded bg-white/5">
                                                    {stats.store_stats[0].open_time}
                                                </span>
                                            )}
                                        </p>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-semibold">영업중</span>
                                        </div>
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold">관리자님, 안녕하세요!</h2>
                            </div>
                            {/* Decorative Circles */}
                            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                            <div className="absolute right-6 top-0 w-16 h-16 bg-rose-500/10 rounded-full blur-xl" />
                        </div>

                        {/* Real-time KPI Section */}
                        <section>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    실시간 현황
                                </h3>
                                <div className="flex gap-2">
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">LIVE</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <OwnerKpi
                                    title="총 대기 인원"
                                    value={stats?.total_visitors || 0}
                                    unit="명"
                                    icon={UserPlus}
                                    color="emerald"
                                    loading={loading}
                                />
                                <OwnerKpi
                                    title="현재 대기"
                                    value={stats?.store_stats?.[0]?.current_waiting || 0}
                                    unit="명"
                                    icon={Users}
                                    color="blue"
                                    loading={loading}
                                />
                            </div>
                        </section>

                        {/* Business Stats Section */}
                        <section>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Briefcase className="w-4 h-4 text-violet-500" />
                                    출석 및 신규
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <OwnerKpi
                                    title="출석 인원"
                                    value={stats?.total_attendance || 0}
                                    unit="명"
                                    icon={Users}
                                    color="orange"
                                    loading={loading}
                                />
                                <OwnerKpi
                                    title="신규 회원"
                                    value={stats?.new_members || 0}
                                    unit="명"
                                    icon={UserPlus}
                                    color="violet"
                                    loading={loading}
                                />
                            </div>
                        </section>

                        {/* Analysis Chart Section - Simplified for Dashboard */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-rose-500" />
                                    오늘의 패턴
                                </h3>
                                <button
                                    onClick={() => setActiveTab('analytics')}
                                    className="text-xs text-slate-400 font-medium flex items-center gap-1 hover:text-slate-600"
                                >
                                    더보기 <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>

                            <OwnerCharts
                                title="시간대별 분포"
                                data={stats?.hourly_stats || []}
                                loading={loading}
                                type="bar"
                            />
                        </section>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <OwnerAnalytics
                            stats={stats}
                            loading={loading}
                            period={period}
                            setPeriod={handleSetPeriod}
                            dateRange={getCurrentRange()}
                            setDateRange={handleDateRangeChange}
                        />
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full">
                        <OwnerMembers />
                    </div>
                )}
            </main>

            {/* Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-6 py-2 pb-6 flex justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors p-2 rounded-xl w-16",
                        activeTab === 'dashboard' ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-[10px] font-bold">홈</span>
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors p-2 rounded-xl w-16",
                        activeTab === 'analytics' ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <BarChart3 className="w-6 h-6" />
                    <span className="text-[10px] font-bold">상세분석</span>
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors p-2 rounded-xl w-16",
                        activeTab === 'members' ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Users className="w-6 h-6" />
                    <span className="text-[10px] font-bold">회원관리</span>
                </button>
            </nav>
        </div>
    );
}
