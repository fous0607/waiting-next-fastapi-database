'use client';

import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface OwnerChartsProps {
    data: any[];
    title: string;
    type?: 'bar' | 'line';
    loading?: boolean;
}

export function OwnerCharts({ data, title, type = 'bar', loading }: OwnerChartsProps) {
    if (loading) {
        return (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-[250px] w-full animate-pulse rounded-xl bg-slate-50" />
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="flex h-[300px] flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white p-6 shadow-sm text-slate-400">
                <p>데이터가 없습니다.</p>
            </div>
        );
    }

    const chartData = {
        labels: data.map((d) => d.label || `${d.hour}시`),
        datasets: [
            {
                label: '대기 접수',
                data: data.map((d) => d.waiting_count),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2,
                borderRadius: 8,
                tension: 0.4,
                fill: type === 'line',
            },
            {
                label: '출석 완료',
                data: data.map((d) => d.attendance_count),
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 2,
                borderRadius: 8,
                tension: 0.4,
                fill: type === 'line',
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 20,
                    font: { size: 12, weight: '500' } as any,
                },
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                displayColors: true,
                usePointStyle: true,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 10 } as any },
            },
            y: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10 } as any },
            },
        },
    };

    return (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h4 className="mb-6 text-lg font-bold text-slate-800">{title}</h4>
            <div className="h-[250px] w-full">
                {type === 'bar' ? (
                    <Bar data={chartData} options={options} />
                ) : (
                    <Line data={chartData} options={options} />
                )}
            </div>
        </div>
    );
}
