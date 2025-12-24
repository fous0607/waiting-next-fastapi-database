'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Calendar, Phone, Search, Copy, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';

interface NewMember {
    id: number;
    name: string;
    phone: string;
    created_at: string;
    store_name: string;
}

export default function NewMembersPage() {
    const [loading, setLoading] = useState(true);
    const [allMembers, setAllMembers] = useState<NewMember[]>([]);
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const fetchNewMembers = async (start: string, end: string) => {
        setLoading(true);
        try {
            const response = await api.get(`/franchise/stats/new-members?start_date=${start}&end_date=${end}`);
            setAllMembers(response.data);
        } catch (error) {
            console.error('Failed to fetch new members:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            fetchNewMembers(dateRange.start, dateRange.end);
        }
    }, [dateRange]);

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
                        <UserPlus className="w-7 h-7 text-indigo-500" />
                        신규 회원 조회
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">지정된 기간 동안 새롭게 가입한 회원 목록입니다.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <DateRangeSelector onRangeChange={setDateRange} />
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
                        </CardContent>
                    </Card>

                    <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm relative overflow-hidden">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">총 신규 회원</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-4xl font-black text-indigo-900">{filteredMembers.length}</p>
                            <p className="text-sm font-bold text-indigo-500">명</p>
                        </div>
                        <UserPlus className="absolute -right-2 -bottom-2 w-16 h-16 text-indigo-500/10 rotate-12" />
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="py-40 flex flex-col items-center justify-center">
                                    <GlobalLoader message="신규 회원을 불러오는 중입니다..." />
                                </div>
                            ) : filteredMembers.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {filteredMembers.map((member) => (
                                        <div key={member.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                                    <UserPlus className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{member.name}</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">가입 일시</p>
                                                <p className="text-sm font-bold text-slate-700 flex items-center justify-end gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                    {member.created_at}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-40 text-center">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                                        <Search className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">신규 회원이 없습니다</h3>
                                    <p className="text-sm text-slate-500 mt-1 font-medium">선택하신 기간에 가입한 회원이 없거나 검색 결과가 없습니다.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
