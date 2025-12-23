'use client';

import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ChartData {
    labels: string[];
    values: number[];
    colors?: string[];
}

interface DonutChartProps {
    title: string;
    data: ChartData;
}

const DonutChart: React.FC<DonutChartProps> = ({ title, data }) => {
    const chartData = {
        labels: data.labels,
        datasets: [
            {
                data: data.values,
                backgroundColor: data.colors || [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ef4444',
                    '#64748b'
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 20,
                    font: {
                        size: 12,
                        weight: 500
                    },
                    generateLabels: (chart: any) => {
                        const datasets = chart.data.datasets;
                        return chart.data.labels.map((label: string, i: number) => ({
                            text: `${label}   ${datasets[0].data[i]}%`,
                            fillStyle: datasets[0].backgroundColor[i],
                            hidden: false,
                            index: i,
                            pointStyle: 'circle',
                        }));
                    }
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                cornerRadius: 8,
                callbacks: {
                    label: function (context: any) {
                        return ` ${context.label}: ${context.raw}%`;
                    }
                }
            },
        },
        cutout: '60%',
    };

    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
            <h3 className="text-lg font-bold text-slate-900 mb-6">{title}</h3>
            <div className="h-[250px] relative">
                <Doughnut data={chartData} options={options as any} />
                {/* Center Text (Optional) */}
                {/* <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-900">Total</span>
               </div> */}
            </div>
        </div>
    );
};

export default DonutChart;
