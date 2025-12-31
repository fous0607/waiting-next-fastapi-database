import { EscPosEncoder } from './EscPosEncoder';

export type ConnectionType = 'lan' | 'bluetooth';

export interface PrinterConfig {
    type: ConnectionType;
    ip?: string;
    port?: number;
    // Bluetooth specific
    deviceId?: string;
    serviceId?: string;
    characteristicId?: string;
}

export interface PrintJob {
    storeName: string;
    waitingNumber: number;
    date: string;
    // other fields...
}

export class PrinterService {
    private encoder: EscPosEncoder;

    constructor() {
        this.encoder = new EscPosEncoder();
    }

    /**
     * Generate Receipt Data
     */
    generateReceipt(job: PrintJob): Uint8Array {
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
            .line('--------------------------------')
            .feed(1)
            .text(job.date)
            .feed(3)
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
     * Print via LAN (WebSocket or HTTP)
     * Direct TCP is not possible from browser.
     * We assume the printer supports WebSocket or we have an override.
     * For pure LAN printing without an intermediate server, likely need an app wrapper or specific printer support.
     */
    async printLan(ip: string, port: number, data: Uint8Array): Promise<void> {
        // Option 1: WebSocket (if printer supports ePos SDK or raw socket-to-ws bridge)
        // Many Epson TM printers listen onws://<IP>/

        return new Promise((resolve, reject) => {
            // This is speculative. A generic raw TCP printer cannot be reached this way.
            // We would need a "Print Agent" running locally or the printer needs WS support.
            // Assuming Epson ePOS-like behavior or a custom agent.

            // For now, let's try a common path or just log.
            console.log(`[PrinterService] Attempting to print to ${ip}:${port} via WebSocket...`);

            // NOTE: Raw TCP port 9100 cannot be reached via WebSocket directly.
            // If the user uses a bridge (like 'websockify' on a Pi) it would work.
            // For now, we will throw an error explaining this limitation or mock it if strictly browser-based.

            // Check if we are in a secure context (https) and trying to access insecure ip (http/ws).
            // Mixed content might be blocked.

            reject(new Error("Direct LAN printing requires standard WebSockets supported by the printer or a local print server. Raw TCP 9100 is not supported in browsers directly."));
        });
    }

    async print(config: PrinterConfig, job: PrintJob) {
        const data = this.generateReceipt(job);

        if (config.type === 'bluetooth') {
            return this.printBluetooth(data);
        } else if (config.type === 'lan') {
            if (!config.ip) throw new Error('IP Address is required for LAN printing');
            return this.printLan(config.ip, config.port || 9100, data);
        }
    }
}
