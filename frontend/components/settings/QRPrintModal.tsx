"use client";

import { useState } from 'react';
import QRCode from 'react-qr-code';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Printer, Smartphone, Info } from 'lucide-react';
import { cn } from "@/lib/utils";

interface QRPrintModalProps {
    storeName: string;
    storeCode: string;
    trigger?: React.ReactNode;
}

export function QRPrintModal({ storeName, storeCode, trigger }: QRPrintModalProps) {
    const [selectedStyle, setSelectedStyle] = useState<'standard' | 'naver'>('standard');
    const [open, setOpen] = useState(false);

    if (typeof window === 'undefined') return null;
    const origin = window.location.origin;
    const entryUrl = `${origin}/entry/${storeCode}`;

    const handlePrint = () => {
        // Create a hidden print container or just trigger window.print with specific class
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="default" size="sm">인쇄하기</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>매장 대기접수 QR 코드 인쇄</DialogTitle>
                    <DialogDescription>
                        스타일을 선택하고 인쇄하세요. A4 용지에 최적화되어 출력됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    {/* Style Selection */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Info className="w-4 h-4 text-primary" /> 스타일 선택
                        </h4>

                        <div className="space-y-3">
                            <Card
                                className={cn(
                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                    selectedStyle === 'standard' ? "border-primary bg-primary/5" : "border-slate-200"
                                )}
                                onClick={() => setSelectedStyle('standard')}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">심플 스탠다드</p>
                                        <p className="text-xs text-muted-foreground">깔끔하고 모던한 기본 스타일</p>
                                    </div>
                                    {selectedStyle === 'standard' && <Check className="w-5 h-5 text-primary" />}
                                </div>
                            </Card>

                            <Card
                                className={cn(
                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                    selectedStyle === 'naver' ? "border-[#03C75A] bg-[#03C75A]/5" : "border-slate-200"
                                )}
                                onClick={() => setSelectedStyle('naver')}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">네이버 영수증 스타일</p>
                                        <p className="text-xs text-muted-foreground">시선을 끄는 친숙한 디자인</p>
                                    </div>
                                    {selectedStyle === 'naver' && <Check className="w-5 h-5 text-[#03C75A]" />}
                                </div>
                            </Card>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border text-xs space-y-2">
                            <p className="font-semibold text-slate-700">📌 인쇄 팁</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-600">
                                <li>A4 용지 세로 방향 출력을 권장합니다.</li>
                                <li>'배경 그래픽' 옵션을 체크하면 색상이 선명하게 출력됩니다.</li>
                                <li>QR 코드가 훼손되지 않도록 코팅하거나 보호필름을 사용하면 좋습니다.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex flex-col space-y-3">
                        <h4 className="text-sm font-semibold">미리보기 (Preview)</h4>
                        <div className="flex-1 bg-slate-100 rounded-lg p-8 flex justify-center items-start border-2 border-dashed border-slate-300 min-h-[400px] overflow-hidden">
                            <div className="bg-white shadow-xl w-[300px] aspect-[1/1.414] origin-top scale-[1.2]">
                                <QRPrintTemplate
                                    style={selectedStyle}
                                    storeName={storeName}
                                    url={entryUrl}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                    <Button onClick={handlePrint} className="gap-2">
                        <Printer className="w-4 h-4" /> 인쇄하기
                    </Button>
                </DialogFooter>

                {/* Print Only Section */}
                <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            body * { visibility: hidden; }
                            .print-content, .print-content * { visibility: visible; }
                            .print-content { 
                                position: absolute; 
                                left: 0; 
                                top: 0; 
                                width: 210mm; /* A4 width */
                                height: 297mm; /* A4 height */
                                margin: 0;
                                padding: 0;
                            }
                            @page {
                                size: A4;
                                margin: 0;
                            }
                        }
                    `}} />
                    <div className="print-content flex flex-col items-center justify-center h-full">
                        <QRPrintTemplate
                            style={selectedStyle}
                            storeName={storeName}
                            url={entryUrl}
                            isFullPage
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function QRPrintTemplate({ style, storeName, url, isFullPage = false }: { style: 'standard' | 'naver', storeName: string, url: string, isFullPage?: boolean }) {
    if (style === 'standard') {
        return (
            <div className={cn(
                "w-full h-full flex flex-col items-center justify-center p-8 bg-white border",
                isFullPage ? "p-16" : "p-4"
            )}>
                <div className="text-center mb-8">
                    <h1 className={cn("font-black tracking-tight", isFullPage ? "text-5xl" : "text-xl")}>{storeName}</h1>
                    <p className={cn("text-slate-500 mt-2", isFullPage ? "text-2xl" : "text-[10px]")}>편리하게 대기를 접수하세요</p>
                </div>

                <div className={cn("p-4 border-2 border-slate-100 rounded-2xl bg-white shadow-sm", isFullPage ? "p-12 mb-12" : "p-4")}>
                    <QRCode value={url} size={isFullPage ? 400 : 150} />
                </div>

                <div className="mt-8 text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-primary">
                        <Smartphone className={isFullPage ? "w-8 h-8" : "w-4 h-4"} />
                        <span className={cn("font-bold", isFullPage ? "text-2xl" : "text-xs")}>스마트폰 카메라로 스캔하세요</span>
                    </div>
                    <p className={cn("text-slate-400", isFullPage ? "text-xl" : "text-[8px]")}>별도 앱 설치 없이 바로 대기 등록이 가능합니다</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "w-full h-full flex flex-col bg-white overflow-hidden border",
            isFullPage ? "" : ""
        )}>
            {/* Header */}
            <div className={cn("bg-[#03C75A] text-white p-6 flex flex-col items-center", isFullPage ? "p-16 pt-24" : "p-4")}>
                <div className={cn("bg-white/20 px-3 py-1 rounded-full mb-4 font-bold tracking-tight", isFullPage ? "text-2xl px-6 py-2 mb-8" : "text-[10px] mb-2")}>
                    Quick & Easy
                </div>
                <h1 className={cn("font-black text-center break-keep leading-tight", isFullPage ? "text-6xl" : "text-xl")}>
                    {storeName} <br /> 실시간 대기 접수
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                {/* Decorative shape */}
                <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#03C75A] to-transparent opacity-10" />

                <div className={cn("p-4 rounded-3xl bg-white shadow-2xl border border-slate-100 ring-8 ring-[#03C75A]/5", isFullPage ? "p-12 mb-12" : "p-4")}>
                    <QRCode value={url} size={isFullPage ? 400 : 150} fgColor="#03C75A" />
                </div>

                <div className="mt-12 text-center">
                    <p className={cn("text-[#03C75A] font-black italic mb-2", isFullPage ? "text-3xl mb-4" : "text-xs")}>SCAN ME!</p>
                    <h2 className={cn("font-bold text-slate-800", isFullPage ? "text-4xl" : "text-sm")}>카메라로 QR코드를 비춰주세요</h2>
                    <p className={cn("text-slate-400 mt-4", isFullPage ? "text-xl" : "text-[9px]")}>안전하고 간편하게 바로 입장이 가능합니다</p>
                </div>
            </div>

            {/* Footer */}
            <div className={cn("bg-slate-50 border-t border-dashed p-6 flex justify-center", isFullPage ? "p-12" : "p-3")}>
                <div className="flex items-center gap-2 opacity-30 grayscale saturate-0">
                    <span className="font-bold">WaitingPos</span>
                </div>
            </div>
        </div>
    );
}
