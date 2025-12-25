'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/api';
import { useWaitingStore } from '@/lib/store/useWaitingStore';
import { Delete, Check, AlertCircle } from 'lucide-react';
import { GlobalLoader } from "@/components/ui/GlobalLoader";

interface Member {
    id: number;
    name: string;
    phone: string;
    last_visit_date?: string;
}

interface WaitingSlot {
    is_full: boolean;
    class_name?: string;
    class_order?: number;
}

export default function ReceptionPage() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [waitingStatus, setWaitingStatus] = useState<WaitingSlot | null>(null);
    const [storeName, setStoreName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [keypadStyle, setKeypadStyle] = useState('modern');
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [memberName, setMemberName] = useState('');

    // Result Modal State
    const [resultDialog, setResultDialog] = useState<{ open: boolean, data: any }>({ open: false, data: null });

    // Selection Modal State
    const [selectionDialog, setSelectionDialog] = useState<{ open: boolean, members: Member[] }>({ open: false, members: [] });

    // Error Modal State
    const [errorDialog, setErrorDialog] = useState<{ open: boolean, message: string }>({ open: false, message: '' });

    // Registration Modal State (New Member)
    const [registrationDialog, setRegistrationDialog] = useState<{ open: boolean, phone: string }>({ open: false, phone: '' });

    const loadStatus = useCallback(async () => {
        try {
            const [statusRes, storeRes] = await Promise.all([
                api.get('/waiting/next-slot'),
                api.get('/store')
            ]);

            console.log('[Reception] Status response:', statusRes.data);
            setWaitingStatus(statusRes.data);

            // Access store name safely (it can be an array from /api/store/)
            const storeData = Array.isArray(storeRes.data) ? storeRes.data[0] : storeRes.data;
            setStoreName(storeData?.name || storeData?.store_name || '매장 정보 없음');

            if (storeData) {
                setStoreSettings(storeData);
                if (storeData.keypad_style) {
                    setKeypadStyle(storeData.keypad_style);
                }
            }

        } catch (error) {
            console.error('[Reception] Initial load failed:', error);
            const err = error as any;
            if (err.response) {
                console.error('[Reception] Error response data:', err.response.data);
                console.error('[Reception] Error status:', err.response.status);
            }
        }
    }, []);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedLoadStatus = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            console.log('[ReceptionSSE] Debounced reload triggered');
            loadStatus();
            debounceTimerRef.current = null;
        }, 500); // 500ms debounce window
    }, [loadStatus]);

    // ... (polling useEffect using loadStatus directly is fine)

    const { setStoreId } = useWaitingStore();

    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Sync store ID from URL if present
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const storeId = params.get('store');
            if (storeId) {
                setStoreId(storeId);
            }
        }

        let isActive = true;
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            if (!isActive) return;
            // Only poll if NOT connected
            if (!isConnected) {
                await loadStatus();
                if (isActive) {
                    timeoutId = setTimeout(poll, 20000); // Very slow polling (20s) when disconnected
                }
            }
        };

        if (!isConnected) {
            poll();
        }

        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [loadStatus, setStoreId, isConnected]);

    // SSE Connection for Real-time Updates
    useEffect(() => {
        let es: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            let storeId = '1';
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                storeId = params.get('store') || '1';
            }

            const token = localStorage.getItem('access_token');
            const params = new URLSearchParams();
            params.append('store_id', storeId);
            params.append('role', 'reception'); // Explicitly set role as reception
            if (token) {
                params.append('token', token);
            }

            const url = `/api/sse/stream?${params.toString()}`;
            console.log(`[ReceptionSSE] Connecting to ${url}`);

            es = new EventSource(url);

            es.onopen = () => {
                console.log('[ReceptionSSE] Connected');
                setIsConnected(true);
                loadStatus();
            };

            es.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.event === 'ping') return;

                    switch (message.event) {
                        case 'new_user':
                        case 'status_changed':
                        case 'order_changed':
                        case 'class_closed':
                        case 'class_reopened':
                            debouncedLoadStatus();
                            break;
                    }
                } catch (e) {
                    console.error('[ReceptionSSE] Parse error', e);
                }
            };

            es.onerror = (err) => {
                console.error('[ReceptionSSE] Error', err);
                setIsConnected(false);
                if (es) es.close();

                // Reconnect logic
                reconnectTimeout = setTimeout(() => {
                    console.log('[ReceptionSSE] Attempting reconnect...');
                    connect();
                }, 3000);
            };
        };

        connect();

        return () => {
            if (es) es.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            setIsConnected(false);
        };
    }, [loadStatus, debouncedLoadStatus]);

    // Audio Context for Keypad Sounds
    const audioContextRef = useRef<AudioContext | null>(null);

    const playKeypadSound = useCallback((type: string = 'beep') => {
        // 기본값은 true (설정이 없거나 명시적으로 false일 때만 비활성화)
        console.log('[Keypad Sound] enabled:', storeSettings?.keypad_sound_enabled, 'type:', storeSettings?.keypad_sound_type || type);
        if (storeSettings?.keypad_sound_enabled === false) return;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            // Sound Profiles
            const soundType = storeSettings?.keypad_sound_type || type;

            if (soundType === 'click') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (soundType === 'ping') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else { // default 'beep'
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            }
        } catch (e) {
            console.warn('Audio feedback failed:', e);
        }
    }, [storeSettings]);

    const speak = useCallback((text: string) => {
        if (!storeSettings?.enable_waiting_voice_alert) return;
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        // Cancel previous speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = storeSettings?.waiting_voice_rate || 1.0;
        utterance.pitch = storeSettings?.waiting_voice_pitch || 1.0;

        // Optionally select voice if configured (currently not UI exposed but in schema)
        if (storeSettings?.waiting_voice_name) {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.name === storeSettings.waiting_voice_name);
            if (voice) utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    }, [storeSettings]);

    const handleNumberClick = (num: string) => {
        if (phoneNumber.length >= 11) return;
        playKeypadSound();
        setPhoneNumber(prev => {
            const newVal = prev + num;
            return newVal;
        });
    };

    const handleBackspace = () => {
        playKeypadSound('click');
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        playKeypadSound('click');
        setPhoneNumber('');
    };

    const formatDisplay = (num: string) => {
        if (!num) return '010-____-____';

        let formatted = num;
        if (num.length === 4) {
            return num; // Show just 4 digits if length is 4
        }
        if (num.startsWith('010')) {
            if (num.length > 7) {
                formatted = num.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
            } else if (num.length > 3) {
                formatted = num.replace(/(\d{3})(\d{1,4})/, '$1-$2');
            }
        }
        return formatted;
    };

    const processRegistration = async (targetPhone: string, name?: string) => {
        setIsSubmitting(true);
        try {
            const payload: any = { phone: targetPhone };
            if (name) payload.name = name;

            const { data } = await api.post('/waiting/register', payload);
            setResultDialog({ open: true, data });
            setPhoneNumber('');
            setMemberName(''); // Clear member name
            setSelectionDialog({ open: false, members: [] }); // Close selection if open
            setRegistrationDialog({ open: false, phone: '' }); // Close registration if open
            loadStatus();

            // Speak success
            if (storeSettings?.enable_waiting_voice_alert) {
                const customMsg = storeSettings?.waiting_voice_message;
                const memberName = data.name || '';
                const message = customMsg
                    ? customMsg
                        .replace('{클래스명}', data.class_name)
                        .replace('{순번}', data.class_order)
                        .replace('{회원명}', memberName)
                    : `${data.class_name} ${memberName ? memberName + '님 ' : ''}${data.class_order}번째 대기 접수 되었습니다.`;
                speak(message);
            }

            // Custom timeout from settings
            const timeout = (storeSettings?.waiting_modal_timeout || 5) * 1000;
            setTimeout(() => {
                setResultDialog(prev => ({ ...prev, open: false }));
            }, timeout);

        } catch (error) {
            const err = error as any;
            const errorMessage = err.response?.data?.detail || '접수에 실패했습니다.';

            // Show large modal for Duplicate or Business Logic Errors (400)
            if (err.response?.status === 400 || errorMessage.includes('이미') || errorMessage.includes('대기')) {
                setErrorDialog({ open: true, message: errorMessage });

                // Auto-close after 5 seconds
                const timeout = (storeSettings?.waiting_modal_timeout || 5) * 1000;
                setTimeout(() => {
                    setErrorDialog(prev => ({ ...prev, open: false }));
                }, timeout);
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!phoneNumber) return;
        playKeypadSound('ping'); // Special sound for submit

        // 1. 4-Digit Logic (Member Lookup)
        if (phoneNumber.length === 4) {
            setIsSubmitting(true);
            try {
                // Search for members ending with these 4 digits
                const { data } = await api.get('/members', { params: { search: phoneNumber } });

                if (data.length === 0) {
                    toast.error('회원을 찾을 수 없습니다. 전체 번호를 입력해주세요.');
                    setIsSubmitting(false);
                    return;
                }

                if (data.length === 1) {
                    // Single match - Auto register
                    const member = data[0];
                    toast.info(`${member.name}님으로 접수합니다.`);
                    await processRegistration(member.phone);
                } else {
                    // Multiple matches - Show selection
                    setSelectionDialog({ open: true, members: data });
                    setIsSubmitting(false);
                }
            } catch (error) {
                console.error("Search Error:", error);
                toast.error("회원 조회 중 오류가 발생했습니다.");
                setIsSubmitting(false);
            }
            return;
        }

        // 2. Full Number Logic (Existing/New)
        let targetPhone = phoneNumber;
        if (phoneNumber.startsWith('010')) {
            if (phoneNumber.length !== 11) {
                toast.error('전체 핸드폰 번호 11자리를 입력해주세요.');
                return;
            }
        } else if (phoneNumber.length === 8) {
            targetPhone = '010' + phoneNumber;
        } else {
            toast.error('올바른 번호를 입력해주세요. (뒷 4자리 또는 전체 번호)');
            return;
        }

        // 3. New Member Check
        if (storeSettings?.require_member_registration) {
            try {
                // Check if member already exists
                await api.get(`/members/phone/${targetPhone}`);
                // If exists (no error), proceed normally
                await processRegistration(targetPhone);
            } catch (error: any) {
                if (error.response?.status === 404) {
                    // Not found -> Show registration screen
                    setRegistrationDialog({ open: true, phone: targetPhone });
                } else {
                    toast.error("회원 조회 중 오류가 발생했습니다.");
                }
            }
        } else {
            await processRegistration(targetPhone);
        }
    };

    // Helper to get styles based on configuration
    const getKeypadStyles = (style: string) => {
        switch (style) {
            case 'bold': // High Contrast / Elderly Friendly
                return {
                    container: "bg-white",
                    display: "bg-white border-4 border-black text-black font-black",
                    displayText: "text-slate-900",
                    button: "bg-white border-4 border-slate-900 text-slate-900 hover:bg-slate-100 active:bg-slate-900 active:text-white",
                    clearButton: "bg-white border-4 border-red-600 text-red-600 hover:bg-red-50 active:bg-red-600 active:text-white",
                    backButton: "bg-white border-4 border-slate-500 text-slate-500 hover:bg-slate-50 active:bg-slate-500 active:text-white",
                    submitButton: "bg-blue-600 border-4 border-blue-800 text-white hover:bg-blue-700 active:bg-blue-800",
                    displayLabel: "text-slate-900 font-bold"
                };
            case 'dark': // Dark Mode feel
                return {
                    container: "bg-slate-900",
                    display: "bg-slate-800 border border-slate-700 text-white",
                    displayText: "text-white",
                    button: "bg-slate-800 border-slate-700 text-white hover:bg-slate-700 active:bg-slate-600",
                    clearButton: "bg-red-900/20 border-red-900/50 text-red-400 hover:bg-red-900/30 active:bg-red-900/40",
                    backButton: "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 active:bg-slate-600",
                    submitButton: "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 border-none",
                    displayLabel: "text-slate-400"
                };
            case 'colorful': // Playful
                return {
                    container: "bg-slate-50",
                    display: "bg-white border-2 border-indigo-100 text-indigo-900 shadow-sm",
                    displayText: "text-indigo-950",
                    button: "bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 shadow-sm",
                    clearButton: "bg-white border-2 border-pink-100 text-pink-500 hover:bg-pink-50 active:bg-pink-100 shadow-sm",
                    backButton: "bg-white border-2 border-slate-200 text-slate-400 hover:bg-slate-50 active:bg-slate-100 shadow-sm",
                    submitButton: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] border-none",
                    displayLabel: "text-indigo-400"
                };
            case 'modern':
            default: // Default minimalist
                return {
                    container: "bg-slate-50",
                    display: "bg-white border border-slate-200 text-slate-800 shadow-sm",
                    displayText: "text-slate-800",
                    button: "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-200 shadow-sm",
                    clearButton: "bg-red-50 border-red-100 text-red-500 hover:bg-red-100 active:bg-red-200 shadow-sm",
                    backButton: "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 active:bg-slate-200 shadow-sm",
                    submitButton: "bg-slate-900 text-white shadow-lg hover:bg-slate-800 active:scale-[0.98]",
                    displayLabel: "text-blue-500"
                };
        }
    };

    const styles = getKeypadStyles(keypadStyle);

    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    if (!waitingStatus) {
        return <GlobalLoader message="접수 시스템 로딩 중..." />;
    }

    return (
        <div className={`min-h-screen flex flex-col items-center transition-colors duration-300 ${styles.container}`}>
            {/* Header */}
            <div className={`${keypadStyle === 'dark' ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900'} w-full p-6 shadow-sm flex justify-between items-center transition-colors duration-300`}>
                <div className="flex flex-col gap-1">
                    <div className="text-xl font-bold">{storeName}</div>
                    <div className={`flex items-center gap-2 text-xs font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
                        {isConnected ? '연결됨' : '연결 끊김'}
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm ${keypadStyle === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>현재 접수 현황</div>
                    <div className={`font-bold text-lg ${waitingStatus?.is_full ? 'text-red-600' : (keypadStyle === 'dark' ? 'text-blue-400' : 'text-blue-600')}`}>
                        {waitingStatus ? (
                            waitingStatus.is_full ? '접수 마감' : `${waitingStatus.class_name} ${waitingStatus.class_order}번째`
                        ) : '로딩 중...'}
                    </div>
                </div>
            </div>

            <div className={`flex-1 w-full max-w-3xl p-6 flex flex-col justify-center overflow-y-auto ${keypadStyle === 'dark' ? 'scrollbar-thin scrollbar-thumb-slate-700' : ''}`}>
                {/* Display */}
                <div className={`${styles.display} rounded-3xl p-8 mb-6 text-center transition-all duration-300 min-h-[140px] flex flex-col justify-center`}>
                    <div className={`text-5xl font-mono font-bold tracking-widest h-16 flex items-center justify-center ${styles.displayText} ${phoneNumber.length === 4 ? '!text-blue-600' : ''}`}>
                        {formatDisplay(phoneNumber)}
                    </div>
                    <div className={`text-xl mt-2 font-bold ${styles.displayLabel} transition-opacity duration-200 ${phoneNumber.length === 4 ? 'opacity-100' : 'opacity-0'}`}>
                        뒷번호 4자리 조회
                    </div>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {numbers.map(num => (
                        <Button
                            key={num}
                            variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                            className={`h-24 text-4xl font-bold rounded-2xl transition-all duration-100 active:scale-95 ${styles.button}`}
                            onClick={() => handleNumberClick(num)}
                        >
                            {num}
                        </Button>
                    ))}
                    <Button
                        variant={keypadStyle === 'dark' ? 'ghost' : 'outline'}
                        className={`h-24 text-2xl font-bold rounded-2xl transition-all duration-100 active:scale-95 ${styles.clearButton}`}
                        onClick={handleClear}
                    >
                        전체취소
                    </Button>
                    <Button
                        variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                        className={`h-24 text-4xl font-bold rounded-2xl transition-all duration-100 active:scale-95 ${styles.button}`}
                        onClick={() => handleNumberClick('0')}
                    >
                        0
                    </Button>
                    <Button
                        variant={keypadStyle === 'dark' ? 'ghost' : 'outline'}
                        className={`h-24 font-bold rounded-2xl transition-all duration-100 active:scale-95 ${styles.backButton}`}
                        onClick={handleBackspace}
                    >
                        <Delete className="w-12 h-12" />
                    </Button>
                </div>

                {/* Submit */}
                <Button
                    className={`w-full h-24 text-3xl font-bold rounded-3xl transition-all ${styles.submitButton}`}
                    size="lg"
                    disabled={isSubmitting || (waitingStatus?.is_full === true)}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? '처리 중...' : (phoneNumber.length === 4 ? '회원 조회' : '대기 접수')}
                </Button>
            </div>

            {/* Selection Modal (Multiple Candidates) */}
            <Dialog open={selectionDialog.open} onOpenChange={(open) => setSelectionDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>회원 선택</DialogTitle>
                        <DialogDescription>
                            같은 번호의 회원이 여러 명입니다. 접수할 회원을 선택해주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 max-h-[60vh] overflow-y-auto py-2">
                        {selectionDialog.members.map((member) => (
                            <Button
                                key={member.id}
                                variant="outline"
                                className="justify-between h-auto py-4 px-6"
                                onClick={() => processRegistration(member.phone)}
                            >
                                <div className="flex flex-col items-start gap-1">
                                    <span className="font-bold text-lg">{member.name}</span>
                                    <span className="text-sm text-slate-500">{member.phone}</span>
                                </div>
                                <div className="text-right text-xs text-slate-400">
                                    최근방문: {member.last_visit_date || '-'}
                                </div>
                            </Button>
                        ))}
                    </div>
                    <Button variant="ghost" onClick={() => setSelectionDialog(prev => ({ ...prev, open: false }))}>
                        취소
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Success Modal */}
            <Dialog open={resultDialog.open} onOpenChange={(open) => setResultDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md text-center py-10">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-10 h-10" />
                        </div>
                        <DialogTitle className="text-center text-4xl font-bold mb-4">접수 완료</DialogTitle>
                        <DialogDescription className="text-center text-2xl text-slate-600 mb-8 font-normal leading-relaxed">
                            <span className="block text-5xl text-blue-600 font-black mb-4 mt-2">
                                {resultDialog.data?.class_name} {resultDialog.data?.class_order}번째
                                {resultDialog.data?.is_new_member && storeSettings?.show_new_member_text_in_waiting_modal && (
                                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-base font-bold text-blue-700 align-middle">
                                        신규고객
                                    </span>
                                )}
                            </span>
                            {storeSettings?.show_member_name_in_waiting_modal && resultDialog.data?.name && (
                                <span className="block text-3xl text-slate-900 font-bold mb-4">
                                    {resultDialog.data.name}님
                                </span>
                            )}
                            대기 접수가 완료되었습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <Button className="w-full h-20 text-3xl rounded-2xl" size="lg" onClick={() => setResultDialog(prev => ({ ...prev, open: false }))}>
                        확인
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Error Modal */}
            <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md text-center py-10">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <DialogTitle className="text-center text-2xl font-bold mb-2 text-red-600">접수 실패</DialogTitle>
                        <DialogDescription className="text-center text-xl text-slate-800 mb-6 font-bold">
                            {errorDialog.message}
                        </DialogDescription>
                    </DialogHeader>
                    <Button
                        className="w-full bg-slate-200 text-slate-800 hover:bg-slate-300"
                        size="lg"
                        onClick={() => setErrorDialog(prev => ({ ...prev, open: false }))}
                    >
                        확인
                    </Button>
                </DialogContent>
            </Dialog>
            {/* Member Registration Modal (Forced) */}
            <Dialog open={registrationDialog.open} onOpenChange={(open) => {
                if (!open) {
                    setRegistrationDialog(prev => ({ ...prev, open }));
                    setMemberName('');
                }
            }}>
                <DialogContent className="sm:max-w-md text-center py-10">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-10 h-10" />
                        </div>
                        <DialogTitle className="text-center text-3xl font-bold mb-2">신규 회원 등록</DialogTitle>
                        <DialogDescription className="text-center text-xl text-slate-600 mb-6 font-normal whitespace-pre-line">
                            {storeSettings?.registration_message || "처음 방문하셨네요!\n성함을 입력해 주세요."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 mb-6">
                        <input
                            type="text"
                            placeholder="이름 입력 (예: 홍길동)"
                            value={memberName}
                            onChange={(e) => setMemberName(e.target.value)}
                            className="w-full h-20 text-3xl px-6 rounded-2xl border-2 border-blue-200 focus:border-blue-500 focus:outline-none transition-all text-center"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && memberName.trim()) {
                                    processRegistration(registrationDialog.phone, memberName);
                                }
                            }}
                        />
                    </div>

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            className="flex-1 h-20 text-2xl rounded-2xl"
                            size="lg"
                            onClick={() => setRegistrationDialog({ open: false, phone: '' })}
                        >
                            취소
                        </Button>
                        <Button
                            className="flex-[2] h-20 text-3xl rounded-2xl bg-blue-600 hover:bg-blue-700"
                            size="lg"
                            disabled={!memberName.trim() || isSubmitting}
                            onClick={() => processRegistration(registrationDialog.phone, memberName)}
                        >
                            {isSubmitting ? '저장 중...' : '등록 완료'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
