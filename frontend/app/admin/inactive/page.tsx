'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserX, Calendar, Phone, Search, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface InactiveMember {
    id: number;
    name: string;
    phone: string;
    last_visit: string | null;
    days_since: number | null;
}

export default function InactiveMembersPage() {
    const [loading, setLoading] = useState(true);
    const [allMembers, setAllMembers] = useState<InactiveMember[]>([]);
    const [threshold, setThreshold] = useState(30);
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const fetchInactive = async (days: number) => {
        setLoading(true);
        try {
            const response = await api.get(`/franchise/stats/inactive-members?days=${days}`);
            setAllMembers(response.data);
        } catch (error) {
            console.error('Failed to fetch inactive members:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInactive(threshold);
    }, [threshold]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return allMembers;
        const q = searchQuery.toLowerCase();
        return allMembers.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.phone.includes(q)
        );
    }, [allMembers, searchQuery]);

    const handleCopyPhones = () => {
        const phones = filteredMembers.map(m => m.phone).join('\n');
        navigator.clipboard.writeText(phones);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <UserX className="w-7 h-7 text-rose-500" />
                        미출석 회원 조회 (이탈 분석)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">오랫동안 방문하지 않은 고객을 찾아 마케팅에 활용하세요.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    {[15, 30, 60, 90].map((days) => (
                        <button
                            key={days}
                            onClick={() => setThreshold(days)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                threshold === days
                                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                                    : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {days}일 이상
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="pb-3 px-6 pt-6">
                            <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">목록 필터링</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="이름/전화번호 검색"
                                    className="pl-9 rounded-xl border-slate-200"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800"
                                onClick={handleCopyPhones}
                                disabled={filteredMembers.length === 0}
                            >
                                {copied ? (
                                    <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 복사됨</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Copy className="w-4 h-4" /> 번호 일괄 복사</span>
                                )}
                            </Button>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                검색된 {filteredMembers.length}명의 전화번호를 클립보드에 복사하여 문자 발송 등에 활용할 수 있습니다.
                            </p>
                        </CardContent>
                    </Card>

                    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-rose-900">알림</p>
                                <p className="text-[11px] text-rose-700 mt-1 leading-normal font-medium">
                                    {threshold}일 이상 방문하지 않은 고객은 이탈 가능성이 높습니다. 특별 혜택 안내를 권장합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="py-40 flex flex-col items-center justify-center">
                                    <GlobalLoader message="이탈 가능 회원을 분석 중입니다..." />
                                </div>
                            ) : filteredMembers.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {filteredMembers.map((member) => (
                                        <div key={member.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-rose-50 transition-colors">
                                                    <UserX className="w-5 h-5 text-slate-400 group-hover:text-rose-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-900">{member.name}</p>
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                                            {member.days_since}일째 미방문
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">마지막 방문</p>
                                                <p className="text-sm font-bold text-slate-700 flex items-center justify-end gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                    {member.last_visit || '기록 없음'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-40 text-center">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">미출석 회원이 없습니다</h3>
                                    <p className="text-sm text-slate-500 mt-1">모든 회원이 활발하게 방문 중입니다.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
