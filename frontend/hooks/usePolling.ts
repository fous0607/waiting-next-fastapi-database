
import useSWR from 'swr';
import { api } from '../lib/api';
import { useWaitingStore } from '../lib/store/useWaitingStore';
import { useCallback, useEffect } from 'react';

/**
 * usePolling Hook
 * Replaces SSE with periodic polling using SWR.
 * Fetches data every 5 seconds to keep the UI in sync.
 */
export function usePolling(interval = 5000) {
    const { syncToken, setSyncToken, refreshAll, selectedStoreId, isConnected, setConnected } = useWaitingStore();

    // Key includes storeId to unique identify the poll
    const key = selectedStoreId ? `/api/polling/sync-check/${selectedStoreId}` : null;

    const fetcher = useCallback(async (url: string) => {
        try {
            const res = await api.get(url);
            const newToken = res.data.sync_token;

            // If token is different, or we don't have one, refresh all data
            if (newToken !== syncToken) {
                console.log(`[Polling] Data changed (Token: ${newToken}). Refreshing...`);
                await refreshAll();
                setSyncToken(newToken);
            } else {
                // console.log('[Polling] No changes detected. Skipping refresh.');
            }
            return newToken;
        } catch (err) {
            console.error('[Polling] Sync check failed:', err);
            throw err;
        }
    }, [refreshAll, syncToken, setSyncToken]);

    const { error } = useSWR(key, fetcher, {
        refreshInterval: interval,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        focusThrottleInterval: 5000,
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
