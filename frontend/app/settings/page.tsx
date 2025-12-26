"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ClassManagement } from '@/components/settings/ClassManagement';
import AdvancedSettings from '@/components/settings/AdvancedSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Loader2, Settings, Settings2, Calendar, Shield } from 'lucide-react';
import { GlobalLoader } from "@/components/ui/GlobalLoader";

function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [storeName, setStoreName] = useState('');

    // Get active tab from URL or default to 'general'
    const activeTab = searchParams.get('tab') || 'general';

    // Internal state for immediate UI feedback
    const [currentTab, setCurrentTab] = useState(activeTab);

    // Sync state when URL changes (popstate or initial load)
    useEffect(() => {
        setCurrentTab(activeTab);
    }, [activeTab]);

    // Load store name from API (Network First)
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStoreInfo = async () => {
            // Check for store_id in URL (Superadmin view)
            const storeIdParam = searchParams.get('store_id');
            if (storeIdParam) {
                console.log(`[Settings] Switching context to store_id=${storeIdParam}`);
                localStorage.setItem('selected_store_id', storeIdParam);
            }

            // 1. Try localStorage for immediate feedback
            const localName = localStorage.getItem('selected_store_name');
            if (localName) setStoreName(localName);

            try {
                // 2. Fetch fresh data from API
                // Note: The API interceptor will read 'selected_store_id' from localStorage which was just updated above
                const { data } = await import('@/lib/api').then(m => m.default.get('/store'));
                const storeData = Array.isArray(data) ? data[0] : data;

                const remoteName = storeData?.store_name || storeData?.name;
                if (remoteName) {
                    setStoreName(remoteName);
                    // Update localStorage for future use
                    localStorage.setItem('selected_store_name', remoteName);
                }
            } catch (error) {
                console.error("Failed to fetch store info:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStoreInfo();
    }, [searchParams]);

    const handleTabChange = (value: string) => {
        // Update URL without triggering router navigation (prevent redirects)
        const newUrl = `${pathname}?tab=${value}`;
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    };

    const onNavClick = (value: string) => {
        setCurrentTab(value);
        handleTabChange(value);
    };

    if (isLoading && !storeName) {
        return <GlobalLoader message="설정 로딩 중..." />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-52 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    <Button
                        variant="ghost"
                        className="mb-8 -ml-3 text-slate-500 hover:text-slate-900 w-full justify-start"
                        onClick={() => router.push('/')}
                    >
                        <Home className="w-5 h-5 mr-2" />
                        메인으로
                    </Button>

                    <div className="flex items-center gap-3 mb-10 px-1">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Settings className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 tracking-tight">매장 설정</h1>
                            <p className="text-[11px] text-slate-500 font-medium">관리자 패널</p>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        <Button
                            variant="ghost"
                            className={`w-full justify-start h-12 px-3 rounded-xl transition-all ${currentTab === 'general' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => onNavClick('general')}
                        >
                            <Settings2 className={`w-5 h-5 mr-3 ${currentTab === 'general' ? 'text-white' : 'text-slate-400'}`} />
                            기본 설정
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start h-12 px-3 rounded-xl transition-all ${currentTab === 'class' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => onNavClick('class')}
                        >
                            <Calendar className={`w-5 h-5 mr-3 ${currentTab === 'class' ? 'text-white' : 'text-slate-400'}`} />
                            클래스 관리
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start h-12 px-3 rounded-xl transition-all ${currentTab === 'advanced' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => onNavClick('advanced')}
                        >
                            <Shield className={`w-5 h-5 mr-3 ${currentTab === 'advanced' ? 'text-white' : 'text-slate-400'}`} />
                            고급 설정
                        </Button>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-600">
                                {storeName ? storeName.charAt(0) : 'S'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{storeName || 'Store'}</p>
                            <p className="text-[10px] text-slate-400 truncate">Settings</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                {currentTab === 'general' && '기본 설정'}
                                {currentTab === 'class' && '클래스 관리'}
                                {currentTab === 'advanced' && '고급 설정'}
                            </h2>
                            {currentTab !== 'general' && (
                                <p className="text-muted-foreground mt-1">
                                    {currentTab === 'class' && '수업 시간표와 공휴일 일정을 관리합니다.'}
                                    {currentTab === 'advanced' && '시스템 관리 및 데이터 백업을 수행합니다.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] p-6">
                        {currentTab === 'general' && <GeneralSettings />}
                        {currentTab === 'class' && <ClassManagement />}
                        {currentTab === 'advanced' && <AdvancedSettings />}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="p-10">로딩 중...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
