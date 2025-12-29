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
    const [selectedStyle, setSelectedStyle] = useState<'clean' | 'vibrant' | 'modern'>('clean');
    const [guideMessage, setGuideMessage] = useState('스마트폰 카메라로 QR코드를 스캔하여\n간편하게 대기를 등록하세요.');
    const [open, setOpen] = useState(false);

    const [scale, setScale] = useState(0.65); // Default scale for better fit

    if (typeof window === 'undefined') return null;
    const origin = window.location.origin;
    const entryUrl = `${origin}/entry/${storeCode}`;

    const handlePrint = () => {
        window.print();
    };

    const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 1.5));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.4));
    const zoomReset = () => setScale(0.65);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="default" size="sm">인쇄하기</Button>}
            </DialogTrigger>
            <DialogContent className="!max-w-none !w-[100vw] !h-[100vh] !p-0 !gap-0 !rounded-none !border-none overflow-hidden flex flex-col">
                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    {/* Left: Settings Panel */}
                    <div className="w-full md:w-[320px] p-6 border-r bg-slate-50/50 flex flex-col gap-6 shrink-0 h-full overflow-y-auto">
                        <div>
                            <DialogTitle className="text-lg">QR 인쇄 디자인 설정</DialogTitle>
                            <DialogDescription className="mt-1">
                                매장에 비치될 QR 코드의 스타일을 커스텀하세요.
                            </DialogDescription>
                        </div>

                        {/* Style Selector */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">스타일 선택</label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'clean', name: '클린 카드', desc: '네이버 영수증 스타일의 깔끔한 화이트', color: '#03C75A' },
                                    { id: 'vibrant', name: '바이브런트 브랜드', desc: '고객의 시선을 끄는 고대비 그린', color: '#03C75A' },
                                    { id: 'modern', name: '모던 프로페셔널', desc: '세련된 레이아웃과 감각적인 폰트', color: '#0F172A' }
                                ].map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => setSelectedStyle(s.id as any)}
                                        className={cn(
                                            "group p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3",
                                            selectedStyle === s.id
                                                ? "border-primary bg-white shadow-md"
                                                : "border-slate-200 bg-white hover:border-primary/40"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
                                            <Printer className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{s.name}</p>
                                            <p className="text-[11px] text-slate-500">{s.desc}</p>
                                        </div>
                                        {selectedStyle === s.id && <Check className="w-4 h-4 text-primary" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Text Settings */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">안내 멘트 수정</label>
                            <textarea
                                value={guideMessage}
                                onChange={(e) => setGuideMessage(e.target.value)}
                                className="w-full h-24 p-3 text-sm rounded-xl border-2 border-slate-200 focus:border-primary focus:ring-0 transition-all resize-none"
                                placeholder="고객에게 보여줄 안내 문구를 입력하세요."
                            />
                        </div>

                        {/* Print Tips */}
                        <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/10">
                            <h5 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-2">
                                <Info className="w-3.5 h-3.5" /> 인쇄 전 확인하세요!
                            </h5>
                            <ul className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                                <li className="flex gap-1.5 font-medium"><span>•</span> 최상의 품질을 위해 <b>광택용지</b>를 권장합니다.</li>
                                <li className="flex gap-1.5"><span>•</span> 설정에서 <b>'배경 그래픽'</b>을 반드시 체크하세요.</li>
                                <li className="flex gap-1.5"><span>•</span> 인쇄 후 코팅하면 더 오랫동안 깨끗합니다.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Right: Real-time Preview */}
                    <div className="flex-1 bg-slate-200 flex flex-col min-h-0 relative h-full">
                        {/* Zoom Controls */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                            <div className="flex items-center bg-black/70 backdrop-blur-md rounded-full border border-white/20 p-1 shadow-lg">
                                <Button variant="ghost" size="icon" onClick={zoomOut} className="w-8 h-8 rounded-full text-white hover:bg-white/20 hover:text-white">
                                    -
                                </Button>
                                <span className="text-[10px] font-bold text-white w-12 text-center select-none font-mono">
                                    {Math.round(scale * 100)}%
                                </span>
                                <Button variant="ghost" size="icon" onClick={zoomIn} className="w-8 h-8 rounded-full text-white hover:bg-white/20 hover:text-white">
                                    +
                                </Button>
                                <div className="w-px h-4 bg-white/20 mx-1" />
                                <Button variant="ghost" size="sm" onClick={zoomReset} className="h-8 px-3 rounded-full text-[10px] text-white hover:bg-white/20 hover:text-white">
                                    RESET
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-8 flex justify-center items-center relative w-full h-full">
                            <div
                                className="bg-white shadow-2xl w-[450px] aspect-[1/1.414] origin-center transition-all duration-300 ease-out shrink-0"
                                style={{ transform: `scale(${scale})` }}
                            >
                                <QRPrintTemplate
                                    style={selectedStyle}
                                    storeName={storeName}
                                    guideMessage={guideMessage}
                                    url={entryUrl}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Printer className="w-4 h-4" />
                                <span className="text-xs font-medium">Auto-A4 Optimization Active</span>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={() => setOpen(false)} className="px-6 rounded-xl">닫기</Button>
                                <Button onClick={handlePrint} className="gap-2 px-8 rounded-xl font-bold bg-primary hover:bg-primary/90">
                                    <Printer className="w-4 h-4" /> 지금 인쇄하기
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Only Section */}
                <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            body * { visibility: hidden; }
                            .print-content, .print-content * { 
                                visibility: visible; 
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .print-content { 
                                position: fixed;
                                left: 0; 
                                top: 0; 
                                width: 100vw;
                                height: 100vh;
                                margin: 0;
                                padding: 0;
                            }
                            @page {
                                size: auto;
                                margin: 0mm;
                            }
                        }
                    `}} />
                    <div className="print-content">
                        {selectedStyle === 'clean' && (
                            <QRPrintTemplate style="clean" storeName={storeName} guideMessage={guideMessage} url={entryUrl} isFullPage />
                        )}
                        {selectedStyle === 'vibrant' && (
                            <QRPrintTemplate style="vibrant" storeName={storeName} guideMessage={guideMessage} url={entryUrl} isFullPage />
                        )}
                        {selectedStyle === 'modern' && (
                            <QRPrintTemplate style="modern" storeName={storeName} guideMessage={guideMessage} url={entryUrl} isFullPage />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface TemplateProps {
    style: 'clean' | 'vibrant' | 'modern';
    storeName: string;
    guideMessage: string;
    url: string;
    isFullPage?: boolean;
}

function QRPrintTemplate({ style, storeName, guideMessage, url, isFullPage = false }: TemplateProps) {
    if (style === 'clean') {
        return (
            <div className={cn(
                "w-full h-full flex flex-col bg-white overflow-hidden",
                isFullPage ? "p-0" : "p-0"
            )}>
                {/* Visual Accent */}
                <div className={isFullPage ? "h-6 bg-[#03C75A]" : "h-1 bg-[#03C75A]"} />

                <div className="flex-1 flex flex-col items-center justify-between py-[12%] px-10">
                    <div className="text-center w-full">
                        <div className={cn("inline-flex items-center gap-2 mb-8 bg-[#03C75A]/10 text-[#03C75A] px-4 py-1 rounded-full", isFullPage ? "text-3xl px-8 py-3 mb-16" : "text-[10px]")}>
                            <span className="font-black">NAVER</span>
                            <span className="w-px h-2 bg-[#03C75A]/30" />
                            <span className="font-medium">대기접수 연동</span>
                        </div>
                        <h1 className={cn("font-black text-slate-900 leading-[1.1] mb-6", isFullPage ? "text-[85px]" : "text-3xl")}>
                            {storeName}
                        </h1>
                        <p className={cn("text-slate-500 font-medium whitespace-pre-wrap leading-relaxed", isFullPage ? "text-4xl px-20" : "text-[11px] px-4")}>
                            {guideMessage}
                        </p>
                    </div>

                    <div className={cn("relative p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] flex items-center justify-center", isFullPage ? "p-14 ring-[16px] ring-slate-50" : "p-6 ring-8 ring-slate-50")}>
                        <QRCode
                            value={url}
                            size={isFullPage ? 400 : 160}
                            fgColor="#03C75A"
                            level="H"
                        />
                        <div className={cn("absolute inset-0 flex items-center justify-center pointer-events-none")}>
                            <div className={cn("bg-white p-1 rounded-lg", isFullPage ? "p-2 rounded-xl" : "p-1")}>
                                {/* Tiny logo or initial could go here if needed */}
                            </div>
                        </div>
                    </div>

                    <div className="w-full">
                        <div className={cn("h-px w-full bg-slate-100 mb-8", isFullPage ? "mb-16" : "mb-4")} />
                        <div className="flex flex-col items-center gap-3">
                            <div className={cn("flex items-center gap-2 text-[#03C75A] font-bold uppercase tracking-widest", isFullPage ? "text-3xl" : "text-[10px]")}>
                                <Smartphone className={isFullPage ? "w-8 h-8" : "w-3 h-3"} />
                                <span>SMART PHONE CAMERA SCAN</span>
                            </div>
                            <p className={cn("text-slate-300", isFullPage ? "text-2xl mt-4" : "text-[8px]")}>Powered by WaitingPos System</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (style === 'vibrant') {
        return (
            <div className="w-full h-full flex flex-col bg-[#03C75A] text-white relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[-10%] right-[-10%] w-[60%] aspect-square bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[40%] aspect-square bg-white/5 rounded-full blur-2xl" />

                <div className="flex-1 flex flex-col items-center justify-center p-[10%] text-center z-10">
                    <div className={cn("bg-white/20 backdrop-blur-md px-6 py-2 rounded-full mb-10 font-bold", isFullPage ? "text-3xl px-12 py-4 mb-20" : "text-[11px]")}>
                        WELCOME TO
                    </div>

                    <h1 className={cn("font-black tracking-tight leading-none mb-10 drop-shadow-xl", isFullPage ? "text-[95px] mb-20" : "text-4xl")}>
                        {storeName}
                    </h1>

                    <div className={cn("bg-white p-6 rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] mb-12", isFullPage ? "p-16 mb-24" : "p-6")}>
                        <QRCode value={url} size={isFullPage ? 450 : 150} />
                    </div>

                    <div className="space-y-6 max-w-sm">
                        <p className={cn("font-black text-white whitespace-pre-wrap leading-[1.3]", isFullPage ? "text-5xl" : "text-[15px]")}>
                            {guideMessage}
                        </p>
                        <p className={cn("text-white/60 font-medium", isFullPage ? "text-2xl mt-10" : "text-[9px]")}>
                            카메라를 비춰주시면 즉시 대기 등록 페이지로 이동합니다.
                        </p>
                    </div>
                </div>

                <div className={cn("py-10 bg-black/10 backdrop-blur-sm border-t border-white/10 flex justify-center items-center gap-3", isFullPage ? "py-20" : "py-4")}>
                    <div className={cn("w-2 h-2 rounded-full bg-white", isFullPage ? "w-4 h-4" : "w-1.5 h-1.5")} />
                    <span className={cn("font-medium tracking-[0.2em] opacity-80 uppercase", isFullPage ? "text-2xl" : "text-[9px]")}>Wait-Free Solution</span>
                    <div className={cn("w-2 h-2 rounded-full bg-white", isFullPage ? "w-4 h-4" : "w-1.5 h-1.5")} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#0F172A] relative overflow-hidden">
            {/* Dark Professional Style */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)]" />

            <div className="flex-1 flex flex-col p-[12%] z-10">
                <div className="mb-auto">
                    <h1 className={cn("text-white font-black leading-tight tracking-tight mb-8", isFullPage ? "text-[80px]" : "text-3xl")}>
                        {storeName}
                        <span className="block text-primary">대기 접수 파트너</span>
                    </h1>
                    <div className={cn("h-1 w-20 bg-primary rounded-full", isFullPage ? "h-3 w-40" : "h-1 w-12")} />
                </div>

                <div className="flex flex-col items-center gap-12 my-12">
                    <div className={cn("bg-white p-6 rounded-[2rem] shadow-[#38bdf820_0_0_80px] border border-white/10", isFullPage ? "p-16 rounded-[4rem]" : "p-6")}>
                        <QRCode value={url} size={isFullPage ? 480 : 160} fgColor="#0F172A" />
                    </div>
                </div>

                <div className="mt-auto">
                    <p className={cn("text-slate-200 font-bold whitespace-pre-wrap leading-relaxed mb-8", isFullPage ? "text-[45px]" : "text-[13px]")}>
                        {guideMessage}
                    </p>

                    <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={cn("bg-primary rounded-full", isFullPage ? "w-4 h-4" : "w-2 h-2")}
                                    style={{ opacity: 1 - (i * 0.25) }} />
                            ))}
                        </div>
                        <span className={cn("text-slate-500 font-bold tracking-[.3em] uppercase", isFullPage ? "text-2xl" : "text-[8px]")}>Digital Entry</span>
                    </div>
                </div>
            </div>

            {/* Bottom Glow */}
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] aspect-square bg-[#38bdf820] rounded-full blur-[100px]" />
        </div>
    );
}
