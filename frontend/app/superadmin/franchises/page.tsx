'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building, Building2, AlertCircle, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Store {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
    member_type: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    stores: Store[];
}

const memberTypeLabels: Record<string, string> = {
    individual: '개인',
    corporate: '법인',
    partnership: '파트너십',
};

const memberTypeColors: Record<string, string> = {
    individual: 'bg-blue-100 text-blue-800',
    corporate: 'bg-purple-100 text-purple-800',
    partnership: 'bg-green-100 text-green-800',
};

export default function FranchisesPage() {
    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Form State
    const [open, setOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        code: '',
        member_type: 'individual'
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchFranchises();
    }, []);

    const fetchFranchises = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/system/franchises?include_stores=true', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`프랜차이즈 목록을 불러오는데 실패했습니다: ${response.status}`);
            }

            const data = await response.json();
            setFranchises(data);
        } catch (err) {
            console.error('Failed to fetch franchises:', err);
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!createForm.name || !createForm.code) {
            toast.error('프랜차이즈 이름과 코드를 입력해주세요.');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch('/api/system/franchises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(createForm),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || '프랜차이즈 생성 실패');
            }

            toast.success('프랜차이즈가 생성되었습니다.');
            setOpen(false);
            setCreateForm({ name: '', code: '', member_type: 'individual' }); // Reset form
            fetchFranchises(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '생성 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalStores = franchises.reduce((sum, f) => sum + (f.stores?.length || 0), 0);
    const activeStores = franchises.reduce((sum, f) =>
        sum + (f.stores?.filter(s => s.is_active).length || 0), 0
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">프랜차이즈 관리</h2>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" />
                            프랜차이즈 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>새 프랜차이즈 등록</DialogTitle>
                            <DialogDescription>
                                새로운 프랜차이즈 정보를 입력하세요. 코드는 고유해야 합니다.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">프랜차이즈명</Label>
                                <Input
                                    id="name"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="예: 맛있는 치킨"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code">코드 (영문/숫자)</Label>
                                <Input
                                    id="code"
                                    value={createForm.code}
                                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                                    placeholder="예: tasty_chicken"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="member_type">회원 관리 유형</Label>
                                <Select
                                    value={createForm.member_type}
                                    onValueChange={(value) => setCreateForm({ ...createForm, member_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="유형 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="individual">개인 (매장별 관리)</SelectItem>
                                        <SelectItem value="corporate">법인 (통합 관리)</SelectItem>
                                        <SelectItem value="partnership">파트너십</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                            <Button onClick={handleCreate} disabled={submitting}>
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                등록하기
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 rounded-full shrink-0">
                            <Building className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">전체 프랜차이즈</p>
                            <p className="text-base font-bold text-slate-900">{franchises.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-green-100 rounded-full shrink-0">
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">활성 프랜차이즈</p>
                            <p className="text-base font-bold text-green-600">
                                {franchises.filter(f => f.is_active).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-blue-100 rounded-full shrink-0">
                            <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">전체 매장</p>
                            <p className="text-base font-bold text-blue-600">{totalStores}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-emerald-100 rounded-full shrink-0">
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">활성 매장</p>
                            <p className="text-base font-bold text-emerald-600">{activeStores}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Franchises Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        프랜차이즈 목록
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
                    ) : franchises.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            등록된 프랜차이즈가 없습니다.
                        </div>
                    ) : (
                        <div className="rounded-md border h-[600px] overflow-auto relative">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">코드</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">프랜차이즈명</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">회원 유형</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">매장 수</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">활성 매장</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">상태</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">생성일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {franchises.map((franchise) => {
                                        const storeCount = franchise.stores?.length || 0;
                                        const activeStoreCount = franchise.stores?.filter(s => s.is_active).length || 0;

                                        return (
                                            <tr key={franchise.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 text-sm text-slate-900 font-medium">{franchise.id}</td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                        {franchise.code}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm font-semibold text-slate-900">{franchise.name}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${memberTypeColors[franchise.member_type] || 'bg-gray-100 text-gray-800'}`}>
                                                        {memberTypeLabels[franchise.member_type] || franchise.member_type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-900">
                                                    <span className="font-semibold">{storeCount}</span>
                                                    <span className="text-slate-500 ml-1">개</span>
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <span className="font-semibold text-green-600">{activeStoreCount}</span>
                                                    <span className="text-slate-500 ml-1">/ {storeCount}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {franchise.is_active ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                            활성
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                            비활성
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-500">
                                                    {formatDate(franchise.created_at)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
