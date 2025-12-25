'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    BarChart3,
    Search,
    ChevronRight,
    Users,
    ChevronDown,
    CalendarCheck,
    Trophy,
    UserX,
    LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

// ... imports

import { useWaitingStore } from '@/lib/store/useWaitingStore';

function AdminSidebar() {
    const { reset } = useWaitingStore();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const viewParam = searchParams.get('view');

    const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(true);
    const [isStatsMenuOpen, setIsStatsMenuOpen] = useState(true);
    const [storeName, setStoreName] = useState('매장');
    const [username, setUsername] = useState('사용자');

    React.useEffect(() => {
        const fetchUserAndStore = async () => {
            try {
                const { data: user } = await api.get('/auth/me');
                setUsername(user.username || '사용자');

                const storeId = localStorage.getItem('selected_store_id');
                if (storeId) {
                    const { data: store } = await api.get(`/stores/${storeId}`);
                    setStoreName(store.name || '매장');
                }
            } catch (error) {
                console.error('Failed to fetch user/store info:', error);
            }
        };
        fetchUserAndStore();
    }, []);

    const handleLogout = async () => {
        try {
            // 1. 서버 로그아웃 호출 (서버에서 SSE 세션 강제 종료 수행)
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout failed on server:', error);
        } finally {
            // 2. 로컬 데이터 정리
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('selected_store_id');
            localStorage.removeItem('selected_store_name');
            localStorage.removeItem('selected_store_code');

            // Zustand 초기화
            reset();

            // 쿠키 삭제
            document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

            // 리다이렉트
            window.location.href = '/login';
        }
    };

    const statsSubItems = [
        {
            title: '기간별 조회',
            href: '/admin/stats?view=period',
            active: (pathname === '/admin' || pathname === '/admin/stats') && (!viewParam || viewParam === 'period'),
        },
        {
            title: '시간대별 조회',
            href: '/admin/stats?view=hourly',
            active: (pathname === '/admin' || pathname === '/admin/stats') && viewParam === 'hourly',
        }
    ];

    const memberSubItems = [
        {
            title: '회원 정보 조회',
            icon: Search,
            href: '/admin/members',
            active: pathname === '/admin/members',
        },
        {
            title: '상세 출석 조회',
            icon: CalendarCheck,
            href: '/admin/attendance',
            active: pathname === '/admin/attendance',
        },
        {
            title: '출석 순위 (TOP)',
            icon: Trophy,
            href: '/admin/ranking',
            active: pathname === '/admin/ranking',
        },
        {
            title: '미출석 회원 (이탈)',
            icon: UserX,
            href: '/admin/inactive',
            active: pathname === '/admin/inactive',
        },
        {
            title: '신규 회원 조회',
            icon: Users,
            href: '/admin/members/new',
            active: pathname === '/admin/members/new',
        },
        {
            title: '회원 일괄 등록',
            icon: Users,
            href: '/admin/members/bulk',
            active: pathname === '/admin/members/bulk',
        },
    ];

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
            <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-3 mb-10 px-1">
                    <div className="bg-orange-100 p-2 rounded-lg">
                        <BarChart3 className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900 tracking-tight">{storeName}</h1>
                        <p className="text-[11px] text-slate-500 font-medium">매장 관리</p>
                    </div>
                </div>


                <nav className="space-y-6">
                    {/* Stats Section */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsStatsMenuOpen(!isStatsMenuOpen)}
                            className={cn(
                                "flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 group",
                                isStatsMenuOpen
                                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <BarChart3 className={cn("w-4 h-4 mr-3 transition-colors", isStatsMenuOpen ? "text-white" : "text-slate-400")} />
                            매장 관리 (통계)
                            <ChevronRight className={cn("w-4 h-4 ml-auto transition-transform", isStatsMenuOpen ? "transform rotate-90 text-white" : "text-slate-400")} />
                        </button>

                        {isStatsMenuOpen && (
                            <div className="space-y-1 pl-2 mt-2">
                                {statsSubItems.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                                            item.active
                                                ? 'bg-orange-50 text-orange-900'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'w-1.5 h-1.5 rounded-full mr-3',
                                                item.active ? 'bg-orange-500' : 'bg-slate-300'
                                            )}
                                        />
                                        {item.title}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Member Analysis Section */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsMemberMenuOpen(!isMemberMenuOpen)}
                            className="flex items-center w-full px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-wider mb-2"
                        >
                            <Users className="w-3 h-3 mr-2" />
                            회원 분석
                            <ChevronDown
                                className={cn(
                                    'w-3 h-3 ml-auto transition-transform',
                                    isMemberMenuOpen ? 'transform rotate-180' : ''
                                )}
                            />
                        </button>

                        {isMemberMenuOpen && (
                            <div className="space-y-1 pl-2">
                                {memberSubItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                                            item.active
                                                ? 'bg-orange-50 text-orange-900'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'w-1.5 h-1.5 rounded-full mr-3',
                                                item.active ? 'bg-orange-500' : 'bg-slate-300'
                                            )}
                                        />
                                        {item.title}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white shadow-sm">
                                A
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{username}</p>
                                <p className="text-[10px] text-slate-500 truncate">매장 관리자</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={handleLogout}
                            title="로그아웃"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <React.Suspense fallback={<div className="w-64 bg-white border-r border-slate-200 h-screen sticky top-0" />}>
                <AdminSidebar />
            </React.Suspense>

            {/* Main Content */}
            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden">
                <div className="flex justify-end p-4">
                    <Link href="/">
                        <Button variant="outline" className="gap-2 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border-slate-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            메인 대시보드
                        </Button>
                    </Link>
                </div>
                <div className="px-8 pb-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
