
const LOCAL_SETTINGS_KEY = 'waiting_service_local_settings';

export interface SavedPrinterProfile {
    id: string;
    name: string;
    proxyIp: string;
    printerIp: string;
}

export interface LocalDeviceSettings {
    useLocalSettings: boolean;
    proxyIp?: string;
    printerIp?: string;
    printerPort?: number;
    profiles?: SavedPrinterProfile[];
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
