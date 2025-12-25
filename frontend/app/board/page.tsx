'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { BoardCard } from '@/components/board/board-card';
import { GlobalLoader } from "@/components/ui/GlobalLoader";

import { WaitingItem } from '@/lib/store/useWaitingStore';

interface BoardClass {
    id: number;
    class_name: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
}

interface BoardData {
    classes: BoardClass[];
    waiting_list: WaitingItem[];
    business_date: string;
    rows_per_class?: number;
}

// Removed constant ITEMS_PER_PAGE

interface BoardData {
    classes: BoardClass[];
    waiting_list: WaitingItem[];
    business_date: string;
    rows_per_class?: number;
    waiting_board_page_size?: number;
    waiting_board_rotation_interval?: number;
    waiting_board_transition_effect?: string;
}

export default function BoardPage() {
    const [data, setData] = useState<BoardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pageIndices, setPageIndices] = useState<Record<number, number>>({});

    const loadData = useCallback(async () => {
        try {
            // Extract store code from URL query parameter or localStorage
            const params = new URLSearchParams(window.location.search);
            let storeCode = params.get('store');

            if (!storeCode) {
                // Fallback to localStorage
                storeCode = localStorage.getItem('selected_store_code');
            }

            if (!storeCode) {
                console.error('Store code not provided in URL or localStorage');
                // Could show a specific error message here or redirect
                return;
            }

            const { data: boardData } = await api.get(`/board/display?store_code=${storeCode}`);
            setData(boardData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const [isConnected, setIsConnected] = useState(false);
    const [storeSettings, setStoreSettings] = useState<any>(null);

    // Load store settings for font customization
    useEffect(() => {
        const loadStoreSettings = async () => {
            try {
                const { data: settings } = await api.get('/store/');
                setStoreSettings(settings);

                // Apply font settings to CSS variables
                if (settings.board_font_family) {
                    document.documentElement.style.setProperty('--board-font-family', `"${settings.board_font_family}", sans-serif`);
                }
                if (settings.board_font_size) {
                    document.documentElement.style.setProperty('--board-font-size', settings.board_font_size);
                }
            } catch (error) {
                console.error('Failed to load store settings:', error);
            }
        };

        loadStoreSettings();
    }, []);

    // Initial load only - SSE will handle all subsequent updates
    useEffect(() => {
        loadData();
    }, [loadData]);

    // SSE Connection
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedReload = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            console.log('[BoardSSE] Debounced reload triggered');
            loadData();
            debounceTimerRef.current = null;
        }, 500); // 500ms debounce window
    }, [loadData]);

    // SSE Connection
    useEffect(() => {
        let es: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            // Check if board is enabled in settings
            if (storeSettings && storeSettings.enable_waiting_board === false) {
                console.log('[BoardSSE] Connection aborted: Waiting board is disabled in settings');
                setIsConnected(false);
                return;
            }

            // Resolve store ID from URL or default to '1'
            let storeId = '1';
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                storeId = params.get('store') || '1';
            }

            const token = localStorage.getItem('access_token');
            const params = new URLSearchParams();
            params.append('store_id', storeId);
            params.append('role', 'board'); // Explicitly set role as board
            if (token) {
                params.append('token', token);
            }

            // Use relative path to avoid Mixed Content errors
            const url = `/api/sse/stream?${params.toString()}`;
            console.log(`[BoardSSE] Connecting for store ${storeId} using URL: ${url}`);

            es = new EventSource(url);

            es.onopen = () => {
                console.log('[BoardSSE] Connected');
                setIsConnected(true);
            };

            es.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.event === 'ping') return;

                    console.log('[BoardSSE] Event received:', message.event);

                    // Reload data on any relevant event - Now Debounced
                    switch (message.event) {
                        case 'new_user':
                        case 'status_changed':
                        case 'order_changed':
                        case 'class_moved':
                        case 'empty_seat_inserted':
                        case 'class_closed':
                        case 'class_reopened':
                        case 'user_called':
                        case 'batch_attendance':
                        case 'name_updated':
                            debouncedReload();
                            break;
                        default:
                            break;
                    }
                } catch (e) {
                    console.error('[BoardSSE] Failed to parse message', e);
                }
            };

            es.onerror = (err) => {
                console.error('[BoardSSE] Connection error', err);
                setIsConnected(false);
                if (es) es.close();

                // Reconnect after 3s
                reconnectTimeout = setTimeout(() => {
                    console.log('[BoardSSE] Reconnecting...');
                    connect();
                }, 3000);
            };
        };

        if (storeSettings) {
            connect();
        }

        return () => {
            if (es) es.close();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); // Cleanup debounce
            clearTimeout(reconnectTimeout);
            setIsConnected(false);
        };
    }, [debouncedReload, storeSettings?.enable_waiting_board]);

    // Page Rotation Timer - respects store settings
    useEffect(() => {
        if (!data) return;

        const pageSize = data.waiting_board_page_size || 12;
        const interval = (data.waiting_board_rotation_interval || 5) * 1000;

        const intervalId = setInterval(() => {
            setPageIndices((prev) => {
                const next = { ...prev };

                // Group current items to check lengths
                const currentGroups: Record<string, any[]> = {};
                data.classes.forEach((cls) => { currentGroups[cls.id] = []; });
                data.waiting_list.forEach((item) => {
                    if (currentGroups[item.class_id]) currentGroups[item.class_id].push(item);
                });

                let hasChanges = false;
                data.classes.forEach((cls) => {
                    const items = currentGroups[cls.id] || [];
                    if (items.length > pageSize) {
                        const totalPages = Math.ceil(items.length / pageSize);
                        const currentPage = prev[cls.id] || 0;
                        const nextPage = (currentPage + 1) % totalPages;

                        if (nextPage !== currentPage) {
                            next[cls.id] = nextPage;
                            hasChanges = true;
                        }
                    } else if (prev[cls.id] !== 0) {
                        // Reset to page 0 if items reduced
                        next[cls.id] = 0;
                        hasChanges = true;
                    }
                });

                return hasChanges ? next : prev;
            });
        }, interval);

        return () => clearInterval(intervalId);
    }, [data]);

    if (isLoading && !data) return <div className="h-screen w-screen flex items-center justify-center text-2xl">로딩 중...</div>;

    // Check if board is disabled
    if (storeSettings && storeSettings.enable_waiting_board === false) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-5xl mb-6">🚫</div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">대기현황판 미사용</h1>
                <p className="text-slate-500 text-lg">
                    현재 매장에서 대기현황판 기능을 사용하지 않도록 설정되어 있습니다.<br />
                    관리자 설정에서 '대기현황판 사용'을 활성화해주세요.
                </p>
            </div>
        );
    }

    if (!data) return <div className="h-screen w-screen flex items-center justify-center text-2xl">데이터가 없습니다.</div>;

    // Group items by class
    const classGroups: Record<string, any[]> = {};
    data.classes.forEach((cls) => {
        classGroups[cls.id] = [];
    });
    data.waiting_list.forEach((item) => {
        if (classGroups[item.class_id]) {
            classGroups[item.class_id].push(item);
        }
    });

    return (
        <div className="min-h-screen bg-slate-50 p-4 flex flex-col">
            <header className="mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">대기현황</h1>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                        {isConnected ? '연결됨' : '연결 끊김'}
                    </div>
                    <div className="text-2xl font-medium text-slate-500">
                        {data?.business_date ? new Date(data.business_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : ''}
                    </div>
                </div>
            </header>

            {/* Adjust grid columns based on internal rows (columns) per class to ensure enough width */}
            <div className={`flex-1 grid gap-4 ${(data.rows_per_class || 1) >= 2
                ? "grid-cols-1 md:grid-cols-1 lg:grid-cols-2" // Wider cards for multi-column content
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" // Standard uniform grid
                }`}>
                {data.classes.map((cls) => {
                    const items = classGroups[cls.id] || [];
                    const pageSize = data.waiting_board_page_size || 12;

                    const rawPage = pageIndices[cls.id] || 0;
                    const totalPages = Math.ceil(items.length / pageSize);
                    // Safety check: if current page is invalid (e.g. items deleted), reset to 0
                    const currentPage = (totalPages > 0 && rawPage >= totalPages) ? 0 : rawPage;

                    const currentItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

                    // Fixed visual slots to prevent layout shift - use pageSize for height calculation
                    const rowsPerClass = data.rows_per_class || 1;
                    const visualRowCount = Math.ceil(pageSize / rowsPerClass);

                    return (
                        <div key={cls.id} className="flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="bg-slate-800 text-white p-4 text-center relative z-10">
                                <h2 className="text-2xl font-bold mb-1">{cls.class_name}</h2>
                                <div className="text-sm opacity-80 flex justify-between px-4">
                                    <span>{cls.start_time.substring(0, 5)} ~ {cls.end_time.substring(0, 5)}</span>
                                    <span>{items.length}명 / {cls.max_capacity}명</span>
                                </div>
                                {totalPages > 1 && (
                                    <div className="absolute top-4 right-4 bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
                                        {currentPage + 1} / {totalPages}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 flex-1 bg-slate-100 overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentPage}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        variants={{
                                            slide: {
                                                initial: { opacity: 0, x: 20 },
                                                animate: { opacity: 1, x: 0 },
                                                exit: { opacity: 0, x: -20 },
                                            },
                                            fade: {
                                                initial: { opacity: 0 },
                                                animate: { opacity: 1 },
                                                exit: { opacity: 0 },
                                            },
                                            scale: {
                                                initial: { opacity: 0, scale: 0.9 },
                                                animate: { opacity: 1, scale: 1 },
                                                exit: { opacity: 0, scale: 1.1 },
                                            },
                                            none: {
                                                initial: { opacity: 1 },
                                                animate: { opacity: 1 },
                                                exit: { opacity: 1 },
                                            }
                                        }[data.waiting_board_transition_effect as 'slide' | 'fade' | 'scale' | 'none' || 'slide'] || {
                                            initial: { opacity: 0, x: 20 },
                                            animate: { opacity: 1, x: 0 },
                                            exit: { opacity: 0, x: -20 },
                                        }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="grid gap-2 content-start h-full"
                                        style={{
                                            gridTemplateColumns: `repeat(${rowsPerClass}, 1fr)`,
                                            gridTemplateRows: `repeat(${visualRowCount}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {items.length === 0 ? (
                                            <div className="h-full col-span-full flex flex-col items-center justify-center text-gray-400 row-span-full" style={{ gridRow: `span ${visualRowCount}` }}>
                                                <span className="text-4xl mb-4">📭</span>
                                                <p className="text-xl">대기자가 없습니다</p>
                                            </div>
                                        ) : (
                                            <>
                                                {currentItems.map((item) => (
                                                    <BoardCard key={item.id} item={item} />
                                                ))}
                                            </>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
