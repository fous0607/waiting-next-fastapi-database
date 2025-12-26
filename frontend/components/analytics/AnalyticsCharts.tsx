'use client';

import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    RadialLinearScale,
    ArcElement,
} from 'chart.js';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';
import {
    LineChart as LineChartIcon,
    AreaChart as AreaChartIcon,
    BarChart2,
    Radar as RadarIcon,
    PieChart as PieChartIcon,
    AlignLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface TimeStat {
    hour?: number;
    label: string;
    waiting_count: number;
    attendance_count: number;
}

interface AnalyticsChartsProps {
    data: TimeStat[];
    periodType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'store' | 'ranking';
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ data, periodType = 'hourly' }) => {
    const [chartType, setChartType] = React.useState<'line' | 'bar' | 'area' | 'radar' | 'doughnut' | 'horizontalBar'>('bar');

    React.useEffect(() => {
        if (periodType === 'store') {
            setChartType('bar');
        } else if (periodType === 'ranking') {
            setChartType('horizontalBar');
        } else {
            // Default behavior for time-series: prefer 'bar' if already set or not specifically requested
            const categoricalCharts = ['radar', 'doughnut'];
            if (categoricalCharts.includes(chartType)) {
                setChartType('bar');
            }
        }
    }, [periodType]);

    // Labels
    const labels = data.map(d => {
        if (d.label && d.label.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return d.label.substring(2); // "2025-12-04" -> "25-12-04"
        }
        return d.label || `${d.hour}시`;
    });

    const getDatasets = () => {
        const waitingData = data.map(d => d.waiting_count);
        const attendanceData = data.map(d => d.attendance_count);

        // Doughnut specific: sum or last? 
        // For general analytics showing "Waiting vs Attendance", we sum them up?
        // Or show dataset 1 vs dataset 2?
        // Let's make Doughnut show "Total Waiting" by Category (Label).
        // Actually, Doughnut usually shows 1 dataset.
        // If we select Doughnut, let's show "Waiting Counts per Label".

        if (chartType === 'doughnut') {
            return [
                {
                    label: '대기 건수',
                    data: waitingData,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(236, 72, 153, 0.8)',
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                }
            ];
        }

        const baseDatasets = [
            {
                label: '대기 건수',
                data: waitingData,
                borderColor: '#3b82f6',
                backgroundColor: chartType === 'area' ? 'rgba(59, 130, 246, 0.2)'
                    : (chartType === 'bar' || chartType === 'horizontalBar') ? '#3b82f6'
                        : 'rgba(59, 130, 246, 0.2)', // radar
                fill: chartType === 'area' || chartType === 'radar',
                tension: 0.4,
                pointRadius: (chartType === 'bar' || chartType === 'horizontalBar') ? 0 : 4,
                pointHoverRadius: 6,
                borderRadius: (chartType === 'bar' || chartType === 'horizontalBar') ? 4 : 0,
            },
            {
                label: '출석 건수',
                data: attendanceData,
                borderColor: '#10b981',
                backgroundColor: chartType === 'area' ? 'rgba(16, 185, 129, 0.2)'
                    : (chartType === 'bar' || chartType === 'horizontalBar') ? '#10b981'
                        : 'rgba(16, 185, 129, 0.2)', // radar
                fill: chartType === 'area' || chartType === 'radar',
                tension: 0.4,
                pointRadius: (chartType === 'bar' || chartType === 'horizontalBar') ? 0 : 4,
                pointHoverRadius: 6,
                borderRadius: (chartType === 'bar' || chartType === 'horizontalBar') ? 4 : 0,
            }
        ];

        return baseDatasets;
    };

    const chartData = {
        labels: labels,
        datasets: getDatasets(),
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 6,
                    font: { size: 12, weight: 700 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                cornerRadius: 8,
                displayColors: false,
            },
        },
    };

    const getOptions = () => {
        const scaleOptions = {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { stepSize: 1, font: { size: 11 } },
            },
            x: {
                grid: { display: false },
                ticks: { autoSkip: true, maxRotation: 0, font: { size: 11 } },
            },
        };

        if (chartType === 'horizontalBar') {
            return {
                ...commonOptions,
                indexAxis: 'y' as const,
                scales: {
                    x: scaleOptions.y, // swap x and y options roughly
                    y: scaleOptions.x
                }
            };
        }

        if (chartType === 'radar') {
            return {
                ...commonOptions,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { display: false, stepSize: 1 } // hide radial ticks for cleaner look
                    }
                }
            };
        }

        if (chartType === 'doughnut') {
            return {
                ...commonOptions,
                cutout: '60%',
            };
        }

        return {
            ...commonOptions,
            scales: scaleOptions
        };
    };


    const getTitle = () => {
        switch (periodType) {
            case 'daily': return '일별 대기/출석 추이';
            case 'weekly': return '주별 대기/출석 추이';
            case 'monthly': return '월별 대기/출석 추이';
            case 'quarterly': return '분기별 대기/출석 추이';
            case 'store': return '매장별 대기/출석 현황';
            default: return '시간대별 대기/출석 추이';
        }
    };

    const renderChart = () => {
        const options = getOptions();
        switch (chartType) {
            case 'bar': return <Bar data={chartData} options={options as any} />;
            case 'horizontalBar': return <Bar data={chartData} options={options as any} />;
            case 'area': return <Line data={chartData} options={options as any} />;
            case 'radar': return <Radar data={chartData} options={options as any} />;
            case 'doughnut': return <Doughnut data={chartData} options={options as any} />;
            default: return <Line data={chartData} options={options as any} />;
        }
    };

    const ChartButton = ({ type, icon: Icon, title }: { type: typeof chartType, icon: any, title: string }) => (
        <button
            onClick={() => setChartType(type)}
            className={cn(
                "p-2 rounded-lg transition-all",
                chartType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
            title={title}
        >
            <Icon className="w-4 h-4" />
        </button>
    );

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-[520px] group transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{getTitle()}</h3>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">영업 시간 내 흐름을 시각화합니다.</p>
                    </div>

                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <ChartButton type="line" icon={LineChartIcon} title="선 그래프" />
                        <ChartButton type="area" icon={AreaChartIcon} title="면적 그래프" />
                        <ChartButton type="bar" icon={BarChart2} title="막대 그래프" />
                        <ChartButton type="horizontalBar" icon={AlignLeft} title="가로 막대" />
                        {/* Radar and Doughnut often need more space or distinct data shape, but adding as requested */}
                        <ChartButton type="radar" icon={RadarIcon} title="레이더 차트" />
                        <ChartButton type="doughnut" icon={PieChartIcon} title="도넛 차트" />
                    </div>
                </div>

                <div className="h-[360px]">
                    {renderChart()}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsCharts;

// Internal icon helpers for cleaner code without adding new imports if possible,
// but let's check what's already imported or add them.

