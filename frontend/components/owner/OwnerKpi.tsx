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
            "relative overflow-hidden rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md active:scale-[0.98]",
            className
        )}>
            {/* Background Accent */}
            <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10", colors.bg)} />

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className={cn("p-3 rounded-2xl", colors.bg, colors.text)}>
                        <Icon className="h-6 w-6" />
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <div className="flex items-baseline gap-1">
                        {loading ? (
                            <div className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
                        ) : (
                            <>
                                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{value}</h3>
                                {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
