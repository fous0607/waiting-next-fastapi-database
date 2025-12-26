
import useSWR from 'swr';
import { useWaitingStore } from '../lib/store/useWaitingStore';
import { useCallback, useEffect } from 'react';

/**
 * usePolling Hook
 * Replaces SSE with periodic polling using SWR.
 * Fetches data every 5 seconds to keep the UI in sync.
 */
export function usePolling(interval = 5000) {
    const {
        refreshAll,
        selectedStoreId,
        currentClassId,
        setConnected,
        isConnected
    } = useWaitingStore();

    // Key includes storeId and classId to force re-poll on change
    const key = selectedStoreId ? `/api/polling/${selectedStoreId}` : null;

    const fetcher = useCallback(async () => {
        // console.log('[Polling] Refreshing data...');
        await refreshAll();
        return true;
    }, [refreshAll]);

    const { error } = useSWR(key, fetcher, {
        refreshInterval: interval,
        revalidateOnFocus: true,     // Refresh when window gets focus
        revalidateOnReconnect: true, // Refresh when network reconnects
        dedupingInterval: 2000,      // Prevent duplicate calls within 2s
        focusThrottleInterval: 5000, // Throttle focus events
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
