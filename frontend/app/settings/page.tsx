"use client";

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ClassManagement } from '@/components/settings/ClassManagement';
import AdvancedSettings from '@/components/settings/AdvancedSettings';
import { ScreenQuantityTab } from '@/components/settings/ScreenQuantityTab';
import { TicketFormatSettings } from '@/components/settings/TicketFormatSettings';
import { Settings2, Calendar, Shield, Monitor, ChevronLeft, FileText } from 'lucide-react';

function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [currentTab, setCurrentTab] = useState('general');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setCurrentTab(tab);
        }
    }, [searchParams]);

    const onNavClick = (value: string) => {
        setCurrentTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-52 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
                <div className="px-6 pt-10 pb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-900 -ml-2 mb-4 group h-8 px-2"
                        onClick={() => router.push('/manage')}
                    >
                        <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                        메인으로
                    </Button>
                    <h1 className="text-xl font-bold text-slate-900">환경설정</h1>
                    <p className="text-xs text-slate-500 mt-1">매장 및 시스템 관리</p>
                </div>

                <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
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
                            className={`w-full justify-start h-12 px-3 rounded-xl transition-all ${currentTab === 'screens' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => onNavClick('screens')}
                        >
                            <Monitor className={`w-5 h-5 mr-3 ${currentTab === 'screens' ? 'text-white' : 'text-slate-400'}`} />
                            화면등록 수량
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start h-12 px-3 rounded-xl transition-all ${currentTab === 'ticket' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            onClick={() => onNavClick('ticket')}
                        >
                            <FileText className={`w-5 h-5 mr-3 ${currentTab === 'ticket' ? 'text-white' : 'text-slate-400'}`} />
                            대기표 양식
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
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 overflow-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                {currentTab === 'general' && '기본 설정'}
                                {currentTab === 'screens' && '화면등록 수량'}
                                {currentTab === 'ticket' && '대기표 양식'}
                                {currentTab === 'class' && '클래스 관리'}
                                {currentTab === 'advanced' && '고급 설정'}
                            </h2>
                            {currentTab !== 'general' && (
                                <p className="text-muted-foreground mt-1">
                                    {currentTab === 'screens' && '서비스별 화면 수량과 전용 프록시 설정을 관리합니다.'}
                                    {currentTab === 'ticket' && '대기표 출력 항목과 하단 멘트를 설정합니다.'}
                                    {currentTab === 'class' && '수업 시간표와 공휴일 일정을 관리합니다.'}
                                    {currentTab === 'advanced' && '시스템 관리 및 데이터 백업을 수행합니다.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] p-6">
                        {currentTab === 'general' && <GeneralSettings />}
                        {currentTab === 'screens' && <ScreenQuantityTab />}
                        {currentTab === 'ticket' && <TicketFormatSettings />}
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
