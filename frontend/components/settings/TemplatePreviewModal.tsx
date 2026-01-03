"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Printer, ScanQrCode, Scissors } from 'lucide-react';

interface TemplatePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateContent: string;
    templateName: string;
    options: any;
}

export function TemplatePreviewModal({ isOpen, onClose, templateContent, templateName, options }: TemplatePreviewModalProps) {

    const renderContent = () => {
        if (!templateContent) return null;

        const lines = templateContent.split('\n');
        let currentAlignment = 'left';
        let isBold = false;
        let currentSize = 'normal';

        return lines.map((line, idx) => {
            let processedLine = line;

            // Extract and update state based on tags
            if (processedLine.includes('{ALIGN:CENTER}')) { currentAlignment = 'center'; processedLine = processedLine.replace('{ALIGN:CENTER}', ''); }
            if (processedLine.includes('{ALIGN:LEFT}')) { currentAlignment = 'left'; processedLine = processedLine.replace('{ALIGN:LEFT}', ''); }
            if (processedLine.includes('{ALIGN:RIGHT}')) { currentAlignment = 'right'; processedLine = processedLine.replace('{ALIGN:RIGHT}', ''); }

            if (processedLine.includes('{BOLD:ON}')) { isBold = true; processedLine = processedLine.replace('{BOLD:ON}', ''); }
            if (processedLine.includes('{BOLD:OFF}')) { isBold = false; processedLine = processedLine.replace('{BOLD:OFF}', ''); }

            if (processedLine.includes('{SIZE:HUGE}')) { currentSize = 'huge'; processedLine = processedLine.replace('{SIZE:HUGE}', ''); }
            else if (processedLine.includes('{SIZE:BIG}')) { currentSize = 'big'; processedLine = processedLine.replace('{SIZE:BIG}', ''); }
            else if (processedLine.includes('{SIZE:NORMAL}')) { currentSize = 'normal'; processedLine = processedLine.replace('{SIZE:NORMAL}', ''); }

            // Handle Special Placeholders
            if (processedLine.includes('{CUT}')) {
                return (
                    <div key={idx} className="flex flex-col items-center gap-1 my-4 py-4 border-t border-dashed border-slate-300">
                        <Scissors className="w-4 h-4 text-slate-300" />
                        <span className="text-[10px] text-slate-300 font-mono uppercase tracking-widest">Paper Cut</span>
                    </div>
                );
            }

            if (processedLine.includes('{QR}')) {
                return (
                    <div key={idx} className="flex justify-center my-4">
                        <div className="w-32 h-32 border-2 border-slate-900 bg-white p-2 flex items-center justify-center">
                            <ScanQrCode className="w-full h-full text-slate-900" />
                        </div>
                    </div>
                );
            }

            // Replace data variables with sample data
            processedLine = processedLine
                .replace('{STORE_NAME}', '미소 식당 (테스트)')
                .replace('{WAITING_NUMBER}', '102')
                .replace('{DATE}', new Date().toLocaleString('ko-KR'))
                .replace('{PEOPLE}', '성인 2, 유아 1 (총 3명)')
                .replace('{TEAMS_AHEAD}', '4')
                .replace('{ORDER}', '12')
                .replace('{MEMBER_NAME}', '홍길동')
                .replace('{PHONE}', '010-****-5678')
                .replace('{BARCODE}', '[BARCODE-SAMPLE]');

            // Alignment Class
            const alignClass = {
                center: 'text-center',
                left: 'text-left',
                right: 'text-right'
            }[currentAlignment as 'center' | 'left' | 'right'] || 'text-left';

            // Size style
            const sizeStyle = {
                huge: 'text-4xl font-black',
                big: 'text-2xl font-bold',
                normal: 'text-sm font-medium'
            }[currentSize as 'huge' | 'big' | 'normal'] || 'text-sm font-medium';

            const boldClass = isBold ? 'font-black' : '';

            // If empty line after tag removal
            if (processedLine.trim() === '' && line.trim() !== '') {
                return <div key={idx} className="h-2" />;
            }
            if (line.trim() === '') {
                return <div key={idx} className="h-4" />;
            }

            return (
                <div
                    key={idx}
                    className={`${alignClass} ${sizeStyle} ${boldClass} break-all leading-relaxed transition-all`}
                    style={{ whiteSpace: 'pre-wrap' }}
                >
                    {processedLine}
                </div>
            );
        });
    };

    const paddingTopLines = parseInt(options.paddingTop || "0");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[420px] p-0 border-none bg-slate-900 shadow-2xl overflow-hidden rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <Printer className="w-5 h-5 text-blue-400" />
                            영수증 미리보기
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs mt-1">
                            {templateName} (샘플 데이터 적용)
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-8 bg-slate-800 flex justify-center overflow-y-auto max-h-[600px] no-scrollbar">
                    {/* Thermal Paper Simulation */}
                    <div className="bg-white w-full max-w-[320px] min-h-[400px] shadow-2xl p-6 relative animate-in fade-in slide-in-from-bottom-5 duration-500">
                        {/* Paper Texture Overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

                        {/* Paper Edge Effect */}
                        <div className="absolute -top-1 left-0 right-0 h-2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-200 via-transparent to-transparent opacity-20" />

                        {/* Dynamic Padding Top */}
                        {Array.from({ length: paddingTopLines }).map((_, i) => (
                            <div key={`pad-${i}`} className="h-6" />
                        ))}

                        <div className="relative z-10 text-slate-900 space-y-1">
                            {renderContent()}
                        </div>

                        {/* Paper Bottom Edge */}
                        <div className="absolute -bottom-1 left-0 right-0 h-4 bg-white [clip-path:polygon(0%_0%,5%_100%,10%_0%,15%_100%,20%_0%,25%_100%,30%_0%,35%_100%,40%_0%,45%_100%,50%_0%,55%_100%,60%_0%,65%_100%,70%_0%,75%_100%,80%_0%,85%_100%,90%_0%,95%_100%,100%_0%)]" />
                    </div>
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-center">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
                    >
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { Button } from '@/components/ui/button';
