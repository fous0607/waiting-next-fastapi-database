import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useWaitingStore } from '@/lib/store/useWaitingStore';
import { Printer, FileText, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TicketFormatConfig {
    show_store_name: boolean;
    show_waiting_number: boolean;
    show_date: boolean;
    show_person_count: boolean;
    show_teams_ahead: boolean;
    show_waiting_order: boolean;
}

export function TicketFormatSettings() {
    const { storeSettings, fetchStoreStatus } = useWaitingStore();
    const [isLoading, setIsLoading] = useState(false);

    const [config, setConfig] = useState<TicketFormatConfig>({
        show_store_name: true,
        show_waiting_number: true,
        show_date: true,
        show_person_count: true,
        show_teams_ahead: true,
        show_waiting_order: true,
    });
    const [customFooter, setCustomFooter] = useState('');

    useEffect(() => {
        if (storeSettings) {
            if (storeSettings.ticket_format_config) {
                try {
                    const parsed = JSON.parse(storeSettings.ticket_format_config);
                    setConfig((prev) => ({ ...prev, ...parsed }));
                } catch (e) {
                    console.error('Failed to parse ticket format config', e);
                }
            }
            if (storeSettings.ticket_custom_footer) {
                setCustomFooter(storeSettings.ticket_custom_footer);
            }
        }
    }, [storeSettings]);

    const handleToggle = (key: keyof TicketFormatConfig) => {
        setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await api.put('/settings', {
                ticket_format_config: JSON.stringify(config),
                ticket_custom_footer: customFooter
            });
            await fetchStoreStatus();
            toast.success('대기표 양식이 저장되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('설정 저장 실패');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                표시 항목 설정
                            </CardTitle>
                            <CardDescription>
                                대기표에 표시할 항목을 선택하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_store_name">매장명 표시</Label>
                                <Switch
                                    id="show_store_name"
                                    checked={config.show_store_name}
                                    onCheckedChange={() => handleToggle('show_store_name')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_waiting_number">대기번호 표시 (크게)</Label>
                                <Switch
                                    id="show_waiting_number"
                                    checked={config.show_waiting_number}
                                    onCheckedChange={() => handleToggle('show_waiting_number')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_date">접수 일시 표시</Label>
                                <Switch
                                    id="show_date"
                                    checked={config.show_date}
                                    onCheckedChange={() => handleToggle('show_date')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_person_count">인원수 표시</Label>
                                <Switch
                                    id="show_person_count"
                                    checked={config.show_person_count}
                                    onCheckedChange={() => handleToggle('show_person_count')}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_teams_ahead">내 앞 대기팀 수 표시</Label>
                                <Switch
                                    id="show_teams_ahead"
                                    checked={config.show_teams_ahead}
                                    onCheckedChange={() => handleToggle('show_teams_ahead')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show_waiting_order">입장 순서 표시</Label>
                                <Switch
                                    id="show_waiting_order"
                                    checked={config.show_waiting_order}
                                    onCheckedChange={() => handleToggle('show_waiting_order')}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>하단 멘트 설정</CardTitle>
                            <CardDescription>
                                대기표 하단에 들어갈 문구를 입력하세요. (이모지 사용 가능)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Input
                                    placeholder="예: 편안하게 모시겠습니다 😃"
                                    value={customFooter}
                                    onChange={(e) => setCustomFooter(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    빈 칸으로 두면 출력되지 않습니다.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={handleSave} disabled={isLoading} className="w-full">
                        {isLoading ? '저장 중...' : '설정 저장'}
                    </Button>
                </div>

                {/* Preview */}
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500">
                            미리보기
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <div className="w-[300px] bg-white shadow-sm border border-slate-200 p-6 font-mono text-sm leading-relaxed text-slate-800">
                            {config.show_store_name && (
                                <div className="text-center font-bold text-lg mb-4 border-b pb-4 border-dashed border-slate-300">
                                    {storeSettings?.store_name || '매장명'}
                                </div>
                            )}

                            <div className="text-center space-y-2 mb-6">
                                <div className="text-slate-500">대기번호</div>
                                {config.show_waiting_number && (
                                    <div className="text-4xl font-black">27</div>
                                )}
                            </div>

                            <div className="space-y-1 mb-6 border-b pb-6 border-dashed border-slate-300">
                                {config.show_date && (
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>일시</span>
                                        <span>2024-01-04 12:30:45</span>
                                    </div>
                                )}
                                {config.show_person_count && (
                                    <div className="flex justify-between font-bold">
                                        <span>인원</span>
                                        <span>4명</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 mb-6 text-center">
                                {config.show_teams_ahead && (
                                    <div>내 앞 대기: <span className="font-bold">5팀</span></div>
                                )}
                                {config.show_waiting_order && (
                                    <div>입장 순서: <span className="font-bold">6번째</span></div>
                                )}
                            </div>

                            <div className="flex justify-center mb-6">
                                <div className="w-24 h-24 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                                    QR CODE
                                </div>
                            </div>

                            {customFooter && (
                                <div className="text-center pt-4 border-t border-dashed border-slate-300 font-medium whitespace-pre-wrap">
                                    {customFooter}
                                </div>
                            )}

                            <div className="h-4"></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
