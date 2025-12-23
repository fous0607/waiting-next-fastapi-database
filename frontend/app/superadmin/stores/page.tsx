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
import { Store as StoreIcon, Building2, AlertCircle, Plus, Loader2, Settings, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface StoreData {
    id: number;
    franchise_id: number;
    name: string;
    code: string;
    is_active: boolean;
    last_heartbeat: string | null;
    created_at: string;
    updated_at: string;
    franchise_name: string | null;
}

interface FranchiseSimple {
    id: number;
    name: string;
}

export default function StoresPage() {
    const [stores, setStores] = useState<StoreData[]>([]);
    const [franchises, setFranchises] = useState<FranchiseSimple[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Form State
    const [open, setOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        franchise_id: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchStores();
        fetchFranchises();
    }, []);

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/system/stores', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`매장 목록을 불러오는데 실패했습니다: ${response.status}`);
            }

            const data = await response.json();
            setStores(data);
        } catch (err) {
            console.error('Failed to fetch stores:', err);
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const fetchFranchises = async () => {
        try {
            const response = await fetch('/api/system/franchises', {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setFranchises(data);
            }
        } catch (err) {
            console.error('Failed to fetch franchises:', err);
        }
    };

    const handleCreate = async () => {
        if (!createForm.name || !createForm.franchise_id) {
            toast.error('프랜차이즈와 매장명을 모두 입력해주세요.');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch(`/api/system/franchises/${createForm.franchise_id}/stores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: createForm.name }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || '매장 생성 실패');
            }

            toast.success('매장이 생성되었습니다.');
            setOpen(false);
            setCreateForm({ name: '', franchise_id: '' }); // Reset form
            fetchStores(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '생성 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getHeartbeatStatus = (lastHeartbeat: string | null) => {
        if (!lastHeartbeat) return { label: '미확인', color: 'bg-gray-100 text-gray-800' };

        const now = new Date();
        const heartbeat = new Date(lastHeartbeat);
        const diffMinutes = (now.getTime() - heartbeat.getTime()) / (1000 * 60);

        if (diffMinutes < 5) {
            return { label: '온라인', color: 'bg-green-100 text-green-800' };
        } else if (diffMinutes < 30) {
            return { label: '최근 활동', color: 'bg-yellow-100 text-yellow-800' };
        } else {
            return { label: '오프라인', color: 'bg-red-100 text-red-800' };
        }
    };

    // Reset Modal State
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [selectedStoreForReset, setSelectedStoreForReset] = useState<StoreData | null>(null);
    const [resetOptions, setResetOptions] = useState({
        waiting: false,
        attendance: false,
        members: false,
    });
    const [isResetting, setIsResetting] = useState(false);

    // ... (existing imports need to be updated first)

    const handleResetClick = (store: StoreData) => {
        setSelectedStoreForReset(store);
        setResetOptions({
            waiting: false,
            attendance: false,
            members: false,
        });
        setResetDialogOpen(true);
    };

    const handleResetConfirm = async () => {
        if (!selectedStoreForReset) return;
        if (!resetOptions.waiting && !resetOptions.attendance && !resetOptions.members) {
            toast.error('초기화할 항목을 선택해주세요.');
            return;
        }

        try {
            setIsResetting(true);
            const promises = [];
            const results = [];

            if (resetOptions.waiting) {
                promises.push(
                    fetch(`/api/system/stores/${selectedStoreForReset.id}/reset/waiting`, {
                        method: 'DELETE',
                        credentials: 'include',
                    }).then(res => {
                        if (!res.ok) throw new Error('대기 정보 초기화 실패');
                        return '대기 정보';
                    })
                );
            }

            if (resetOptions.attendance) {
                promises.push(
                    fetch(`/api/system/stores/${selectedStoreForReset.id}/reset/history`, {
                        method: 'DELETE',
                        credentials: 'include',
                    }).then(res => {
                        if (!res.ok) throw new Error('출석 정보 초기화 실패');
                        return '출석 정보';
                    })
                );
            }

            if (resetOptions.members) {
                promises.push(
                    fetch(`/api/system/stores/${selectedStoreForReset.id}/reset/members`, {
                        method: 'DELETE',
                        credentials: 'include',
                    }).then(res => {
                        if (!res.ok) throw new Error('회원 정보 초기화 실패');
                        return '회원 정보';
                    })
                );
            }

            await Promise.all(promises);
            toast.success('선택한 데이터가 초기화되었습니다.');
            setResetDialogOpen(false);
            fetchStores(); // Refresh data if needed
        } catch (error) {
            console.error(error);
            toast.error('데이터 초기화 중 오류가 발생했습니다.');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">매장 관리</h2>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" />
                            매장 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>새 매장 등록</DialogTitle>
                            <DialogDescription>
                                특정 프랜차이즈에 속한 새 매장을 등록합니다. 코드는 자동 생성됩니다.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="franchise">프랜차이즈 선택</Label>
                                <Select
                                    value={createForm.franchise_id}
                                    onValueChange={(value) => setCreateForm({ ...createForm, franchise_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="프랜차이즈를 선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[10000]">
                                        {franchises.map((f) => (
                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">매장명</Label>
                                <Input
                                    id="name"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="예: 강남점"
                                />
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

            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>매장 데이터 초기화</DialogTitle>
                        <DialogDescription>
                            선택한 매장({selectedStoreForReset?.name})의 데이터를 초기화합니다.<br />
                            <span className="text-red-600 font-bold">이 작업은 되돌릴 수 없습니다.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="reset-waiting"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={resetOptions.waiting}
                                onChange={(e) => setResetOptions({ ...resetOptions, waiting: e.target.checked })}
                            />
                            <Label htmlFor="reset-waiting" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                대기 정보 초기화 (현재 대기 중인 목록)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="reset-attendance"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={resetOptions.attendance}
                                onChange={(e) => setResetOptions({ ...resetOptions, attendance: e.target.checked })}
                            />
                            <Label htmlFor="reset-attendance" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                출석 정보 초기화 (지난 대기/마감 이력)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="reset-members"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={resetOptions.members}
                                onChange={(e) => setResetOptions({ ...resetOptions, members: e.target.checked })}
                            />
                            <Label htmlFor="reset-members" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                회원 정보 초기화 (등록된 회원 목록)
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetDialogOpen(false)}>취소</Button>
                        <Button variant="destructive" onClick={handleResetConfirm} disabled={isResetting}>
                            {isResetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            초기화 실행
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 rounded-full shrink-0">
                            <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">전체 매장</p>
                            <p className="text-base font-bold text-slate-900">{stores.length}</p>
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
                            <p className="text-xs font-medium text-slate-500">활성 매장</p>
                            <p className="text-base font-bold text-green-600">
                                {stores.filter(s => s.is_active).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-red-100 rounded-full shrink-0">
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">비활성 매장</p>
                            <p className="text-base font-bold text-red-600">
                                {stores.filter(s => !s.is_active).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-blue-100 rounded-full shrink-0">
                            <StoreIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">온라인 매장</p>
                            <p className="text-base font-bold text-blue-600">
                                {stores.filter(s => {
                                    if (!s.last_heartbeat) return false;
                                    const diffMinutes = (new Date().getTime() - new Date(s.last_heartbeat).getTime()) / (1000 * 60);
                                    return diffMinutes < 5;
                                }).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stores Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <StoreIcon className="w-5 h-5" />
                        매장 목록
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
                    ) : stores.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            등록된 매장이 없습니다.
                        </div>
                    ) : (
                        <div className="rounded-md border h-[600px] overflow-auto relative">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">매장 코드</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">매장명</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">프랜차이즈</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">상태</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">연결 상태</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">마지막 활동</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">생성일</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">설정</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stores.map((store) => {
                                        const heartbeatStatus = getHeartbeatStatus(store.last_heartbeat);
                                        return (
                                            <tr key={store.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 text-sm text-slate-900 font-medium">{store.id}</td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                        {store.code}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm font-medium text-slate-900">{store.name}</td>
                                                <td className="py-3 px-4 text-sm text-slate-600">
                                                    {store.franchise_name || '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {store.is_active ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                            활성
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                            비활성
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${heartbeatStatus.color} border border-opacity-20`}>
                                                        {heartbeatStatus.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-500">
                                                    {formatDate(store.last_heartbeat)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-500">
                                                    {formatDate(store.created_at)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                                            onClick={() => window.open(`/settings?store_id=${store.id}`, '_blank')}
                                                            title="매장 설정"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                                                            onClick={() => handleResetClick(store)}
                                                            title="데이터 초기화"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </Button>
                                                    </div>
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
