"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, LayoutDashboard, Monitor, MonitorPlay, BarChart3, Smartphone, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenInstance {
    id: string;
    name: string;
    proxy_id: string | null;
}

interface ScreenConfigs {
    management: ScreenInstance[];
    board: ScreenInstance[];
    reception_desk: ScreenInstance[];
    analytics: ScreenInstance[];
    reception_mobile: ScreenInstance[];
}

interface ProxyUnit {
    id: number;
    name: string;
    ip: string;
}

interface ScreenQuantitySettingsProps {
    value?: string; // JSON string
    onUpdate: (json: string) => void;
    proxyUnits: ProxyUnit[];
}

const CATEGORIES = [
    { id: 'management', name: '대기자관리', icon: LayoutDashboard },
    { id: 'board', name: '대기현황판', icon: Monitor },
    { id: 'reception_desk', name: '대기접수(데스크)', icon: MonitorPlay },
    { id: 'analytics', name: '데이터 분석', icon: BarChart3 },
    { id: 'reception_mobile', name: '대기접수(모바일)', icon: Smartphone },
];

export function ScreenQuantitySettings({ value, onUpdate, proxyUnits }: ScreenQuantitySettingsProps) {
    const [configs, setConfigs] = useState<ScreenConfigs>({
        management: [],
        board: [],
        reception_desk: [],
        analytics: [],
        reception_mobile: [],
    });

    useEffect(() => {
        if (value) {
            try {
                const parsed = JSON.parse(value);
                setConfigs(parsed);
            } catch (e) {
                console.error("Failed to parse screen_configs", e);
            }
        }
    }, [value]);

    const save = (newConfigs: ScreenConfigs) => {
        setConfigs(newConfigs);
        onUpdate(JSON.stringify(newConfigs));
    };

    const handleUpdateQuantity = (categoryId: string, delta: number) => {
        const catId = categoryId as keyof ScreenConfigs;
        const currentList = configs[catId] || [];
        const newCount = Math.max(0, currentList.length + delta);

        if (delta > 0) {
            // Add new instance
            const newItem: ScreenInstance = {
                id: `${catId}_${Date.now()}_${currentList.length}`,
                name: `${CATEGORIES.find(c => c.id === catId)?.name}${currentList.length + 1}`,
                proxy_id: null
            };
            save({ ...configs, [catId]: [...currentList, newItem] });
        } else if (delta < 0 && currentList.length > 0) {
            // Remove last instance
            save({ ...configs, [catId]: currentList.slice(0, -1) });
        }
    };

    const handleUpdateInstance = (categoryId: string, instanceId: string, updates: Partial<ScreenInstance>) => {
        const catId = categoryId as keyof ScreenConfigs;
        const newList = configs[catId].map(inst =>
            inst.id === instanceId ? { ...inst, ...updates } : inst
        );
        save({ ...configs, [catId]: newList });
    };

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    화면등록 수량 및 프록시 설정
                </CardTitle>
                <CardDescription>
                    각 카테고리별로 사용할 화면 수량을 설정하고 전용 프록시 서버를 할당합니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const list = configs[cat.id as keyof ScreenConfigs] || [];

                    return (
                        <div key={cat.id} className="space-y-4">
                            <div className="flex items-center justify-between bg-slate-100/50 p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <Icon className="w-5 h-5 text-slate-700" />
                                    </div>
                                    <span className="font-bold text-slate-800">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-white rounded-lg border shadow-sm p-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-red-500"
                                            onClick={() => handleUpdateQuantity(cat.id, -1)}
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>
                                        <div className="w-12 text-center font-bold text-sm">
                                            {list.length}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-primary"
                                            onClick={() => handleUpdateQuantity(cat.id, 1)}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">단위: 개</span>
                                </div>
                            </div>

                            {list.length > 0 && (
                                <div className="grid gap-3 pl-4 border-l-2 border-slate-100 ml-6">
                                    {list.map((inst, idx) => (
                                        <div key={inst.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-50 p-3 rounded-lg border border-slate-200 border-dashed animate-in fade-in slide-in-from-left-2">
                                            <div className="flex items-center gap-2 flex-1 w-full">
                                                <Label className="text-[10px] text-slate-400 font-mono whitespace-nowrap"># {idx + 1}</Label>
                                                <Input
                                                    value={inst.name}
                                                    onChange={(e) => handleUpdateInstance(cat.id, inst.id, { name: e.target.value })}
                                                    placeholder="명칭 입력"
                                                    className="h-9 text-xs bg-white"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 w-full">
                                                <Select
                                                    value={inst.proxy_id || 'none'}
                                                    onValueChange={(val) => handleUpdateInstance(cat.id, inst.id, { proxy_id: val === 'none' ? null : val })}
                                                >
                                                    <SelectTrigger className="h-9 text-xs bg-white">
                                                        <SelectValue placeholder="프록시(중계기) 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">프록시 없음 (기본값)</SelectItem>
                                                        {proxyUnits.map(pu => (
                                                            <SelectItem key={pu.id} value={pu.id.toString()}>{pu.name} ({pu.ip})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                onClick={() => {
                                                    const newList = list.filter(item => item.id !== inst.id);
                                                    save({ ...configs, [cat.id as keyof ScreenConfigs]: newList });
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {Object.values(configs).every(v => v.length === 0) && (
                    <div className="py-20 text-center space-y-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <div className="p-4 bg-white rounded-full inline-block shadow-sm">
                            <Monitor className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="text-slate-400 text-sm font-medium">등록된 화면이 없습니다. + 버튼을 눌러 추가하세요.</div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
