'use client';

import React, { useState, useEffect } from 'react';
import { CalendarCheck, Search, Download, Filter, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlobalLoader } from '@/components/ui/GlobalLoader';
import DateRangeSelector from '@/components/analytics/DateRangeSelector';
import api from '@/lib/api';

interface AttendanceRecord {
    id: number;
    business_date: string;
    member_name: string;
    phone: string;
    class_name: string;
    attended_at: string;
}

export default function AttendanceListPage() {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const fetchAttendance = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (start) params.append('start_date', start);
            if (end) params.append('end_date', end);

            const response = await api.get(`/franchise/stats/attendance-list?${params.toString()}`);
            setRecords(response.data);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = (range: { start: string; end: string }) => {
        setDateRange(range);
        fetchAttendance(range.start, range.end);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <CalendarCheck className="w-7 h-7 text-emerald-500" />
                        상세 출석 조회
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">선택 기간 동안의 전체 출석 명단입니다.</p>
                </div>

                <div className="flex items-center gap-3">
                    <DateRangeSelector onRangeChange={handleRangeChange} />
                    <Button variant="outline" className="rounded-xl border-slate-200 hidden md:flex items-center gap-2">
                        <Download className="w-4 h-4 text-slate-400" />
                        Excel 추출
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-0">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-900">출석 명부 ({records.length}건)</h3>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400">
                                <Filter className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400">
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-32 flex flex-col items-center justify-center">
                            <GlobalLoader message="출석 내역을 불러오는 중입니다..." />
                        </div>
                    ) : records.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">영업일</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">이름</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">전화번호</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">수업/교시</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">출석시각</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {records.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 font-medium text-slate-600 text-sm">{record.business_date}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                        <User className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                    <span className="font-bold text-slate-900 text-sm">{record.member_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[13px] text-slate-500 font-medium">
                                                {record.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100/50 text-emerald-700 text-[11px] font-bold">
                                                    {record.class_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">{record.attended_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-32 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                                <CalendarCheck className="w-8 h-8 text-slate-200" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">출석 내역이 없습니다</h3>
                            <p className="text-sm text-slate-500 mt-1">다른 날짜 범위를 선택해보세요.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
