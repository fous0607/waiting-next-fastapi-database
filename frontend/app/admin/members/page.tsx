'use client';

import React, { useState } from 'react';
import { Search, User, Phone, Calendar, Clock, ArrowRight, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import api from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Member {
    id: number;
    name: string;
    phone: string;
}

interface VisitHistory {
    id: number;
    business_date: string;
    registered_at: string;
    attended_at: string | null;
    status: string;
    class_name: string;
}

interface MemberDetail {
    member: Member;
    total_visits: number;
    last_visit: string | null;
    history: VisitHistory[];
}

export default function MemberLookupPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<MemberDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearchLoading(true);
        setSelectedMember(null);
        try {
            // Reusing existing member search endpoint if available, or fetch all and filter
            // Actually, let's check statistics.py for suitable endpoints or use general members endpoint
            const response = await api.get(`/members?search=${searchQuery}`);
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const fetchMemberDetail = async (member: Member) => {
        setDetailLoading(true);
        try {
            // We need a specific endpoint for member visit history
            // For now, let's fetch from a proposed new endpoint or filter waiting list
            const response = await api.get(`/franchise/stats/member-history/${member.id}`);
            setSelectedMember(response.data);
        } catch (error) {
            console.error('Failed to fetch details:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">회원 정보 조회</h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">회원별 방문 기록 및 이용 현황을 확인합니다.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Search Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-600">회원 검색</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSearch} className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="이름 또는 전화번호"
                                        className="pl-9 rounded-xl border-slate-200 focus:ring-slate-900"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="rounded-xl bg-slate-900 hover:bg-slate-800"
                                    disabled={searchLoading}
                                >
                                    {searchLoading ? '검색 중...' : '검색하기'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {searchResults.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold text-slate-400 px-1 uppercase tracking-wider">검색 결과 ({searchResults.length})</p>
                            <div className="space-y-2">
                                {searchResults.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => fetchMemberDetail(m)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                                            selectedMember?.member.id === m.id
                                                ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200"
                                                : "bg-white border-slate-100 hover:border-slate-300 text-slate-900"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                                selectedMember?.member.id === m.id ? "bg-white/10" : "bg-slate-50"
                                            )}>
                                                <User className={cn("w-5 h-5", selectedMember?.member.id === m.id ? "text-white" : "text-slate-400")} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{m.name}</p>
                                                <p className={cn("text-xs font-medium", selectedMember?.member.id === m.id ? "text-slate-400" : "text-slate-500")}>
                                                    {m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowRight className={cn("w-4 h-4 opacity-0 transition-all", selectedMember?.member.id === m.id ? "opacity-100" : "group-hover:opacity-100 text-slate-300")} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-2">
                    {detailLoading ? (
                        <div className="bg-white rounded-3xl border border-slate-100 h-full flex items-center justify-center p-20">
                            <GlobalLoader message="회원 정보를 불러오고 있습니다..." />
                        </div>
                    ) : selectedMember ? (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            {/* Summary Card */}
                            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                                            <User className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold">{selectedMember.member.name}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-slate-400 font-medium text-sm">
                                                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedMember.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="bg-white/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">총 방문 횟수</p>
                                            <p className="text-xl font-bold">{selectedMember.total_visits}회</p>
                                        </div>
                                        <div className="bg-white/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">최근 방문일</p>
                                            <p className="text-xl font-bold">
                                                {selectedMember.last_visit ? format(new Date(selectedMember.last_visit), 'MM.dd') : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                            </div>

                            {/* History Section */}
                            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                        <History className="w-4.5 h-4.5 text-slate-400" />
                                        방문 히스토리
                                    </h4>
                                </div>

                                {selectedMember.history.length > 0 ? (
                                    <div className="divide-y divide-slate-50">
                                        {selectedMember.history.map((visit) => (
                                            <div key={visit.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <Calendar className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{visit.business_date}</p>
                                                        <p className="text-xs text-slate-500 font-medium">{visit.class_name}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1",
                                                        visit.status === 'attended' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {visit.status === 'attended' ? '출석 완료' : '취소/노쇼'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(visit.registered_at), 'HH:mm')} 등록
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center">
                                        <p className="text-slate-400 font-medium">방문 기록이 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-dashed border-slate-200 h-[500px] flex flex-col items-center justify-center p-10 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                                <User className="w-8 h-8 text-slate-200" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">회원을 선택해주세요</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs">왼쪽 검색 결과에서 회원을 선택하면 상세 방문 히스토리를 확인할 수 있습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper for conditional class loading
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
