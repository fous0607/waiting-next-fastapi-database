import { EscPosEncoder } from './EscPosEncoder';
import api from '../api';

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
     * Print via Cloud Queue (Polling) or Local Proxy
     * Tablet sends job to Backend -> Backend Queues it -> PC Proxy Polls and Prints.
     * This avoids Mixed Content and Network Addressing issues.
     */
    async printLan(ip: string, port: number, data: Uint8Array, proxyIp: string = 'localhost'): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // Convert Uint8Array to Array for JSON serialization
                const dataArray = Array.from(data);

                // Use configured proxy IP (default to localhost)
                // Note: Tablet must be able to reach this IP
                const proxyUrl = `http://${proxyIp}:8000/print`;
                console.log(`[PrinterService] Sending print job to proxy at: ${proxyUrl}`);

                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ip: ip,
                        port: port,
                        data: dataArray
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Proxy Error: ${errorText}`);
                }

                resolve();
            } catch (error) {
                console.error('[PrinterService] Proxy Print Failed:', error);
                reject(new Error(
                    `프린터 연결 실패. 로컬 프린트 프로그램(print_proxy)이 ${proxyIp}에서 실행 중인지 확인해주세요.\n` +
                    (error instanceof Error ? error.message : String(error))
                ));
            }
        });
    }

    async print(config: PrinterConfig, job: PrintJob) {
        const data = this.generateReceipt(job);

        if (config.type === 'bluetooth') {
            return this.printBluetooth(data);
        } else if (config.type === 'lan') {
            if (!config.ip) throw new Error('IP Address is required for LAN printing');
            // Default to 'local_proxy' behavior for now if mode is not set
            const proxyIp = config.proxyIp || 'localhost';
            return this.printLan(config.ip, config.port || 9100, data, proxyIp);
        }
    }
}
