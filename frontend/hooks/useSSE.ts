
import { useEffect, useRef, useCallback } from 'react';
import { useWaitingStore } from '../lib/store/useWaitingStore';

export function useSSE() {
    const eventSourceRef = useRef<EventSource | null>(null);
    const {
        setConnected,
        handleNewUser,
        handleStatusChange,
        handleOrderChange,
        handleClassClosed,
        handleClassReopened,
        selectedStoreId
    } = useWaitingStore();

    // Debounce refs
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced Refresh Handler
    const debouncedRefresh = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            console.log('[SSE] Debounced refresh triggered');
            // Trigger base refresh actions
            handleNewUser();
            handleStatusChange();
            handleOrderChange();
            debounceTimerRef.current = null;
        }, 500); // 500ms debounce
    }, [handleNewUser, handleStatusChange, handleOrderChange]); // Dependencies

    useEffect(() => {
        // Robust Store ID Resolution
        let storeId = selectedStoreId;
        if (!storeId && typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            storeId = params.get('store');
            if (storeId) {
                // ... logic to set store ID if needed, but here we just read it
            } else {
                storeId = localStorage.getItem('selected_store_id');
            }
        }

        if (!storeId) {
            console.log('[SSE] No store ID found, skipping connection');
            return;
        }

        let reconnectTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Closing existing connection before retry');
                eventSourceRef.current.close();
            }

            // Get token
            const token = localStorage.getItem('access_token');
            console.log(`[SSE] Connecting to stream for store: ${storeId}...`);

            // Direct Backend URL (Bypass Proxy) for Tablet Stability
            // Must strictly match the working logic in BoardPage/ReceptionPage
            // Direct Backend URL (Bypass Proxy) for Tablet Stability & Vercel Timeouts
            // Hardcoded to ensure HTTPS connection as per user requirement (bypassing potentially stale Env Vars)
            // FORCE_DEPLOY: Trigger Vercel update
            let backendUrl = 'https://waitingnext.posagent.kr/api/sse/stream';

            console.log(`[SSE] Backend URL forced to: ${backendUrl}`);

            // Build URL with proper encoding
            const params = new URLSearchParams();
            params.append('store_id', storeId!); // asserted not null
            params.append('role', 'admin'); // Explicitly set role as admin for Manager page
            if (token) {
                params.append('token', token);
            }

            const url = `${backendUrl}?${params.toString()}`;
            console.log(`[SSE] URL: ${url}`);

            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.onopen = () => {
                console.log('[SSE] Connection opened successfully');
                setConnected(true);
            };

            es.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.event === 'ping') return;

                    console.log('[SSE] Event received:', message.event, message.data);

                    switch (message.event) {
                        case 'new_user':
                        case 'status_changed':
                        case 'order_changed':
                        case 'class_moved':
                        case 'empty_seat_inserted':
                        case 'batch_attendance':
                            debouncedRefresh(); // Use debounced handler
                            break;
                        case 'class_closed':
                            handleClassClosed(message.data.class_id);
                            // Also trigger refresh to ensure lists are correct
                            debouncedRefresh();
                            break;
                        case 'class_reopened':
                            handleClassReopened(message.data.class_id);
                            debouncedRefresh();
                            break;
                        default:
                            break;
                    }
                } catch (e) {
                    console.error('[SSE] Failed to parse message', e);
                }
            };

            es.onerror = (err) => {
                console.error('[SSE] Connection error', err);
                setConnected(false);
                es.close();

                // Reconnect after delay
                reconnectTimeout = setTimeout(() => {
                    console.log('[SSE] Attempting reconnect...');
                    connectSSE();
                }, 3000);
            };
        };

        connectSSE();

        return () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Cleaning up connection');
                eventSourceRef.current.close();
                setConnected(false);
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, [selectedStoreId, setConnected, debouncedRefresh]);
}
