import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Phone, CalendarClock, ChevronRight } from 'lucide-react';
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
    created_at: string;
    visit_count?: number; // Optional until backend supports it
    last_visit?: string;  // Optional until backend supports it
}

export function OwnerMembers() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch members
    const { data: members, isLoading } = useSWR<Member[]>(
        debouncedSearch ? `/members?search=${debouncedSearch}` : '/members?limit=20',
        async (url) => {
            const res = await api.get(url);
            return res.data;
        }
    );

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    // Helper to format phone
    const formatPhone = (phone: string) => {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    };

    // Helper to determine member status (Mock functionality for now)
    const getMemberStatus = (member: Member) => {
        // This would ideally come from backend
        // Mock logic: randomly assign for visual demo if not present
        const count = member.visit_count || Math.floor(Math.random() * 10) + 1;

        if (count === 1) return { label: '신규', color: 'bg-emerald-100 text-emerald-700' };
        if (count >= 5) return { label: 'VIP', color: 'bg-rose-100 text-rose-700' };
        return { label: '재방문', color: 'bg-blue-100 text-blue-700' };
    };

    return (
        <div className="space-y-4 pb-20 h-full flex flex-col">
            {/* Search Bar */}
            <div className="sticky top-0 bg-slate-50 pt-2 pb-2 z-10 px-1">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="이름 또는 전화번호 뒷자리 검색"
                        className="pl-9 bg-white border-slate-200 rounded-xl h-12 text-base shadow-sm"
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto space-y-2 px-1">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
                    </div>
                ) : members?.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <p>검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    members?.map((member) => {
                        const status = getMemberStatus(member);
                        return (
                            <div
                                key={member.id}
                                onClick={() => setSelectedMember(member)}
                                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm active:scale-[0.98] transition-transform flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{member.name}</span>
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", status.color)}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                            <span className="flex items-center gap-0.5">
                                                <Phone className="w-3 h-3" />
                                                {formatPhone(member.phone)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300" />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Member Details Modal */}
            <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                <DialogContent className="max-w-[90%] rounded-2xl p-0 overflow-hidden">
                    <div className="bg-slate-900 p-6 text-white text-center">
                        <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-3 backdrop-blur-sm">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold">{selectedMember?.name}</h2>
                        <p className="text-slate-400 text-sm mt-1">{selectedMember && formatPhone(selectedMember.phone)}</p>
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">누적 방문</span>
                            <span className="text-lg font-bold text-slate-900">
                                {selectedMember?.visit_count || Math.floor(Math.random() * 20) + 1}회
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-900">최근 방문 이력</h3>
                            <div className="border-l-2 border-slate-200 pl-4 space-y-4 py-2">
                                {/* Mock History */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                                    <p className="text-sm font-bold text-slate-800">2024.12.27 (금) 19:30</p>
                                    <p className="text-xs text-slate-500">2명 • 5분 대기 후 입장</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white" />
                                    <p className="text-sm font-bold text-slate-800">2024.12.15 (일) 12:45</p>
                                    <p className="text-xs text-slate-500">4명 • 15분 대기 후 입장</p>
                                </div>
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
