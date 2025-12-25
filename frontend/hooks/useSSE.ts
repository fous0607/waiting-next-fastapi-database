
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useWaitingStore } from '../lib/store/useWaitingStore';

export function useSSE() {
    const eventSourceRef = useRef<EventSource | null>(null);
    const {

        setConnected,
        setConnectionBlockState,
        refreshAll, // Use optimized refresh
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
            // Optimized: Single consolidated refresh instead of multiple individual calls
            refreshAll();
            debounceTimerRef.current = null;
        }, 500); // 500ms debounce
    }, [refreshAll]); // Dependencies

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
            // Only toast if we've waited a bit vs initial render
            // toast.error("SSE 연결 실패: 매장 정보를 찾을 수 없습니다."); 
            return;
        } else {
            // toast.info(`SSE 연결 시도 (Store: ${storeId})...`);
        }

        let reconnectTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Closing existing connection before retry');
                eventSourceRef.current.close();
            }

            // Get token
            const token = localStorage.getItem('access_token');
            // role 파악 (현재 페이지 URL 기준으로 유추)
            let currentRole = 'admin';
            if (typeof window !== 'undefined') {
                if (window.location.pathname.includes('/board')) currentRole = 'board';
                else if (window.location.pathname.includes('/reception')) currentRole = 'reception';
            }

            console.log(`[SSE] Connecting to stream for store: ${storeId} as ${currentRole}...`);

            // Build URL with proper encoding
            const params = new URLSearchParams();
            params.append('store_id', storeId!); // asserted not null
            params.append('role', currentRole);
            if (token) {
                params.append('token', token);
            }

            // Vercel Proxy Strategy (Matching Board Page)
            const url = `/api/sse/stream?${params.toString()}`;
            const es = new EventSource(url);
            eventSourceRef.current = es;

            let isEjected = false;

            es.onopen = () => {
                console.log('[SSE] Connection opened successfully');
                setConnected(true);
            };

            es.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.event === 'ping') return;

                    // [Stage 2] 강제 종료 (Ejected) or 접속 거부 (Blocked) 처리
                    if (message.event === 'force_disconnect' || message.event === 'connection_rejected') {
                        isEjected = true; // 재연결 방지 플래그
                        es.close();
                        setConnected(false);

                        const reason = message.data?.reason;
                        const max = message.data?.max || '?';
                        const isRejected = message.event === 'connection_rejected';

                        // 1. 상태 업데이트 (UI 차단막 표시용)
                        setConnectionBlockState({
                            type: isRejected ? 'blocked' : 'ejected',
                            message: isRejected
                                ? `접속 가능한 대수(${max}대)를 초과하여 접속할 수 없습니다.`
                                : `다른 기기가 접속하여 이 기기의 연결이 종료되었습니다. (최대 ${max}대)`
                        });

                        // 2. 토스트 알림 (UI 차단막이 뜨더라도 알림은 띄움)
                        /* 
                           차단막이 뜨므로 토스트는 선택사항이지만, 
                           명확한 전달을 위해 남겨두거나 차단막 내 메시지로 대체 가능.
                           여기서는 차단막이 주가 되므로 토스트는 제거하거나 간단히 유지.
                        */
                        return;
                    }

                    switch (message.event) {
                        case 'new_user':
                        case 'status_changed':
                        case 'order_changed':
                        case 'class_moved':
                        case 'empty_seat_inserted':
                        case 'batch_attendance':
                            debouncedRefresh();
                            break;
                        case 'class_closed':
                            handleClassClosed(message.data.class_id);
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
                if (isEjected) return; // 추방된 경우 재연결 시도 안 함

                console.error('[SSE] Connection error', err);
                setConnected(false);
                es.close();

                // Reconnect after delay
                reconnectTimeout = setTimeout(() => {
                    console.log('[SSE] Attempting reconnect...');
                    connectSSE();
                }, 5000);
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
