
const LOCAL_SETTINGS_KEY = 'waiting_service_local_settings';

export interface SavedPrinterProfile {
    id: string;
    name: string;
    proxyIp: string;
    printerIp: string;
}

export interface ActiveConnection {
    id: string;
    name: string;
    proxyIp: string;
    proxyPort: number;
    printerIp: string;
    printerPort: number;
    connectionType: 'lan' | 'bluetooth';
}

export interface LocalDeviceSettings {
    useLocalSettings: boolean;
    // Legacy single connection support
    proxyIp?: string;
    proxyPort?: number;
    printerIp?: string;
    printerPort?: number;
    proxyUnitId?: number;
    printerUnitId?: number;
    // New multi-registry support
    activeConnections?: ActiveConnection[];
    profiles?: SavedPrinterProfile[];
    // Screen Instance ID for this device
    assignedScreenId?: string;
    assignedScreenName?: string;
}

export const LocalSettingsManager = {
    getSettings: (): LocalDeviceSettings => {
        if (typeof window === 'undefined') {
            return { useLocalSettings: false };
        }
        try {
            const saved = localStorage.getItem(LOCAL_SETTINGS_KEY);
            return saved ? JSON.parse(saved) : { useLocalSettings: false };
        } catch (e) {
            console.error('Failed to parse local settings', e);
            return { useLocalSettings: false };
        }
    },

    saveSettings: (settings: LocalDeviceSettings) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    },

    clearSettings: () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(LOCAL_SETTINGS_KEY);
    }
};
