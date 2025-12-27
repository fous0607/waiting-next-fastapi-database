import useSWR from 'swr';
import { useWaitingStore } from '../lib/store/useWaitingStore';
import { useEffect } from 'react';

/**
 * usePolling Hook
 * Replaces SSE with periodic polling using SWR.
 * Fetches data every 5 seconds to keep the UI in sync.
 */
export function usePolling(interval = 5000) {
    const { syncCheck, selectedStoreId, isConnected, setConnected } = useWaitingStore();

    // Stable key for SWR
    const key = (selectedStoreId && typeof selectedStoreId === 'string' && selectedStoreId !== '[object Object]')
        ? `polling-check-${selectedStoreId}`
        : null;

    const { error } = useSWR(key, syncCheck, {
        refreshInterval: interval,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: interval / 2,
    });

    // Emulate "Connected" state for UI compatibility
    useEffect(() => {
        if (!isConnected && selectedStoreId) {
            setConnected(true);
        }
    }, [isConnected, selectedStoreId, setConnected]);

    // Handle errors (optional: could auto-disconnect UI on repeated failures)
    useEffect(() => {
        if (error) {
            console.error('[Polling] Failed:', error);
            // Optionally setConnected(false) here if strict connectivity check is needed
        }
    }, [error]);
}
