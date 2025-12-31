import { useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form'; // Or use store
// If settings are in store, use store. If in a form, use context.
// Actually, global settings are in useWaitingStore.
import { useWaitingStore } from '../store/useWaitingStore';
import { PrinterService, PrintJob } from './PrinterService';
import { toast } from 'sonner';

export const usePrinter = () => {
    const { storeSettings, storeName } = useWaitingStore();
    const [isPrinting, setIsPrinting] = useState(false);

    // Initialize service once or singleton? 
    // Service is stateless mostly, but encoder is cheap.
    const printerService = new PrinterService();

    const printWaitingTicket = useCallback(async (
        waitingNumber: number,
        date: string,
        partySize?: string,
        options?: { settings?: any, storeName?: string, personCount?: number, storeCode?: string, phone?: string }
    ) => {
        const settings = options?.settings || storeSettings;
        const name = options?.storeName || storeName || '매장이름';

        // QR URL Construction
        // format: {origin}/entry/{store_code}/status?phone={phone}
        // If phone is provided, we append it for direct lookup
        let qrUrl = undefined;
        if (options?.storeCode && typeof window !== 'undefined') {
            qrUrl = `${window.location.origin}/entry/${options.storeCode}/status`;
            if (options.phone) {
                // Simple text append. Ideally encrypt or encode, but for now raw phone as per request.
                qrUrl += `?phone=${options.phone}`;
            }
            console.log('[Printer] Generated QR URL:', qrUrl);
        } else {
            console.log('[Printer] QR URL not generated. storeCode:', options?.storeCode);
        }

        if (!settings?.enable_printer) {
            console.log('[Printer] Printing disabled in settings.');
            return;
        }

        setIsPrinting(true);
        try {
            const config = {
                type: (settings.printer_connection_type as 'lan' | 'bluetooth') || 'lan',
                ip: settings.printer_ip_address || '',
                port: settings.printer_port || 9100,
                connectionMode: settings.printer_connection_mode || 'local_proxy',
                proxyIp: settings.printer_proxy_ip || 'localhost',
            };

            const job: PrintJob = {
                storeName: name,
                waitingNumber,
                date,
                personCount: options?.personCount,
                qrUrl,
                printerQrSize: settings.printer_qr_size
            };

            await printerService.print(config, job);
            toast.success('대기표가 출력되었습니다.');

        } catch (error) {
            console.error('[Printer] Print failed:', error);
            // Don't show toast for LAN "secure context" errors if explicit, but here we show general error
            toast.error('프린터 출력 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsPrinting(false);
        }
    }, [storeSettings, storeName]);

    const testPrint = useCallback(async (settings?: any) => {
        // For testing from Settings page, we might need to pass config explicitly if not saved yet.
        await printWaitingTicket(999, new Date().toLocaleString(), undefined, { settings });
    }, [printWaitingTicket]);

    return {
        printWaitingTicket,
        testPrint,
        isPrinting
    };
};
