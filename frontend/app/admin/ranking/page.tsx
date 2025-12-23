'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, User, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface RankingItem {
    id: number;
    name: string;
    phone: string;
    visit_count: number;
}

export default function AttendanceRankingPage() {
    const [loading, setLoading] = useState(true);
    const [ranking, setRanking] = useState<RankingItem[]>([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const fetchRanking = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (start) params.append('start_date', start);
            if (end) params.append('end_date', end);

            const response = await api.get(`/franchise/stats/attendance-ranking?${params.toString()}`);
            setRanking(response.data);
        } catch (error) {
            console.error('Failed to fetch ranking:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = (range: { start: string; end: string }) => {
        setDateRange(range);
        fetchRanking(range.start, range.end);
    };

    const maxVisits = ranking.length > 0 ? ranking[0].visit_count : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Trophy className="w-7 h-7 text-amber-500" />
                        출석 순위 (TOP 50)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">우리 매장에 가장 자주 방문하는 우수 회원들입니다.</p>
                </div>

                <DateRangeSelector onRangeChange={handleRangeChange} />
            </div>

            {loading ? (
                <div className="py-40 flex flex-col items-center justify-center">
                    <GlobalLoader message="순위를 집계하고 있습니다..." />
                </div>
            ) : ranking.length > 0 ? (
                <div className="space-y-6">
                    {/* Top 3 Spotlight */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {ranking.slice(0, 3).map((item, idx) => (
                            <Card key={item.id} className={cn(
                                "border-none shadow-lg relative overflow-hidden",
                                idx === 0 ? "bg-slate-900 text-white scale-105" : "bg-white text-slate-900"
                            )}>
                                <CardContent className="pt-10 pb-8 text-center">
                                    <div className="flex justify-center mb-4">
                                        <div className={cn(
                                            "w-16 h-16 rounded-2xl flex items-center justify-center",
                                            idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-100" : "bg-orange-100"
                                        )}>
                                            {idx === 0 ? <Trophy className="w-8 h-8 text-amber-900" /> :
                                                idx === 1 ? <Medal className="w-8 h-8 text-slate-400" /> :
                                                    <Award className="w-8 h-8 text-orange-600" />}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold">{item.name}</h3>
                                    <p className={cn("text-xs mt-1", idx === 0 ? "text-slate-400" : "text-slate-500")}>
                                        {item.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                                    </p>
                                    <div className="mt-6">
                                        <span className="text-3xl font-black">{item.visit_count}</span>
                                        <span className="text-sm font-bold ml-1 opacity-60">회 방문</span>
                                    </div>
                                    {idx === 0 && (
                                        <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[10px] font-black px-3 py-1 rounded-bl-xl rotate-0">
                                            BEST
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Rankings List */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mt-10">
                        <div className="p-6 border-b border-slate-50">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                                전체 순위
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {ranking.map((item, idx) => (
                                <div key={item.id} className="p-4 flex items-center gap-6 hover:bg-slate-50/50 transition-colors">
                                    <div className="w-8 text-center shrink-0">
                                        <span className={cn(
                                            "text-sm font-black",
                                            idx < 3 ? "text-amber-500" : "text-slate-300"
                                        )}>
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 truncate">{item.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">({item.phone.slice(-4)})</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-900">{item.visit_count}회</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full transition-all duration-1000", idx < 3 ? "bg-amber-400" : "bg-slate-900")}
                                                style={{ width: `${(item.visit_count / maxVisits) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-40 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-8 h-8 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">순위 데이터가 없습니다</h3>
                    <p className="text-sm text-slate-500 mt-1">출석 기록이 있는 회원이 없습니다.</p>
                </div>
            )}
        </div>
    );
}
