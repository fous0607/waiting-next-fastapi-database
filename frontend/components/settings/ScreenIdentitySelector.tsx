"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LocalSettingsManager } from '@/lib/printer/LocalSettingsManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Monitor, MonitorPlay, BarChart3, Smartphone, CheckCircle2, Loader2, LogOut, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

interface ScreenIdentitySelectorProps {
    category: keyof ScreenConfigs;
    onSelected: () => void;
}

const CATEGORY_LABELS: Record<keyof ScreenConfigs, string> = {
    management: '대기자관리',
    board: '대기현황판',
    reception_desk: '대기접수(데스크)',
    analytics: '데이터 분석',
    reception_mobile: '대기접수(모바일)',
};

const CATEGORY_ICONS: Record<keyof ScreenConfigs, any> = {
    management: LayoutDashboard,
    board: Monitor,
    reception_desk: MonitorPlay,
    analytics: BarChart3,
    reception_mobile: Smartphone,
};

export function ScreenIdentitySelector({ category, onSelected }: ScreenIdentitySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [instances, setInstances] = useState<ScreenInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [proxyUnits, setProxyUnits] = useState<any[]>([]);

    useEffect(() => {
        const checkIdentity = async () => {
            const settings = LocalSettingsManager.getSettings();

            // If already assigned, just return
            if (settings.assignedScreenId) {
                // Optional: Verify if it still exists in DB? For now, assume it does or user will reset.
                onSelected();
                return;
            }

            // Not assigned, fetch available instances for this category
            setIsLoading(true);
            try {
                const [storeRes, unitsRes] = await Promise.all([
                    api.get('/store'),
                    api.get('/printer-units')
                ]);

                const screenConfigsStr = storeRes.data.screen_configs;
                setProxyUnits(unitsRes.data.proxies || []);

                if (screenConfigsStr) {
                    const configs: ScreenConfigs = JSON.parse(screenConfigsStr);
                    const categoryInstances = configs[category] || [];

                    if (categoryInstances.length === 0) {
                        // No instances defined for this category yet - just proceed or show warning
                        // For now, if none defined, we don't block (legacy behavior)
                        onSelected();
                    } else if (categoryInstances.length === 1) {
                        // Only one instance - auto assign
                        handleSelect(categoryInstances[0], unitsRes.data.proxies);
                    } else {
                        // Multiple instances - show selector
                        setInstances(categoryInstances);
                        setIsOpen(true);
                    }
                } else {
                    // No configs at all
                    onSelected();
                }
            } catch (error) {
                console.error('Failed to check screen identity:', error);
                onSelected(); // Fallback
            } finally {
                setIsLoading(false);
            }
        };

        checkIdentity();
    }, [category, onSelected]);

    const handleSelect = (instance: ScreenInstance, proxies: any[]) => {
        const settings = LocalSettingsManager.getSettings();
        settings.assignedScreenId = instance.id;
        settings.assignedScreenName = instance.name;

        // If this instance has a dedicated proxy, update the local proxy setting
        if (instance.proxy_id) {
            const proxy = proxies.find(p => p.id.toString() === instance.proxy_id);
            if (proxy) {
                settings.proxyIp = proxy.ip;
                settings.proxyPort = proxy.port || 8000;
                settings.useLocalSettings = true;
            }
        }

        LocalSettingsManager.saveSettings(settings);
        setIsOpen(false);
        onSelected();
    };

    const handleReset = () => {
        const settings = LocalSettingsManager.getSettings();
        delete settings.assignedScreenId;
        delete settings.assignedScreenName;
        LocalSettingsManager.saveSettings(settings);
        window.location.reload();
    };

    if (isLoading) return null;

    const Icon = CATEGORY_ICONS[category];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) return; }}> {/* Disable manual close */}
            <DialogContent className="sm:max-w-md border-none shadow-2xl p-0 overflow-hidden rounded-3xl">
                <div className="bg-slate-900 p-8 text-white text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4">
                        <Icon className="w-8 h-8 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-black tracking-tight">화면 선택</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        현재 기기에서 사용하실 **{CATEGORY_LABELS[category]}** 화면을 선택해주세요.
                    </DialogDescription>
                </div>

                <div className="p-6 bg-slate-50 space-y-3">
                    {instances.map((inst) => (
                        <Button
                            key={inst.id}
                            variant="outline"
                            className="w-full h-16 justify-between px-6 bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-900 rounded-2xl group transition-all"
                            onClick={() => handleSelect(inst, proxyUnits)}
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-slate-900">{inst.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono italic">ID: {inst.id}</span>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-slate-200 group-hover:text-slate-900 transition-colors" />
                        </Button>
                    ))}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
                    <p className="text-[10px] text-slate-400">최초 1회 선택 시 자동으로 저장되어 다음 접속 시 바로 진입합니다.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Helper to reset identity (for debugging or user change)
export function IdentityStatus() {
    const [settings, setSettings] = useState<any>(null);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        setSettings(LocalSettingsManager.getSettings());
    }, []);

    if (!settings?.assignedScreenId) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>{settings.assignedScreenName}</span>
            <button
                onClick={() => setShowResetDialog(true)}
                className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors"
                title="초기화"
            >
                <LogOut className="w-3 h-3" />
            </button>

            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-red-500" />
                            기기 설정 초기화
                        </DialogTitle>
                        <DialogDescription>
                            현재 기기의 화면 설정을 초기화하려면 관리자 비밀번호를 입력해주세요.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Input
                            type="password"
                            placeholder="관리자 비밀번호"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleResetConfirm();
                                }
                            }}
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowResetDialog(false)}>
                            취소
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleResetConfirm}
                            disabled={!password || isVerifying}
                        >
                            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            초기화
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );

    async function handleResetConfirm() {
        if (!password) return;
        setIsVerifying(true);
        try {
            await api.post('/store/verify-password', null, { params: { password } });

            // Password correct
            LocalSettingsManager.clearSettings();
            window.location.reload();
        } catch (error) {
            console.error('Password verification failed:', error);
            // Assuming we have toast
            alert('비밀번호가 일치하지 않습니다.'); // Fallback if toast not available or configured
        } finally {
            setIsVerifying(false);
        }
    }

}
