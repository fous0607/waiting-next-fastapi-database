'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Megaphone,
    Settings,
    Building,
    Store,
    UserCog,
    Users,
    Activity,
    BarChart3,
    Home,
    LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ModeToggle } from '@/components/mode-toggle';

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('selected_store_id');
            document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = '/login';
        }
    };

    const navGroups = [
        {
            title: '대시보드',
            items: [
                {
                    title: '종합 현황',
                    icon: Home,
                    href: '/superadmin/dashboard',
                },
                {
                    title: '데이터 분석',
                    icon: BarChart3,
                    href: '/superadmin/analytics',
                },
            ],
        },
        {
            title: '매장 관리',
            items: [
                {
                    title: '프랜차이즈 관리',
                    icon: Building,
                    href: '/superadmin/franchises',
                },
                {
                    title: '매장 관리',
                    icon: Store,
                    href: '/superadmin/stores',
                },
            ],
        },
        {
            title: '운영 지원',
            items: [
                {
                    title: '사용자 관리',
                    icon: UserCog,
                    href: '/superadmin/users',
                },
                {
                    title: '회원 조회',
                    icon: Users,
                    href: '/superadmin/members',
                },
            ],
        },
        {
            title: '시스템',
            items: [
                {
                    title: '공지사항 관리',
                    icon: Megaphone,
                    href: '/superadmin/notices',
                },
                {
                    title: '프로그램 모니터링',
                    icon: Monitor,
                    href: '/superadmin/health',
                },
            ],
        },
    ];

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen z-50">
                {/* Header */}
                <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900">시스템 관리</h1>
                        <p className="text-xs text-slate-500">슈퍼어드민 전용</p>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <nav className="space-y-6">
                        {navGroups.map((group) => (
                            <div key={group.title}>
                                <h2 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    {group.title}
                                </h2>
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={cn(
                                                    'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                                                    isActive
                                                        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                )}
                                            >
                                                <item.icon
                                                    className={cn(
                                                        'w-4 h-4 transition-colors',
                                                        isActive
                                                            ? 'text-blue-600'
                                                            : 'text-slate-400 group-hover:text-slate-600'
                                                    )}
                                                />
                                                {item.title}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm">
                                SA
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Super Admin</p>
                                <p className="text-xs text-slate-500">System Administrator</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <ModeToggle />
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

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
