'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Database, Calendar, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/api';

interface Store {
    id: number;
    name: string;
    code: string;
}

export default function AdvancedSettings() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedSourceStore, setSelectedSourceStore] = useState<string>('');
    const [selectedTargetStore, setSelectedTargetStore] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadStores();
    }, []);

    const loadStores = async () => {
        try {
            const response = await api.get('/store/all');
            setStores(response.data);
        } catch (error) {
            console.error('Failed to load stores:', error);
        }
    };

    const handleCloneSettings = async () => {
        if (!selectedSourceStore || !selectedTargetStore) {
            setMessage({ type: 'error', text: '원본 매장과 대상 매장을 선택해주세요.' });
            return;
        }

        if (selectedSourceStore === selectedTargetStore) {
            setMessage({ type: 'error', text: '원본 매장과 대상 매장이 같을 수 없습니다.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await api.post(`/store/${selectedTargetStore}/clone-settings`, {
                source_store_id: parseInt(selectedSourceStore)
            });
            setMessage({ type: 'success', text: '매장 설정이 성공적으로 복제되었습니다.' });
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.detail || '매장 설정 복제에 실패했습니다.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCloneClasses = async () => {
        if (!selectedSourceStore || !selectedTargetStore) {
            setMessage({ type: 'error', text: '원본 매장과 대상 매장을 선택해주세요.' });
            return;
        }

        if (selectedSourceStore === selectedTargetStore) {
            setMessage({ type: 'error', text: '원본 매장과 대상 매장이 같을 수 없습니다.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await api.post(`/store/${selectedTargetStore}/clone-classes`, {
                source_store_id: parseInt(selectedSourceStore)
            });
            setMessage({ type: 'success', text: '클래스가 성공적으로 복제되었습니다.' });
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.detail || '클래스 복제에 실패했습니다.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-none">
                <CardHeader className="px-0">
                    <CardTitle>고급 설정</CardTitle>
                    <CardDescription>시스템 관리 및 데이터 백업 이력을 확인합니다.</CardDescription>
                </CardHeader>
                <CardContent className="px-0 space-y-6">
                    {message && (
                        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{message.text}</AlertDescription>
                        </Alert>
                    )}

                    {/* Store Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="source-store">원본 매장 (복사할 매장)</Label>
                            <Select value={selectedSourceStore} onValueChange={setSelectedSourceStore}>
                                <SelectTrigger id="source-store">
                                    <SelectValue placeholder="매장을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map((store) => (
                                        <SelectItem key={store.id} value={store.id.toString()}>
                                            {store.name} ({store.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target-store">대상 매장 (붙여넣을 매장)</Label>
                            <Select value={selectedTargetStore} onValueChange={setSelectedTargetStore}>
                                <SelectTrigger id="target-store">
                                    <SelectValue placeholder="매장을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map((store) => (
                                        <SelectItem key={store.id} value={store.id.toString()}>
                                            {store.name} ({store.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Clone Settings Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-500" />
                                <CardTitle className="text-lg">매장 설정 복제</CardTitle>
                            </div>
                            <CardDescription>
                                원본 매장의 모든 설정을 대상 매장으로 복사합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    <p className="font-semibold mb-2">복제되는 항목:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>일반 설정 (매장명, 비밀번호 등)</li>
                                        <li>대기 관리 설정</li>
                                        <li>출석 횟수 표시 설정</li>
                                        <li>대기현황판 표시 설정</li>
                                        <li>테마 및 폰트 설정</li>
                                    </ul>
                                </div>
                                <Button
                                    onClick={handleCloneSettings}
                                    disabled={loading || !selectedSourceStore || !selectedTargetStore}
                                    className="w-full"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    매장 설정 복제
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Clone Classes Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-green-500" />
                                <CardTitle className="text-lg">클래스 복제</CardTitle>
                            </div>
                            <CardDescription>
                                원본 매장의 모든 클래스를 대상 매장으로 복사합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    <p className="font-semibold mb-2">복제되는 항목:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>평일/주말 클래스</li>
                                        <li>클래스 시간 및 정원</li>
                                        <li>클래스 타입 및 요일</li>
                                    </ul>
                                    <p className="mt-3 text-amber-600 font-medium">
                                        ⚠️ 대상 매장의 기존 클래스는 모두 삭제됩니다.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCloneClasses}
                                    disabled={loading || !selectedSourceStore || !selectedTargetStore}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    클래스 복제
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
}
