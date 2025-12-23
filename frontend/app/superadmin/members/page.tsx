'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Search, AlertCircle, UserPlus } from 'lucide-react';

interface Member {
    id: number;
    name: string;
    phone: string;
    barcode: string | null;
    store_id: number;
    created_at: string;
    updated_at: string;
    store_name: string | null;
    franchise_name: string | null;
}

export default function MembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        fetchMembers();
    }, [searchQuery]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (searchQuery) {
                params.append('q', searchQuery);
            }
            params.append('limit', '100');

            const response = await fetch(`/api/system/members?${params.toString()}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`회원 목록을 불러오는데 실패했습니다: ${response.status}`);
            }

            const data = await response.json();
            setMembers(data);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchInput);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const formatPhone = (phone: string) => {
        // Format: 010-1234-5678
        if (phone.length === 11) {
            return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
        }
        return phone;
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">회원 조회</h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 rounded-full shrink-0">
                            <Users className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">전체 회원</p>
                            <p className="text-base font-bold text-slate-900">{members.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-blue-100 rounded-full shrink-0">
                            <UserPlus className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">바코드 등록</p>
                            <p className="text-base font-bold text-blue-600">
                                {members.filter(m => m.barcode).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-green-100 rounded-full shrink-0">
                            <Search className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">검색 결과</p>
                            <p className="text-base font-bold text-green-600">
                                {searchQuery ? members.length : '-'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search Bar */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="이름 또는 전화번호로 검색..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            검색
                        </button>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchInput('');
                                    setSearchQuery('');
                                }}
                                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                            >
                                초기화
                            </button>
                        )}
                    </form>
                </CardContent>
            </Card>

            {/* Members Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        회원 목록
                        {searchQuery && (
                            <span className="text-sm font-normal text-slate-500">
                                (검색어: "{searchQuery}")
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-12 text-red-600">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {error}
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            {searchQuery ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
                        </div>
                    ) : (
                        <div className="rounded-md border h-[600px] overflow-auto relative">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">이름</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">전화번호</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">바코드</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">프랜차이즈</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">매장</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">가입일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((member) => (
                                        <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-3 px-4 text-sm text-slate-900">{member.id}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-slate-900">{member.name}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600 font-mono">
                                                {formatPhone(member.phone)}
                                            </td>
                                            <td className="py-3 px-4">
                                                {member.barcode ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-50 text-blue-700">
                                                        {member.barcode}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {member.franchise_name || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {member.store_name || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {formatDate(member.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
