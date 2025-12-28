import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Phone, CalendarClock, ChevronRight, Trophy, Sparkles, UserX, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import api from "@/lib/api";
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Member {
    id: number;
    name: string;
    phone: string;
    created_at?: string;
    visit_count?: number;
    last_visit?: string;
    days_since?: number;
}

type TabType = 'all' | 'ranking' | 'new' | 'inactive';
type NewMemberPeriod = 'today' | 'week' | 'month';

export function OwnerMembers() {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [newMemberPeriod, setNewMemberPeriod] = useState<NewMemberPeriod>('month');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Construct URL based on active tab
    const getUrl = () => {
        if (activeTab === 'all') {
            return debouncedSearch ? `/members?search=${debouncedSearch}` : '/members?limit=20';
        }
        if (activeTab === 'ranking') {
            return '/members/statistics/ranking?limit=30';
        }
        if (activeTab === 'new') {
            return `/members/statistics/new?period=${newMemberPeriod}`;
        }
        if (activeTab === 'inactive') {
            return '/members/statistics/inactive?threshold_days=30';
        }
        return '/members?limit=20';
    };

    // Fetch members
    const { data: members, isLoading } = useSWR<Member[]>(
        getUrl(),
        async (url: string) => {
            const res = await api.get(url);
            return res.data;
        }
    );

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (activeTab !== 'all') setActiveTab('all');
    };

    const formatPhone = (phone: string) => {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    };

    // Helper to determine member status badge
    const getMemberBadge = (member: Member, index: number) => {
        if (activeTab === 'ranking') {
            let color = 'bg-slate-100 text-slate-600';
            if (index === 0) color = 'bg-yellow-100 text-yellow-700 border-yellow-200';
            if (index === 1) color = 'bg-slate-200 text-slate-700 border-slate-300';
            if (index === 2) color = 'bg-orange-100 text-orange-800 border-orange-200';

            return (
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", color)}>
                    {index + 1}위
                </span>
            );
        }
        if (activeTab === 'new') {
            return (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                    신규
                </span>
            );
        }
        if (activeTab === 'inactive') {
            return (
                <span className="bg-rose-50 text-rose-600 text-[10px] px-1.5 py-0.5 rounded font-bold border border-rose-100">
                    {member.days_since}일째 미방문
                </span>
            );
        }
        // Default (All tab) status logic
        if (member.visit_count === 1) return <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold">신규</span>;

        return null;
    };

    return (
        <div className="space-y-4 pb-20 h-full flex flex-col">
            {/* Search Bar */}
            <div className="sticky top-0 bg-slate-50 pt-2 z-10 px-1 space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="이름 또는 전화번호 뒷자리 검색"
                        className="pl-9 bg-white border-slate-200 rounded-xl h-11 text-sm shadow-sm"
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>

                {/* Main Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            activeTab === 'all'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                        )}
                    >
                        <User className="w-3 h-3" /> 전체
                    </button>
                    <button
                        onClick={() => setActiveTab('ranking')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            activeTab === 'ranking'
                                ? "bg-yellow-500 text-white border-yellow-500"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                        )}
                    >
                        <Trophy className="w-3 h-3" /> 출석랭킹
                    </button>
                    <button
                        onClick={() => setActiveTab('new')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            activeTab === 'new'
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                        )}
                    >
                        <Sparkles className="w-3 h-3" /> 신규회원
                    </button>
                    <button
                        onClick={() => setActiveTab('inactive')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                            activeTab === 'inactive'
                                ? "bg-rose-500 text-white border-rose-500"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                        )}
                    >
                        <UserX className="w-3 h-3" /> 장기미출석
                    </button>
                </div>

                {/* Sub Filter for 'New' tab */}
                {activeTab === 'new' && (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        {(['today', 'week', 'month'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setNewMemberPeriod(p)}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                                    newMemberPeriod === p
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "text-slate-400 hover:bg-slate-100"
                                )}
                            >
                                {p === 'today' ? '오늘' : p === 'week' ? '이번주' : '이번달'}
                            </button>
                        ))}
                    </div>
                )}
                {activeTab === 'ranking' && (
                    <div className="flex items-center gap-1.5 px-1 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-[11px] text-slate-400 font-medium">이번달 기준</span>
                    </div>
                )}
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-2">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
                    </div>
                ) : members?.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <p>검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    members?.map((member, index) => (
                        <div
                            key={member.id}
                            onClick={() => setSelectedMember(member)}
                            className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between group hover:border-slate-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                    activeTab === 'ranking' && index < 3 ? "bg-yellow-50 text-yellow-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {activeTab === 'ranking' && index < 3 ? <Trophy className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{member.name}</span>
                                        {getMemberBadge(member, index)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                        <span className="flex items-center gap-0.5">
                                            <Phone className="w-3 h-3" />
                                            {formatPhone(member.phone)}
                                        </span>
                                        {(activeTab === 'ranking' || member.visit_count) && (
                                            <span className="text-slate-300">| {member.visit_count}회 방문</span>
                                        )}
                                        {activeTab === 'inactive' && member.last_visit && (
                                            <span className="text-rose-400 truncate max-w-[120px]">
                                                {format(new Date(member.last_visit), 'yyyy.MM.dd')} 마지막 방문
                                            </span>
                                        )}
                                        {activeTab === 'new' && member.created_at && (
                                            <span className="text-emerald-500">
                                                {format(new Date(member.created_at), 'MM.dd')} 가입
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                        </div>
                    ))
                )}
            </div>

            {/* Member Details Modal */}
            <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                <DialogContent className="max-w-[90%] rounded-2xl p-0 overflow-hidden">
                    <div className="bg-slate-900 p-6 text-white text-center">
                        <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-3 backdrop-blur-sm">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <DialogTitle className="text-xl font-bold">{selectedMember?.name}</DialogTitle>
                        <DialogDescription className="text-slate-400 text-sm mt-1">{selectedMember && formatPhone(selectedMember.phone)}</DialogDescription>
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">
                                {activeTab === 'ranking' ? '이번달 방문' : '누적 방문'}
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                                {selectedMember?.visit_count || '-'}회
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-900">최근 정보</h3>
                            <div className="border-l-2 border-slate-200 pl-4 space-y-4 py-2 text-sm">
                                {selectedMember?.last_visit ? (
                                    <div className="relative">
                                        <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-slate-400 ring-4 ring-white" />
                                        <p className="font-bold text-slate-800">마지막 방문일</p>
                                        <p className="text-slate-500">{format(new Date(selectedMember.last_visit), 'yyyy년 MM월 dd일 HH:mm')}</p>
                                    </div>
                                ) : (
                                    <p className="text-slate-500">방문 이력이 없습니다.</p>
                                )}
                                {selectedMember?.created_at && (
                                    <div className="relative">
                                        <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                                        <p className="font-bold text-slate-800">가입일</p>
                                        <p className="text-slate-500">{format(new Date(selectedMember.created_at), 'yyyy년 MM월 dd일')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button className="w-full h-12 rounded-xl font-bold text-md" onClick={() => setSelectedMember(null)}>
                            닫기
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
