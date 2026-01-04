import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useWaitingStore } from '@/lib/store/useWaitingStore';
import { Printer, FileText, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TicketFormatConfig {
    show_store_name: boolean;
    store_name_size: string;
    show_waiting_number: boolean;
    waiting_number_size: string;
    show_date: boolean;
    date_size: string;
    show_person_count: boolean;
    person_count_size: string;
    show_teams_ahead: boolean;
    teams_ahead_size: string;
    show_waiting_order: boolean;
    waiting_order_size: string;
    cutting_margin: number;
}

const SIZE_OPTIONS = [
    { value: 'small', label: '작게 (Small)' },
    { value: 'medium', label: '중간 (Medium)' },
    { value: 'large', label: '크게 (Large)' },
    { value: 'huge', label: '더 크게 (Huge)' },
];

export function TicketFormatSettings() {
    const { storeSettings, fetchStoreStatus } = useWaitingStore();
    const [isLoading, setIsLoading] = useState(false);

    const [config, setConfig] = useState<TicketFormatConfig>({
        show_store_name: true,
        store_name_size: 'large',
        show_waiting_number: true,
        waiting_number_size: 'huge',
        show_date: true,
        date_size: 'small',
        show_person_count: true,
        person_count_size: 'medium',
        show_teams_ahead: true,
        teams_ahead_size: 'medium',
        show_waiting_order: true,
        waiting_order_size: 'medium',
        cutting_margin: 15,
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
        setConfig((prev) => ({ ...prev, [key]: !prev[key as keyof TicketFormatConfig] }));
    };

    const handleSizeChange = (key: keyof TicketFormatConfig, value: string) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await api.put('/store', {
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

    // Helper to map size to Tailwind class for Preview
    const getSizeClass = (size: string) => {
        switch (size) {
            case 'small': return 'text-xs'; // ~12px
            case 'medium': return 'text-base font-bold'; // ~16px
            case 'large': return 'text-2xl font-black'; // ~24px
            case 'huge': return 'text-4xl font-black'; // ~36px
            default: return 'text-base';
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
                                표시 항목 및 글자 크기
                            </CardTitle>
                            <CardDescription>
                                대기표에 표시할 항목과 글자 크기를 설정하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Store Name */}
                            {/* Store Name */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_store_name" className="text-sm font-medium min-w-[60px]">매장명</Label>
                                    <Select
                                        value={config.store_name_size}
                                        onValueChange={(v) => handleSizeChange('store_name_size', v)}
                                        disabled={!config.show_store_name}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Switch
                                    id="show_store_name"
                                    checked={config.show_store_name}
                                    onCheckedChange={() => handleToggle('show_store_name')}
                                />
                            </div>

                            {/* Waiting Number */}
                            {/* Waiting Number */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_waiting_number" className="text-sm font-medium min-w-[60px]">대기번호</Label>
                                    <Select
                                        value={config.waiting_number_size}
                                        onValueChange={(v) => handleSizeChange('waiting_number_size', v)}
                                        disabled={!config.show_waiting_number}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Switch
                                    id="show_waiting_number"
                                    checked={config.show_waiting_number}
                                    onCheckedChange={() => handleToggle('show_waiting_number')}
                                />
                            </div>

                            {/* Date */}
                            {/* Date */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_date" className="text-sm font-medium min-w-[60px]">접수 일시</Label>
                                    <Select
                                        value={config.date_size}
                                        onValueChange={(v) => handleSizeChange('date_size', v)}
                                        disabled={!config.show_date}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Switch
                                    id="show_date"
                                    checked={config.show_date}
                                    onCheckedChange={() => handleToggle('show_date')}
                                />
                            </div>

                            {/* Person Count */}
                            {/* Person Count */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_person_count" className="text-sm font-medium min-w-[60px]">인원수</Label>
                                    <Select
                                        value={config.person_count_size}
                                        onValueChange={(v) => handleSizeChange('person_count_size', v)}
                                        disabled={!config.show_person_count}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Switch
                                    id="show_person_count"
                                    checked={config.show_person_count}
                                    onCheckedChange={() => handleToggle('show_person_count')}
                                />
                            </div>

                            <Separator />

                            {/* Teams Ahead */}
                            {/* Teams Ahead */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_teams_ahead" className="text-sm font-medium min-w-[60px]">내 앞 대기</Label>
                                    <Select
                                        value={config.teams_ahead_size}
                                        onValueChange={(v) => handleSizeChange('teams_ahead_size', v)}
                                        disabled={!config.show_teams_ahead}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Switch
                                    id="show_teams_ahead"
                                    checked={config.show_teams_ahead}
                                    onCheckedChange={() => handleToggle('show_teams_ahead')}
                                />
                            </div>

                            {/* Waiting Order */}
                            {/* Waiting Order */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="show_waiting_order" className="text-sm font-medium min-w-[60px]">입장 순서</Label>
                                    <Select
                                        value={config.waiting_order_size}
                                        onValueChange={(v) => handleSizeChange('waiting_order_size', v)}
                                        disabled={!config.show_waiting_order}
                                    >
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SIZE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
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
                                대기표 하단에 들어갈 문구를 입력하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="예: 감사합니다."
                                value={customFooter}
                                onChange={(e) => setCustomFooter(e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <Button onClick={handleSave} disabled={isLoading} className="w-full">
                        {isLoading ? '저장 중...' : '설정 저장'}
                    </Button>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Printer className="w-5 h-5" />
                                프랜터/절취선 설정
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label>절취선 여백 조정 (현재: {config.cutting_margin || 15}줄)</Label>
                                <Slider
                                    defaultValue={[config.cutting_margin || 15]}
                                    value={[config.cutting_margin || 15]}
                                    max={30}
                                    step={1}
                                    onValueChange={(vals) => setConfig(prev => ({ ...prev, cutting_margin: vals[0] }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    컷팅 위치가 QR코드나 하단 멘트를 자른다면 값을 늘려주세요.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview Overhaul */}
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500">
                                실제 출력 미리보기
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex justify-center py-8">
                            <div className="w-[300px] bg-white shadow-lg border border-slate-200 px-4 py-8 font-mono text-slate-900 leading-tight box-border relative">

                                {/* Store Name (Center) */}
                                {config.show_store_name && (
                                    <div className={`text-center mb-4 ${getSizeClass(config.store_name_size)}`}>
                                        {storeSettings?.store_name || '매장명'}
                                    </div>
                                )}

                                <div className="border-b border-dashed border-slate-300 mb-4 mx-2"></div>

                                {/* Waiting Number (Center) */}
                                {config.show_waiting_number && (
                                    <div className="text-center mb-4">
                                        <div className="text-sm text-slate-500 mb-1">대기번호</div>
                                        <div className={`${getSizeClass(config.waiting_number_size)}`}>1</div>
                                    </div>
                                )}

                                {/* Date & People (Separate Lines) */}
                                <div className="mb-4 px-2 space-y-1">
                                    {config.show_date && (
                                        <div className={`text-left ${getSizeClass(config.date_size)}`}>
                                            2026. 1. 4. 오전 3:54:38
                                        </div>
                                    )}
                                    {config.show_person_count && (
                                        <div className={`text-right ${getSizeClass(config.person_count_size)}`}>
                                            인원: 성인 1명, 어린이 1명
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-dashed border-slate-300 mb-4 mx-2"></div>

                                {/* Teams & Order (Center) */}
                                <div className="text-center space-y-2 mb-6">
                                    {config.show_teams_ahead && (
                                        <div className={`${getSizeClass(config.teams_ahead_size)}`}>
                                            내 앞 대기: 0팀
                                        </div>
                                    )}
                                    {config.show_waiting_order && (
                                        <div className={`${getSizeClass(config.waiting_order_size)}`}>
                                            입장 순서: 1번째
                                        </div>
                                    )}
                                </div>

                                {/* QR Code (Center) */}
                                <div className="flex justify-center mb-4">
                                    <div className="bg-slate-100 p-1">
                                        {/* Mock QR */}
                                        <div className="w-24 h-24 border-2 border-slate-800 flex items-center justify-center bg-white">
                                            <div className="w-20 h-20 bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Example')] bg-cover opacity-80"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer (Center) */}
                                {customFooter && (
                                    <div className="text-center mt-4">
                                        <div className="text-base font-medium whitespace-pre-wrap">
                                            {customFooter}
                                        </div>
                                    </div>
                                )}

                                {/* Paper Feed / Cut Line */}
                                <div
                                    style={{ height: `${(config.cutting_margin || 15) * 5}px` }}
                                    className="w-full mt-4 transition-all duration-300 relative bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_50%,#f1f5f9_50%,#f1f5f9_75%,transparent_75%,transparent)] bg-[length:10px_10px]"
                                >
                                    <div className="absolute top-1/2 left-0 right-0 text-center text-[10px] text-slate-400 font-mono -translate-y-1/2 bg-white/50 backdrop-blur-[1px] inline-block mx-auto w-max px-2 rounded">
                                        Paper Feed ({config.cutting_margin || 15} lines)
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 border-b-2 border-dashed border-red-400 flex justify-center z-10 translate-y-[1px]">
                                        <div className="bg-red-50 px-3 py-0.5 text-red-600 text-[10px] -mb-2.5 flex items-center gap-1 font-bold border border-red-200 rounded-full shadow-sm">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="6" cy="6" r="3" />
                                                <circle cx="6" cy="18" r="3" />
                                                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                                                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                                                <line x1="8.12" y1="8.12" x2="12" y2="12" />
                                            </svg>
                                            CUT LINE
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
