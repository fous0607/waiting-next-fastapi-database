"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenQuantitySettings } from './ScreenQuantitySettings';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

export function ScreenQuantityTab() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [screenConfigs, setScreenConfigs] = useState<string | null>(null);
    const [proxyUnits, setProxyUnits] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [settingsRes, unitsRes] = await Promise.all([
                    api.get('/store'),
                    api.get('/printer-units')
                ]);
                setScreenConfigs(settingsRes.data.screen_configs);
                setProxyUnits(unitsRes.data.proxies);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('데이터를 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.put('/store', { screen_configs: screenConfigs });
            toast.success('화면 구성 설정이 저장되었습니다.');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ScreenQuantitySettings
                value={screenConfigs || ''}
                onUpdate={setScreenConfigs}
                proxyUnits={proxyUnits}
            />

            <div className="flex justify-end pt-6 border-t">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-slate-900 text-white hover:bg-slate-800 h-11 px-8 rounded-xl shadow-lg shadow-slate-200 gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    설정 저장하기
                </Button>
            </div>
        </div>
    );
}
