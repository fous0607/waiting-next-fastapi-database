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
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from "sonner";
import api from "@/lib/api";
import { OwnerKpi } from '@/components/owner/OwnerKpi';
import { OwnerCharts } from '@/components/owner/OwnerCharts';
import { cn } from '@/lib/utils';

export default function OwnerDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [storeName, setStoreName] = useState('');
    const [period, setPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('hourly');

    // Today for display
    const today = new Date();
    const dateStr = format(today, 'yyyy년 MM월 dd일 EEEE', { locale: ko });

    useEffect(() => {
        const name = localStorage.getItem('selected_store_name');
        if (name) setStoreName(name);
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setRefreshing(true);
        try {
            // Owner dashboard uses the same endpoint as admin dashboard stats
            // but filtered for their current store which is handled by backend get_current_store
            const response = await api.get(`/franchise/stats/store-dashboard?period=${period}`);
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch owner stats", error);
            toast.error("데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!loading) fetchStats();
    }, [period]);

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
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Top Bar */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-5 py-4">
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

            <main className="px-5 pt-6 space-y-6">
                {/* Welcome Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden mb-2">
                    <div className="relative z-10 flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <p className="text-slate-400 text-xs font-medium">{dateStr}</p>
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
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">LIVE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <OwnerKpi
                            title="현재 대기"
                            value={stats?.store_stats?.[0]?.current_waiting || 0}
                            unit="팀"
                            icon={Users}
                            color="blue"
                            loading={loading}
                        />
                        <OwnerKpi
                            title="오늘 방문"
                            value={stats?.total_visitors || 0}
                            unit="명"
                            icon={UserPlus}
                            color="emerald"
                            loading={loading}
                        />
                    </div>
                </section>

                {/* Business Stats Section */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Briefcase className="w-4 h-4 text-violet-500" />
                            영업 성과
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

                {/* Analysis Chart Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-rose-500" />
                            방문 통계
                        </h3>
                        <div className="flex bg-slate-200/50 p-1 rounded-xl">
                            <button
                                onClick={() => setPeriod('hourly')}
                                className={cn("px-3 py-1 rounded-lg text-[11px] font-bold transition-all", period === 'hourly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
                            >
                                시간대
                            </button>
                            <button
                                onClick={() => setPeriod('daily')}
                                className={cn("px-3 py-1 rounded-lg text-[11px] font-bold transition-all", period === 'daily' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
                            >
                                일단위
                            </button>
                        </div>
                    </div>

                    <OwnerCharts
                        title={period === 'hourly' ? "오늘 시간대별 패턴" : "최근 방문 추이"}
                        data={stats?.hourly_stats || []}
                        loading={loading}
                        type={period === 'hourly' ? 'bar' : 'line'}
                    />
                </section>

                {/* Quick Info / Tips */}
                <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 flex gap-4">
                    <div className="shrink-0 bg-blue-100/50 p-2 rounded-2xl h-fit">
                        <Info className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1">인사이트 팁</h4>
                        <p className="text-xs text-blue-700 leading-relaxed font-medium">
                            {stats?.total_visitors > 50
                                ? "오늘은 평소보다 많은 분들이 찾아주셨네요! 신규 회원 유치에 힘써보시는 건 어떨까요?"
                                : "비교적 한산한 하루네요. 재방문 고객분들에게 특별한 혜택을 제공해보세요."}
                        </p>
                    </div>
                </div>
            </main>

            {/* Bottom Tab Bar (Placeholder / Future Nav) */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 pb-8 flex justify-around">
                <button className="flex flex-col items-center gap-1 text-rose-500">
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-[10px] font-bold">데이터</span>
                </button>
                <button
                    onClick={() => toast.info("상세 분석 기능은 곧 추가될 예정입니다.")}
                    className="flex flex-col items-center gap-1 text-slate-400"
                >
                    <BarChart3 className="w-6 h-6" />
                    <span className="text-[10px] font-bold">상세분석</span>
                </button>
                <button
                    onClick={() => toast.info("회원 관리 기능은 준비 중입니다.")}
                    className="flex flex-col items-center gap-1 text-slate-400"
                >
                    <Users className="w-6 h-6" />
                    <span className="text-[10px] font-bold">회원관리</span>
                </button>
            </nav>
        </div>
    );
}

// Sub-components can be moved to separate files as planned
