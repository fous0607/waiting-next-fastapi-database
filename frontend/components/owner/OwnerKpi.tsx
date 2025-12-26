'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface OwnerKpiProps {
    title: string;
    value: string | number;
    unit?: string;
    icon: LucideIcon;
    color: string;
    className?: string;
    loading?: boolean;
}

export function OwnerKpi({ title, value, unit, icon: Icon, color, className, loading }: OwnerKpiProps) {
    const colorClasses: Record<string, { bg: string, text: string, dot: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border border-slate-100 bg-white/80 p-2.5 shadow-sm backdrop-blur-md transition-all hover:shadow-md active:scale-[0.98]",
            className
        )}>
            {/* Background Accent */}
            <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10", colors.bg)} />

            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 mb-0">
                    <div className={cn("p-1.5 rounded-lg", colors.bg, colors.text)}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 transform translate-y-[1px]">{title}</p>
                </div>

                <div className="flex items-baseline gap-1 pl-1">
                    {loading ? (
                        <div className="h-7 w-16 animate-pulse rounded-md bg-slate-100" />
                    ) : (
                        <>
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{value}</h3>
                            {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
