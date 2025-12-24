'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Shield, Monitor, Smartphone, Power, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface Connection {
    id: string;
    role: string;
    ip: string;
    user_agent: string;
    connected_at: string;
}

interface Store {
    id: number;
    name: string;
    code: string;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
    stores: Store[];
}

export default function HealthPage() {
    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [sseData, setSseData] = useState<Record<string, Connection[]>>({});
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const loadData = async () => {
        try {
            // Fetch franchises with stores
            const franchiseRes = await api.get('/system/franchises?include_stores=true');
            setFranchises(franchiseRes.data);

            // Fetch SSE status
            const sseRes = await api.get('/system/sse/status');
            setSseData(sseRes.data);

            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to load monitoring data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000); // Auto-refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin':
                return <Shield className="w-4 h-4" />;
            case 'board':
                return <Monitor className="w-4 h-4" />;
            case 'reception':
                return <Smartphone className="w-4 h-4" />;
            default:
                return <Activity className="w-4 h-4" />;
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin':
                return '관리자';
            case 'board':
                return '현황판';
            case 'reception':
                return '접수대';
            default:
                return role;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'board':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'reception':
                return 'bg-green-100 text-green-700 border-green-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleDisconnect = async (storeId: number, connectionId: string) => {
        if (!confirm('해당 기기의 연결을 강제로 해제하시겠습니까?\n기기는 즉시 재연결을 시도하게 됩니다.')) {
            return;
        }

        try {
            await api.post(`/system/sse/disconnect/${connectionId}?store_id=${storeId}`);
            loadData(); // Refresh data
        } catch (error) {
            console.error('Failed to disconnect:', error);
            alert('연결 해제에 실패했습니다.');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">프로그램 모니터링</h2>
                </div>
                <Card>
                    <CardContent className="py-20">
                        <div className="text-center text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                            <p>연결 상태를 불러오는 중입니다...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">프로그램 모니터링</h2>
                    <p className="text-slate-500 mt-1">전체 매장의 실시간 통신(SSE) 연결 상태를 확인합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                        마지막 업데이트: {lastUpdate.toLocaleTimeString()}
                    </span>
                    <Button onClick={loadData} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        새로고침
                    </Button>
                </div>
            </div>

            {/* Franchise Groups */}
            <div className="space-y-6">
                {franchises.length === 0 ? (
                    <Card>
                        <CardContent className="py-20">
                            <div className="text-center text-slate-400">
                                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>등록된 프랜차이즈가 없습니다.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    franchises.map((franchise) => {
                        const stores = franchise.stores || [];
                        if (stores.length === 0) return null;

                        return (
                            <Card key={franchise.id} className="overflow-hidden">
                                <CardHeader className="bg-slate-50 border-b">
                                    <CardTitle className="flex items-center gap-3">
                                        <Building2 className="w-5 h-5 text-blue-600" />
                                        <span>{franchise.name}</span>
                                        <Badge variant="secondary" className="ml-auto">
                                            {stores.length}개 매장
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {stores.map((store) => {
                                            const connections = sseData[store.id] || [];
                                            const isActive = connections.length > 0;

                                            return (
                                                <Card
                                                    key={store.id}
                                                    className={`transition-all ${isActive
                                                            ? 'border-blue-200 bg-blue-50/30'
                                                            : 'border-slate-200 bg-slate-50/50'
                                                        }`}
                                                >
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-base font-semibold">
                                                                {store.name}
                                                            </CardTitle>
                                                            {isActive && (
                                                                <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                                                                    연결됨
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        {connections.length === 0 ? (
                                                            <div className="text-center py-4 text-sm text-slate-400 bg-slate-100 rounded-lg">
                                                                연결된 기기 없음
                                                            </div>
                                                        ) : (
                                                            connections.map((conn) => (
                                                                <div
                                                                    key={conn.id}
                                                                    className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group"
                                                                >
                                                                    <div
                                                                        className={`p-2 rounded-lg ${getRoleColor(
                                                                            conn.role
                                                                        )}`}
                                                                    >
                                                                        {getRoleIcon(conn.role)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-sm text-slate-900">
                                                                            {getRoleLabel(conn.role)}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 truncate">
                                                                            {conn.ip} •{' '}
                                                                            {new Date(
                                                                                conn.connected_at
                                                                            ).toLocaleTimeString([], {
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                        onClick={() =>
                                                                            handleDisconnect(store.id, conn.id)
                                                                        }
                                                                        title="연결 해제"
                                                                    >
                                                                        <Power className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
