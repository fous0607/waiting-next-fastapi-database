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
import { UserCog, Users, AlertCircle, Plus, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface User {
    id: number;
    username: string;
    role: string;
    franchise_id: number | null;
    store_id: number | null;
    franchise_name: string | null;
    store_name: string | null;
    is_active: boolean;
    last_login: string | null;
    created_at: string;
    updated_at: string;
    managed_stores?: { id: number; name: string }[];
}

interface FranchiseSimple {
    id: number;
    name: string;
}

interface StoreSimple {
    id: number;
    name: string;
}

const roleLabels: Record<string, string> = {
    system_admin: '시스템 관리자',
    franchise_admin: '프랜차이즈 관리자',
    franchise_manager: '중간 관리자',
    store_admin: '매장 관리자',
    store_reception: '대기접수 데스크',
    store_board: '대기현황판',
    store_owner: '매장 사장님',
};

const roleColors: Record<string, string> = {
    system_admin: 'bg-purple-100 text-purple-800',
    franchise_admin: 'bg-blue-100 text-blue-800',
    franchise_manager: 'bg-orange-100 text-orange-800',
    store_admin: 'bg-green-100 text-green-800',
    store_reception: 'bg-cyan-100 text-cyan-800',
    store_board: 'bg-indigo-100 text-indigo-800',
    store_owner: 'bg-rose-100 text-rose-800',
};

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Form State
    const [open, setOpen] = useState(false);
    const [franchises, setFranchises] = useState<FranchiseSimple[]>([]);
    const [storesForSelect, setStoresForSelect] = useState<StoreSimple[]>([]);
    const [createForm, setCreateForm] = useState({
        franchise_id: '',
        role: 'store_admin',
        username: '',
        password: '',
        store_id: '',
        managed_store_ids: [] as string[]
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchFranchises();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/system/users', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`사용자 목록을 불러오는데 실패했습니다: ${response.status}`);
            }

            const data = await response.json();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const fetchFranchises = async () => {
        try {
            const response = await fetch('/api/system/franchises', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setFranchises(data);
            }
        } catch (e) {
            console.error('Failed to load franchises', e);
        }
    };

    const fetchStoresForFranchise = async (franchiseId: string) => {
        try {
            const response = await fetch(`/api/system/franchises/${franchiseId}/stores`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setStoresForSelect(data);
            }
        } catch (e) {
            console.error('Failed to load stores', e);
            setStoresForSelect([]);
        }
    };

    const handleFranchiseChange = (val: string) => {
        setCreateForm(prev => ({ ...prev, franchise_id: val, store_id: '', managed_store_ids: [] }));
        fetchStoresForFranchise(val);
    };

    const handleCreate = async () => {
        if (!createForm.franchise_id || !createForm.username || !createForm.password || !createForm.role) {
            toast.error('모든 필수 항목을 입력해주세요.');
            return;
        }

        if (['store_admin', 'store_reception', 'store_board', 'store_owner'].includes(createForm.role) && !createForm.store_id) {
            toast.error('매장 관리자, 사장님 및 전용 단말기 계정은 매장을 선택해야 합니다.');
            return;
        }

        if (createForm.role === 'franchise_manager' && createForm.managed_store_ids.length === 0) {
            toast.error('중간 관리자는 하나 이상의 매장을 선택해야 합니다.');
            return;
        }

        try {
            setSubmitting(true);
            const payload: any = {
                username: createForm.username,
                password: createForm.password,
                role: createForm.role,
            };

            if (['store_admin', 'store_reception', 'store_board', 'store_owner'].includes(createForm.role)) {
                payload.store_id = parseInt(createForm.store_id);
            } else if (createForm.role === 'franchise_manager') {
                payload.managed_store_ids = createForm.managed_store_ids.map(id => parseInt(id));
            }

            const response = await fetch(`/api/system/franchises/${createForm.franchise_id}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || '사용자 생성 실패');
            }

            toast.success('사용자가 생성되었습니다.');
            setOpen(false);
            setCreateForm({
                franchise_id: '',
                role: 'store_admin',
                username: '',
                password: '',
                store_id: '',
                managed_store_ids: []
            });
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '생성 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    // Edit Form State
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        id: 0,
        username: '',
        role: '',
        franchise_id: '',
        store_id: '',
        is_active: true,
        managed_store_ids: [] as string[],
        password: '' // New password field
    });

    const handleEditClick = async (user: User) => {
        setEditForm({
            id: user.id,
            username: user.username,
            role: user.role,
            franchise_id: user.franchise_id ? user.franchise_id.toString() : '',
            store_id: user.store_id ? user.store_id.toString() : '',
            is_active: user.is_active,
            managed_store_ids: user.managed_stores ? user.managed_stores.map(s => s.id.toString()) : [],
            password: '' // Reset password
        });

        // If franchise is selected, fetch stores for it
        if (user.franchise_id) {
            await fetchStoresForFranchise(user.franchise_id.toString());
        } else {
            setStoresForSelect([]);
        }

        setEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        try {
            setSubmitting(true);

            const payload: any = {
                role: editForm.role,
                is_active: editForm.is_active
            };

            if (editForm.password) {
                payload.password = editForm.password;
            }

            // role에 따른 franchise_id, store_id 처리
            if (editForm.role === 'system_admin') {
                payload.franchise_id = null;
                payload.store_id = null;
            } else if (editForm.role === 'franchise_admin') {
                if (!editForm.franchise_id) {
                    toast.error('프랜차이즈를 선택해주세요.');
                    setSubmitting(false);
                    return;
                }
                payload.franchise_id = parseInt(editForm.franchise_id);
                payload.store_id = null;
            } else if (['store_admin', 'store_reception', 'store_board', 'store_owner'].includes(editForm.role)) {
                if (!editForm.franchise_id || !editForm.store_id) {
                    toast.error('프랜차이즈와 매장을 모두 선택해주세요.');
                    setSubmitting(false);
                    return;
                }
                payload.franchise_id = parseInt(editForm.franchise_id);
                payload.store_id = parseInt(editForm.store_id);
            } else if (editForm.role === 'franchise_manager') {
                if (!editForm.franchise_id) {
                    toast.error('프랜차이즈를 선택해주세요.');
                    setSubmitting(false);
                    return;
                }
                if (editForm.managed_store_ids.length === 0) {
                    toast.error('하나 이상의 매장을 선택해주세요.');
                    setSubmitting(false);
                    return;
                }
                payload.franchise_id = parseInt(editForm.franchise_id);
                payload.store_id = null;
                payload.managed_store_ids = editForm.managed_store_ids.map(id => parseInt(id));
            }

            const response = await fetch(`/api/system/users/${editForm.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || '사용자 정보 수정 실패');
            }

            toast.success('사용자 설정이 변경되었습니다.');
            setEditDialogOpen(false);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '수정 중 오류가 발생했습니다.');
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">사용자 관리</h2>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" />
                            사용자 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>새 사용자 등록</DialogTitle>
                            <DialogDescription>
                                프랜차이즈 또는 매장의 관리자를 등록합니다.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="franchise">프랜차이즈 (필수)</Label>
                                <Select
                                    value={createForm.franchise_id}
                                    onValueChange={handleFranchiseChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="프랜차이즈 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {franchises.map(f => (
                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="role">역할</Label>
                                <Select
                                    value={createForm.role}
                                    onValueChange={(val) => setCreateForm(prev => ({ ...prev, role: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="역할 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="franchise_admin">프랜차이즈 관리자</SelectItem>
                                        <SelectItem value="store_admin">매장 관리자</SelectItem>
                                        <SelectItem value="store_reception">대기접수 데스크</SelectItem>
                                        <SelectItem value="store_board">대기현황판</SelectItem>
                                        <SelectItem value="store_owner">매장 사장님</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {['store_admin', 'store_reception', 'store_board'].includes(createForm.role) && (
                                <div className="grid gap-2">
                                    <Label htmlFor="store">매장 (필수)</Label>
                                    <Select
                                        value={createForm.store_id}
                                        onValueChange={(val) => setCreateForm(prev => ({ ...prev, store_id: val }))}
                                        disabled={!createForm.franchise_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={!createForm.franchise_id ? "프랜차이즈를 먼저 선택하세요" : "매장 선택"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {storesForSelect.map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {createForm.role === 'franchise_manager' && (
                                <div className="grid gap-2">
                                    <Label>관리할 매장 선택 (다중 선택 가능)</Label>
                                    {!createForm.franchise_id ? (
                                        <p className="text-sm text-slate-500">프랜차이즈를 먼저 선택하세요.</p>
                                    ) : storesForSelect.length === 0 ? (
                                        <p className="text-sm text-slate-500">선택 가능한 매장이 없습니다.</p>
                                    ) : (
                                        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                                            {storesForSelect.map(s => (
                                                <div key={s.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`create-store-${s.id}`}
                                                        checked={createForm.managed_store_ids.includes(s.id.toString())}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setCreateForm(prev => {
                                                                const current = prev.managed_store_ids;
                                                                if (checked) return { ...prev, managed_store_ids: [...current, s.id.toString()] };
                                                                else return { ...prev, managed_store_ids: current.filter(id => id !== s.id.toString()) };
                                                            });
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <Label htmlFor={`create-store-${s.id}`} className="font-normal cursor-pointer">
                                                        {s.name}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="username">아이디 (ID)</Label>
                                <Input
                                    id="username"
                                    value={createForm.username}
                                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">비밀번호</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
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

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>사용자 설정 수정</DialogTitle>
                        <DialogDescription>
                            사용자({editForm.username})의 설정을 변경합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-role">역할</Label>
                            <Select
                                value={editForm.role}
                                onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="역할 선택" />
                                </SelectTrigger>
                                <SelectContent className="z-[10000]">
                                    <SelectItem value="system_admin">시스템 관리자</SelectItem>
                                    <SelectItem value="franchise_admin">프랜차이즈 관리자</SelectItem>
                                    <SelectItem value="franchise_manager">중간 관리자</SelectItem>
                                    <SelectItem value="store_admin">매장 매니저</SelectItem>
                                    <SelectItem value="store_reception">대기접수 데스크</SelectItem>
                                    <SelectItem value="store_board">대기현황판</SelectItem>
                                    <SelectItem value="store_owner">매장 사장님</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Franchise Selection (Visible for Franchise Admin & Store roles & Franchise Manager) */}
                        {(editForm.role === 'franchise_admin' || ['store_admin', 'store_reception', 'store_board'].includes(editForm.role) || editForm.role === 'franchise_manager') && (
                            <div className="grid gap-2">
                                <Label htmlFor="edit-franchise">프랜차이즈</Label>
                                <Select
                                    value={editForm.franchise_id}
                                    onValueChange={(value) => {
                                        setEditForm({ ...editForm, franchise_id: value, store_id: '', managed_store_ids: [] });
                                        fetchStoresForFranchise(value);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="프랜차이즈 선택" />
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
                        )}

                        {/* Store Selection (Visible for Store roles) */}
                        {['store_admin', 'store_reception', 'store_board', 'store_owner'].includes(editForm.role) && (
                            <div className="grid gap-2">
                                <Label htmlFor="edit-store">매장</Label>
                                <Select
                                    value={editForm.store_id}
                                    onValueChange={(value) => setEditForm({ ...editForm, store_id: value })}
                                    disabled={!editForm.franchise_id}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="매장 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[10000]">
                                        {storesForSelect.map((s) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Multi Store Selection (Visible only for Franchise Manager) */}
                        {editForm.role === 'franchise_manager' && (
                            <div className="grid gap-2">
                                <Label>관리할 매장 선택 (다중 선택 가능)</Label>
                                {!editForm.franchise_id ? (
                                    <p className="text-sm text-slate-500">프랜차이즈를 먼저 선택하세요.</p>
                                ) : storesForSelect.length === 0 ? (
                                    <p className="text-sm text-slate-500">선택 가능한 매장이 없습니다.</p>
                                ) : (
                                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                                        {storesForSelect.map(s => (
                                            <div key={s.id} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`edit-store-${s.id}`}
                                                    checked={editForm.managed_store_ids.includes(s.id.toString())}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setEditForm(prev => {
                                                            const current = prev.managed_store_ids;
                                                            if (checked) return { ...prev, managed_store_ids: [...current, s.id.toString()] };
                                                            else return { ...prev, managed_store_ids: current.filter(id => id !== s.id.toString()) };
                                                        });
                                                    }}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <Label htmlFor={`edit-store-${s.id}`} className="font-normal cursor-pointer">
                                                    {s.name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="edit-password">새 비밀번호 (변경시에만 입력)</Label>
                            <Input
                                id="edit-password"
                                type="password"
                                value={editForm.password}
                                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                placeholder="비밀번호 변경시에만 입력하세요"
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="edit-is_active"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={editForm.is_active}
                                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            />
                            <Label htmlFor="edit-is_active">계정 활성화</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>취소</Button>
                        <Button onClick={handleUpdate} disabled={submitting}>
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            저장하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 rounded-full shrink-0">
                            <Users className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">전체 사용자</p>
                            <p className="text-base font-bold text-slate-900">{users.length}</p>
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
                            <p className="text-xs font-medium text-slate-500">활성 사용자</p>
                            <p className="text-base font-bold text-green-600">
                                {users.filter(u => u.is_active).length}
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
                            <p className="text-xs font-medium text-slate-500">비활성 사용자</p>
                            <p className="text-base font-bold text-red-600">
                                {users.filter(u => !u.is_active).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="px-4 py-1 flex items-center gap-2">
                        <div className="p-1 bg-purple-100 rounded-full shrink-0">
                            <UserCog className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xs font-medium text-slate-500">시스템 관리자</p>
                            <p className="text-base font-bold text-purple-600">
                                {users.filter(u => u.role === 'system_admin').length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserCog className="w-5 h-5" />
                        사용자 목록
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
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            등록된 사용자가 없습니다.
                        </div>
                    ) : (
                        <div className="rounded-md border h-[600px] overflow-auto relative">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">사용자명</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">역할</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">프랜차이즈</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">매장</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">상태</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">마지막 로그인</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">생성일</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">설정</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-sm text-slate-900">{user.id}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-slate-900">{user.username}</td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || 'bg-gray-100 text-gray-800'}`}>
                                                    {roleLabels[user.role] || user.role}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {user.franchise_name || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {user.store_name || '-'}
                                            </td>
                                            <td className="py-3 px-4">
                                                {user.is_active ? (
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
                                                {formatDate(user.last_login)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-500">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                                    onClick={() => handleEditClick(user)}
                                                    title="사용자 설정"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </Button>
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

