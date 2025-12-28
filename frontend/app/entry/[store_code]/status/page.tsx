'use client';

import { useState, useEffect, Suspense, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

function StatusContent({ storeCode }: { storeCode: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState(searchParams.get('phone') || '');
    const [statusData, setStatusData] = useState<any>(null);
    const [searched, setSearched] = useState(false);

    const checkStatus = async (phoneNumber: string) => {
        if (!phoneNumber || phoneNumber.length < 10) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/public/waiting/${storeCode}/status`, {
                params: { phone: phoneNumber }
            });
            setStatusData(data);
            setSearched(true);
        } catch (error) {
            toast.error('대기 정보를 찾을 수 없습니다.');
            setStatusData(null);
            setSearched(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initialPhone = searchParams.get('phone');
        if (initialPhone) {
            checkStatus(initialPhone);
        }
    }, [searchParams]);

    if (searched && statusData && statusData.found) {
        return (
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="text-center bg-primary/5 pb-8">
                    <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <span className="text-3xl font-bold text-green-600">{statusData.waiting_number}</span>
                    </div>
                    <CardTitle className="text-2xl">{statusData.store_name}</CardTitle>
                    <CardDescription>
                        {statusData.name}님의 대기 현황입니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">내 앞 대기</div>
                            <div className="text-2xl font-bold text-slate-800">{statusData.ahead_count}팀</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">신청 교시</div>
                            <div className="text-xl font-bold text-slate-800">{statusData.class_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">{statusData.class_order}번째</div>
                        </div>
                    </div>

                    <Button
                        onClick={() => checkStatus(phone)}
                        variant="outline"
                        className="w-full h-12"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        새로고침
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => router.push(`/entry/${storeCode}`)}
                    >
                        처음으로 돌아가기
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
                <CardTitle className="text-xl">대기 현황 조회</CardTitle>
                <CardDescription>
                    신청하신 휴대폰 번호를 입력해주세요.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="01012345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                        className="text-lg h-12"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') checkStatus(phone);
                        }}
                    />
                </div>
                <Button
                    onClick={() => checkStatus(phone)}
                    className="w-full h-12 text-lg"
                    disabled={loading || phone.length < 10}
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '조회하기'}
                </Button>

                {searched && !statusData?.found && (
                    <div className="text-center text-red-500 py-4 bg-red-50 rounded-lg">
                        대기 내역을 찾을 수 없습니다.
                    </div>
                )}

                <div className="text-center mt-4">
                    <Button variant="link" onClick={() => router.push(`/entry/${storeCode}`)}>
                        대기 등록하러 가기
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function StatusPage({ params }: { params: Promise<{ store_code: string }> }) {
    const { store_code } = use(params);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin" /></div>}>
                <StatusContent storeCode={store_code} />
            </Suspense>
        </div>
    );
}
