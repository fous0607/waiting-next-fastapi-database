import React from 'react';

export interface StoreComparisonStat {
    store_id: number;
    store_name: string;
    total_sales: number;
    waiting_count: number;
    current_waiting: number;
    attendance_count: number;
    today_attended: number;
    avg_sales_per_person: number;
    conversion_rate: number;
}

interface StoreListTableProps {
    stores: StoreComparisonStat[];
    loading?: boolean;
}

export default function StoreListTable({ stores, loading }: StoreListTableProps) {
    if (loading) {
        return <div className="p-10 text-center text-slate-400">Loading table...</div>;
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">매장명</th>
                            <th className="px-6 py-4 text-right">총 대기 건수</th>
                            <th className="px-6 py-4 text-right">현재 대기 건수</th>
                            <th className="px-6 py-4 text-right">총 출석 건수</th>
                            <th className="px-6 py-4 text-right">현재 출석 건수</th>
                            <th className="px-6 py-4 text-right">출석률</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stores.map((store) => {
                            const attendanceRate = store.waiting_count > 0
                                ? Math.round((store.attendance_count / store.waiting_count) * 100)
                                : 0;
                            return (
                                <tr key={store.store_id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{store.store_name}</td>
                                    <td className="px-6 py-4 text-right font-medium text-blue-600">{store.waiting_count}건</td>
                                    <td className="px-6 py-4 text-right font-medium text-red-500">{store.current_waiting || 0}팀</td>
                                    <td className="px-6 py-4 text-right font-medium text-emerald-600">{store.attendance_count}건</td>
                                    <td className="px-6 py-4 text-right font-medium text-emerald-500">{store.today_attended || 0}건</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700">{attendanceRate}%</td>
                                </tr>
                            );
                        })}
                        {stores.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">데이터가 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
