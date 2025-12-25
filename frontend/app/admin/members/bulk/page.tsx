'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, Search, ArrowLeft, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ValidMember {
    name: string;
    phone: string;
    barcode?: string;
}

interface InvalidMember {
    row: number;
    name: string;
    phone: string;
    errors: string[];
}

interface ValidationResponse {
    total_count: number;
    valid_count: number;
    invalid_count: number;
    valid_members: ValidMember[];
    invalid_members: InvalidMember[];
}

export default function BulkRegisterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);

    const [isRegistering, setIsRegistering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
    const [resultCounts, setResultCounts] = useState({ success: 0, failed: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setValidationResult(null);
            setRegistrationStatus('idle');
        }
    };

    const handleDownloadSample = async () => {
        try {
            const response = await api.get('/members/sample-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'member_sample.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsValidating(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/members/upload-excel', formData);
            setValidationResult(response.data);
        } catch (error) {
            console.error('Validation failed:', error);
            alert('파일 처리 중 오류가 발생했습니다.');
        } finally {
            setIsValidating(false);
        }
    };

    const handleRegister = async () => {
        if (!validationResult || validationResult.valid_members.length === 0) return;

        setIsRegistering(true);
        setRegistrationStatus('processing');
        setProgress(0);

        const members = validationResult.valid_members;
        const total = members.length;
        const batchSize = 20;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < total; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            try {
                const response = await api.post('/members/bulk', { members: batch });
                successCount += response.data.success_count;
                failedCount += response.data.error_count;
            } catch (error) {
                console.error('Batch failed:', error);
                failedCount += batch.length;
            }

            const currentProgress = Math.min(Math.round(((i + batch.length) / total) * 100), 100);
            setProgress(currentProgress);
            setResultCounts({ success: successCount, failed: failedCount });
        }

        setIsRegistering(false);
        setRegistrationStatus('completed');
    };

    const reset = () => {
        setFile(null);
        setValidationResult(null);
        setRegistrationStatus('idle');
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/admin/members" className="text-slate-400 hover:text-slate-600 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">회원 일괄 등록</h2>
                    </div>
                    <p className="text-sm text-slate-500 font-medium ml-6">엑셀 파일을 업로드하여 다수의 회원을 한 번에 등록합니다.</p>
                </div>
                <Button
                    variant="outline"
                    className="rounded-xl gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                    onClick={handleDownloadSample}
                >
                    <Download className="w-4 h-4" />
                    샘플 양식 다운로드
                </Button>
            </div>

            {registrationStatus === 'processing' || registrationStatus === 'completed' ? (
                <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
                    <CardHeader className="bg-slate-900 text-white p-8">
                        <CardTitle className="text-lg flex items-center gap-3">
                            {registrationStatus === 'processing' ? (
                                <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            )}
                            등록 진행 현황
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm font-bold">
                                <span className="text-slate-600">처리 중... ({progress}%)</span>
                                <span className="text-slate-900">{totalRegistrations()} 중 {resultCounts.success + resultCounts.failed}개 완료</span>
                            </div>
                            <Progress value={progress} className="h-3 bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">총 대상</p>
                                <p className="text-2xl font-bold text-slate-900">{validationResult?.valid_count}명</p>
                            </div>
                            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">성공</p>
                                <p className="text-2xl font-bold text-emerald-700">{resultCounts.success}명</p>
                            </div>
                            <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                                <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">실패</p>
                                <p className="text-2xl font-bold text-red-700">{resultCounts.failed}명</p>
                            </div>
                        </div>

                        {registrationStatus === 'completed' && (
                            <div className="flex justify-center gap-4 pt-4">
                                <Button className="rounded-xl bg-slate-900 hover:bg-slate-800 px-8" onClick={reset}>
                                    처음으로
                                </Button>
                                <Link href="/admin/members">
                                    <Button variant="outline" className="rounded-xl border-slate-200">
                                        회원 목록으로 이동
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {!validationResult ? (
                        <Card className="border-none shadow-sm bg-white overflow-hidden group">
                            <CardContent className="p-12">
                                <div className="max-w-md mx-auto text-center space-y-6">
                                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                                        <Upload className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-slate-900">엑셀 파일 업로드</h3>
                                        <p className="text-sm text-slate-500 font-medium">샘플 양식에 맞춰 작성된 .xlsx 파일을 선택해주세요.</p>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileChange}
                                            accept=".xlsx, .xls"
                                            ref={fileInputRef}
                                        />
                                        <div className="flex gap-3">
                                            <Input
                                                readOnly
                                                placeholder="파일을 선택해주세요"
                                                value={file?.name || ''}
                                                className="rounded-xl bg-slate-50 border-none pointer-events-none"
                                            />
                                            <Button
                                                variant="outline"
                                                className="rounded-xl border-slate-200"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                파일 선택
                                            </Button>
                                        </div>
                                        <Button
                                            className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 h-12 text-base font-bold shadow-lg shadow-slate-200"
                                            disabled={!file || isValidating}
                                            onClick={handleUpload}
                                        >
                                            {isValidating ? (
                                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 검수 중...</>
                                            ) : (
                                                '데이터 검수하기'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* Statistics Cards */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">전체 데이터</p>
                                    <div className="flex items-end gap-1">
                                        <p className="text-3xl font-black text-slate-900">{validationResult.total_count}</p>
                                        <p className="text-sm font-bold text-slate-400 mb-1">건</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-50 p-6 rounded-3xl shadow-sm border border-emerald-100">
                                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">등록 가능</p>
                                    <div className="flex items-end gap-1">
                                        <p className="text-3xl font-black text-emerald-700">{validationResult.valid_count}</p>
                                        <p className="text-sm font-bold text-emerald-500 mb-1">건</p>
                                    </div>
                                </div>
                                <div className="bg-red-50 p-6 rounded-3xl shadow-sm border border-red-100">
                                    <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-1">오류/중복</p>
                                    <div className="flex items-end gap-1">
                                        <p className="text-3xl font-black text-red-700">{validationResult.invalid_count}</p>
                                        <p className="text-sm font-bold text-red-500 mb-1">건</p>
                                    </div>
                                </div>
                            </div>

                            {/* Invalid Members Table */}
                            {validationResult.invalid_count > 0 && (
                                <Card className="border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                                    <CardHeader className="bg-red-50/50 p-6 flex flex-row items-center gap-3 space-y-0">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base text-red-900">검토가 필요한 데이터</CardTitle>
                                            <p className="text-xs text-red-600 font-medium">아래 항목은 이번 등록 과정에서 제외됩니다.</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left">엑셀 행</th>
                                                        <th className="px-6 py-4 text-left">이름</th>
                                                        <th className="px-6 py-4 text-left">핸드폰번호</th>
                                                        <th className="px-6 py-4 text-left">오류 사유</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {validationResult.invalid_members.map((m, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-medium text-slate-400">{m.row}행</td>
                                                            <td className="px-6 py-4 font-bold text-slate-900">{m.name || '-'}</td>
                                                            <td className="px-6 py-4 text-slate-600">{m.phone || '-'}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {m.errors.map((err, eIdx) => (
                                                                        <span key={eIdx} className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                            {err}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Action Area */}
                            <div className="flex items-center justify-between p-8 bg-slate-900 rounded-3xl shadow-xl shadow-slate-200">
                                <div>
                                    <p className="text-white font-bold text-lg">총 {validationResult.valid_count}명의 회원을 등록할까요?</p>
                                    <p className="text-slate-400 text-sm font-medium">데이터가 많을 경우 수 초 정도 소요될 수 있습니다.</p>
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={reset}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        다시 업로드
                                    </Button>
                                    <Button
                                        className="rounded-2xl bg-indigo-500 hover:bg-indigo-400 px-10 h-14 text-base font-bold"
                                        disabled={validationResult.valid_count === 0}
                                        onClick={handleRegister}
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        등록 시작하기
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    function totalRegistrations() {
        return validationResult?.valid_count || 0;
    }
}
