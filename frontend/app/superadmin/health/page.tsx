'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

export default function HealthPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">시스템 헬스</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        시스템 상태
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-500">시스템 헬스 모니터링 기능은 곧 제공됩니다.</p>
                    <p className="text-sm text-slate-400 mt-2">
                        임시로 레거시 시스템을 사용하려면{' '}
                        <a href="/api/superadmin" className="text-blue-600 hover:underline">
                            여기를 클릭
                        </a>
                        하세요.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
