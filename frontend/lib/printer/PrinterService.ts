import { EscPosEncoder } from './EscPosEncoder';
import api from '../api';
import { LocalSettingsManager } from './LocalSettingsManager';

export type ConnectionType = 'lan' | 'bluetooth';

export interface PrinterConfig {
    type: ConnectionType;
    ip?: string;
    port?: number;
    connectionMode?: 'local_proxy' | 'cloud_queue';
    proxyIp?: string;
    // Bluetooth specific
    deviceId?: string;
    serviceId?: string;
    characteristicId?: string;
}

export interface PrintJob {
    storeName: string;
    waitingNumber: number;
    date: string;
    personCount?: number;
    qrUrl?: string;
    printerQrSize?: number;
    partySizeDetails?: string; // JSON string
    teamsAhead?: number;
    waitingOrder?: number;
    customTemplate?: string; // For testing unsaved templates
    enablePrinterQr?: boolean;
    ticketFormatConfig?: string;
    ticketCustomFooter?: string;
}

export class PrinterService {
    private encoder: EscPosEncoder;

    constructor() {
        this.encoder = new EscPosEncoder();
    }

    /**
     * Generate Receipt Data (Delegated to Backend for EUC-KR Encoding)
     */
    async generateReceipt(job: PrintJob): Promise<Uint8Array> {
        try {
            console.log('[PrinterService] Requesting ticket generation from backend...');
            const response = await api.post('/printer/generate-ticket', {
                store_name: job.storeName,
                waiting_number: job.waitingNumber.toString(),
                date: job.date,
                person_count: job.personCount,
                qr_url: job.qrUrl,
                printer_qr_size: job.printerQrSize,
                enable_printer_qr: job.enablePrinterQr,
                ticket_format_config: job.ticketFormatConfig,
                ticket_custom_footer: job.ticketCustomFooter,
                party_size_details: job.partySizeDetails,
                teams_ahead: job.teamsAhead,
                waiting_order: job.waitingOrder,
                custom_content: job.customTemplate
            });

            // Response data should be an array of integers (bytes)
            const byteArray = response.data;
            if (!Array.isArray(byteArray)) {
                throw new Error('Invalid response from ticket generation API');
            }

            return new Uint8Array(byteArray);
        } catch (error) {
            console.error('[PrinterService] Ticket Generation Failed:', error);
            // Fallback to local UTF-8 generation if backend fails (better than nothing)
            // But warn about encoding
            console.warn('[PrinterService] Falling back to local generation (UTF-8). Han-geul may safely be broken.');
            return this.generateReceiptLocal(job);
        }
    }

    /**
     * Local Generation Fallback (UTF-8, likely broken for Korean)
     */
    generateReceiptLocal(job: PrintJob): Uint8Array {
        const enc = this.encoder
            .initialize()
            .align('center')
            .bold(true)
            .size('big')
            .line(job.storeName)
            .feed(1)
            .size('normal')
            .bold(false)
            .line('--------------------------------')
            .feed(1)
            .align('center')
            .size('normal')
            .text('대기번호')
            .feed(1)
            .size('huge')
            .bold(true)
            .line(job.waitingNumber.toString())
            .size('normal')
            .bold(false)
            .feed(1)
            .feed(1)
            .line('--------------------------------')
            .feed(1)
            .text(job.date)
            .feed(15) // Increased feed to prevent QR/Text cutting
            .cut();

        return enc.encode();
    }

    /**
     * Print via Bluetooth (Web Bluetooth API)
     */
    async printBluetooth(data: Uint8Array): Promise<void> {
        const nav = navigator as any;
        if (!nav.bluetooth) {
            throw new Error('Web Bluetooth is not supported in this browser.');
        }

        try {
            // Check for standard printer service UUIDs or request any
            // Common Printer Services: 18f0 (Service), 2af1 (Characteristic) often used but varies
            const device = await nav.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Example service UUID
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            if (!device.gatt) {
                throw new Error('Bluetooth device not connected.');
            }

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            // Send data in chunks if needed (max usually 512 bytes)
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await characteristic.writeValue(chunk);
            }

            await device.gatt.disconnect();

        } catch (error) {
            console.error('Bluetooth Print Error:', error);
            throw error;
        }
    }

    /**
     * Print via Cloud Queue (Polling) or Local Proxy
     * Tablet sends job to Backend -> Backend Queues it -> PC Proxy Polls and Prints.
     * This avoids Mixed Content and Network Addressing issues.
     */
    async printLan(ip: string, printerPort: number, data: Uint8Array, proxyIp: string = 'localhost', proxyPort: number = 8000): Promise<void> {
        // Prepare Data
        const dataArray = Array.from(data);

        // Prepare Proxy URL
        let cleanIp = proxyIp.replace(/^(https?:\/\/)/, '').replace(/\/$/, '').trim();
        if (cleanIp.includes(':')) cleanIp = cleanIp.split(':')[0];
        if (!cleanIp) throw new Error('프록시 IP 주소가 올바르지 않습니다.');

        const proxyUrl = `http://${cleanIp}:${proxyPort}/print`;

        // Check Mixed Content for warning
        if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
            console.warn('[PrinterService] Mixed Content Warning: Attempting to call HTTP proxy from HTTPS origin.');
        }

        let lastError: any = null;
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`[PrinterService] Retry attempt ${attempt}/${MAX_RETRIES} in 1000ms...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                console.log(`[PrinterService] Sending print job to proxy at: ${proxyUrl} (Attempt ${attempt})`);

                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ip: ip,
                        port: printerPort,
                        data: dataArray
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Proxy Error: ${errorText}`);
                }

                return; // Success!

            } catch (error) {
                console.error(`[PrinterService] Proxy Print Attempt ${attempt} Failed:`, error);
                lastError = error;
                // Continuum to next attempt
            }
        }

        // If we get here, all retries failed. Format the error message.
        let errorMsg = `프린터 출력 실패: 프린터 연결 실패.\n로컬 프린트 프로그램(print_proxy)이 ${proxyIp}에서 실행 중인지 확인해주세요. (3회 시도 실패)`;

        if (lastError instanceof Error) {
            if (lastError.message.includes('Failed to fetch')) {
                errorMsg += '\n(원인: 네트워크 연결 불가 또는 보안 차단됨)';
                if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
                    errorMsg += '\n※ HTTPS 환경에서 HTTP 프록시 호출이 차단되었을 수 있습니다.';
                }
            } else {
                errorMsg += `\n(${lastError.message})`;
            }
        } else {
            errorMsg += `\n(${String(lastError)})`;
        }

        throw new Error(errorMsg);
    }



    async print(config: PrinterConfig, job: PrintJob) {
        // Fetch generated bytes from backend (EUC-KR)
        const data = await this.generateReceipt(job);

        // Check Local Settings Overrides
        const localSettings = LocalSettingsManager.getSettings();

        // New Multi-Registry Logic
        if (localSettings.useLocalSettings && localSettings.activeConnections && localSettings.activeConnections.length > 0) {
            console.log(`[PrinterService] Using ${localSettings.activeConnections.length} Active Local Connections`);

            const results = await Promise.allSettled(
                localSettings.activeConnections.map(async (conn) => {
                    if (conn.connectionType === 'bluetooth') {
                        return this.printBluetooth(data);
                    } else {
                        const targetPort = conn.printerPort || 9100;
                        const proxyPort = conn.proxyPort || 8000;
                        return this.printLan(conn.printerIp, targetPort, data, conn.proxyIp, proxyPort);
                    }
                })
            );

            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
                console.error('[PrinterService] Some print jobs failed:', failures);
                // If all failed, throw error. If some succeeded, maybe just toast/warn (but we are in a service)
                // For now, if any failed, we might want to alert the user.
                if (failures.length === localSettings.activeConnections.length) {
                    throw new Error('모든 프린터 출력에 실패했습니다.');
                }
            }
            return;
        }

        // Legacy / Default Single Connection Logic
        let targetPrinterIp = config.ip;
        let targetProxyIp = config.proxyIp || 'localhost';

        if (localSettings.useLocalSettings) {
            console.log('[PrinterService] Using Local Device Settings Override (Legacy)');
            if (localSettings.printerIp) targetPrinterIp = localSettings.printerIp;
            if (localSettings.proxyIp) targetProxyIp = localSettings.proxyIp;
        }

        if (config.type === 'bluetooth') {
            return this.printBluetooth(data);
        } else if (config.type === 'lan') {
            if (!targetPrinterIp) throw new Error('IP Address is required for LAN printing');

            // Pass effective IPs to printLan
            return this.printLan(targetPrinterIp, config.port || 9100, data, targetProxyIp, localSettings.proxyPort || 8000);
        }
    }
}
