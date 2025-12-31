'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { cn, playSilentAudio } from '@/lib/utils';
import { useVoiceAlert } from '@/hooks/useVoiceAlert';
import { BoardCard } from '@/components/board/board-card';
import { GlobalLoader } from "@/components/ui/GlobalLoader";



interface BoardClass {
    id: number;
    class_name: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
}

interface BoardWaitingItem {
    id: number;
    waiting_number: number;
    display_name: string;
    class_id: number;
    class_name: string;
    class_order: number;
    is_empty_seat: boolean;
    status: string;
    call_count: number;
    last_called_at: string | null;
}


// Removed constant ITEMS_PER_PAGE

interface BoardData {
    classes: BoardClass[];
    waiting_list: BoardWaitingItem[];
    business_date: string;
    rows_per_class?: number;
    waiting_board_page_size?: number;
    waiting_board_rotation_interval?: number;
    waiting_board_transition_effect?: string;
    voice_settings?: any;
}


export default function BoardPage() {
    const [data, setData] = useState<BoardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pageIndices, setPageIndices] = useState<Record<number, number>>({});
    const dataRef = useRef<BoardData | null>(null);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

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
            // Initial setting sync
            if (boardData.voice_settings) {
                setStoreSettings((prev: any) => ({ ...prev, ...boardData.voice_settings }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const [isConnected, setIsConnected] = useState(false);
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);

    // Audio Unlocker
    const enableAudio = useCallback(async () => {
        // Attempt silent unlock first (reliable for unlocking AudioContext)
        await playSilentAudio();

        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance('대기현황판 음성 안내가 시작됩니다.');
            utterance.volume = 0.1;
            utterance.rate = 1.0;
            utterance.lang = 'ko-KR';

            // Only confirm enabled if it actually plays
            utterance.onstart = () => {
                console.log('[Board] Audio started successfully.');
            };
            utterance.onend = () => {
                setIsAudioEnabled(true);
                setShowOverlay(false); // Close overlay on success
            };
            utterance.onerror = (e) => {
                console.warn('[Board] Audio autoplay blocked or failed:', e);
                // Even if TTS fails, we might have unlocked via silent audio, so let's be optimistic if user clicked
                if (e.error !== 'not-allowed') {
                    // If it's not a permission error, maybe just TTS error?
                }
            };

            // If silent audio worked, we can force state to true
            setIsAudioEnabled(true);
            setShowOverlay(false);

            window.speechSynthesis.speak(utterance);
        }
    }, []);

    // Auto-dismiss for TV/Non-touch screens (3 seconds)
    // Tries to enable audio, but closes the big overlay regardless of success so the board is visible
    useEffect(() => {
        if (!isAudioEnabled && showOverlay) {
            const timer = setTimeout(() => {
                console.log('[Board] Auto-dismissing overlay and attempting audio...');
                enableAudio();
                setShowOverlay(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isAudioEnabled, showOverlay, enableAudio]);

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
                console.log('[Board] Store settings loaded:', settings);
            } catch (error) {
                console.error('[Board] Failed to load store settings:', error);
            }
        };

        loadStoreSettings();
    }, []);

    const { speakCall } = useVoiceAlert(storeSettings);

    // Initial load only - SSE will handle all subsequent updates
    useEffect(() => {
        loadData();
    }, [loadData]);


    // Call Announcement Logic
    const processedCallsRef = useRef<Set<string>>(new Set());
    const isFirstDataLoad = useRef(true);

    useEffect(() => {
        if (!data) return;

        // Sync settings from polling data (ensure we have latest voice config)
        if (data.voice_settings) {
            setStoreSettings((prev: any) => ({ ...prev, ...data.voice_settings }));
        }

        // On first load, just mark existing calls as processed to avoid re-announcing
        if (isFirstDataLoad.current) {
            console.log('[Board] First load, marking existing calls as processed.');
            data.waiting_list.forEach(item => {
                if (item.call_count > 0) processedCallsRef.current.add(`${item.id}:${item.call_count}`);
            });
            isFirstDataLoad.current = false;
            return;
        }

        data.waiting_list.forEach(item => {
            const key = `${item.id}:${item.call_count}`;
            // If item is called (count > 0) and we haven't processed this specific count yet
            if (item.call_count > 0 && !processedCallsRef.current.has(key)) {
                // Trigger Voice through hook
                console.log('[Board] Triggering voice for:', item.display_name, 'Call Count:', item.call_count);
                speakCall({
                    class_order: item.class_order,
                    display_name: item.display_name,
                    class_name: item.class_name
                });

                processedCallsRef.current.add(key);
            }
        });
    }, [data, storeSettings, speakCall]);

    // SWR Polling Implementation
    // Replaces SSE for Vercel Serverless environment
    const fetcher = useCallback(async () => {
        // Extract store code
        const params = new URLSearchParams(window.location.search);
        const storeCode = params.get('store') || localStorage.getItem('selected_store_code');

        if (!storeCode) return null;

        const res = await api.get(`/board/display?store_code=${storeCode}`);
        return res.data;
    }, []);

    // Use SWR for periodic updates (Interval: 5s)
    // Board needs frequent updates for "new_user", "status_changed" etc.
    // Note: We need to import useSWR at the top
    const { data: swrData, error } = useSWR(
        (typeof window !== 'undefined') ? 'board_data' : null,
        fetcher,
        {
            refreshInterval: 5000,
            onSuccess: (newData) => {
                if (newData) {
                    setData(newData);
                    setIsConnected(true);
                    // SWR update also syncs settings
                    if (newData.voice_settings) {
                        setStoreSettings((prev: any) => ({ ...prev, ...newData.voice_settings }));
                    }
                }
            },
            onError: () => {
                setIsConnected(false);
            }
        }
    );

    // Initial load handling is done by SWR, but we rely on setData for the existing rendering logic
    // Using useEffect to sync SWR data to local state if needed, or refactor to use swrData directly.
    // existing rendering uses 'data' state.


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
                    {!isAudioEnabled && (
                        <button
                            onClick={enableAudio}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-bold animate-bounce shadow-lg hover:bg-blue-700 transition-colors"
                        >
                            <span>🔊</span>
                            <span>터치하여 음성 켜기</span>
                        </button>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                        {isConnected ? '연결됨' : '연결 끊김'}
                    </div>
                    <div className="text-2xl font-medium text-slate-500">
                        {data?.business_date ? new Date(data.business_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : ''}
                    </div>
                </div>
            </header>

            {/* Adjust grid columns based on both rows_per_class (internal card columns) AND actual class count */}
            <div className={`flex-1 grid gap-4 ${(data.rows_per_class || 1) >= 2
                ? `grid-cols-1 ${data.classes.length >= 2 ? 'lg:grid-cols-2' : ''}`
                : `grid-cols-1 ${data.classes.length === 2 ? 'md:grid-cols-2' :
                    data.classes.length === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
                        data.classes.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''
                }`
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
            {/* Audio Enable Overlay */}
            {/* Case 1: Big Overlay (Initial 3 seconds or until clicked) */}
            {!isAudioEnabled && showOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={enableAudio}>
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md cursor-pointer transform transition-transform hover:scale-105">
                        <div className="text-6xl mb-4">🔊</div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">음성 안내 시작하기</h2>
                        <p className="text-slate-600 mb-6">
                            원활한 음성 호출을 위해<br />화면을 한 번 터치해주세요.<br />
                            <span className="text-xs text-slate-400 font-normal mt-2 block">(3초 후 자동으로 닫힙니다)</span>
                        </p>
                        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-lg w-full">
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* Case 2: Persistent Mini-Button (If auto-enable failed and overlay closed) */}
            {!isAudioEnabled && !showOverlay && (
                <button
                    onClick={enableAudio}
                    className="fixed bottom-6 right-6 z-50 bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 hover:scale-110 transition-all animate-bounce flex items-center gap-2"
                    title="음성 안내 켜기"
                >
                    <span className="text-2xl">🔇</span>
                    <span className="font-bold text-sm whitespace-nowrap">소리 켜기</span>
                </button>
            )}
        </div>
    );
}
