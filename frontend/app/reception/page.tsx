'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/api';
import { useWaitingStore } from '@/lib/store/useWaitingStore';
import { Delete, Check, AlertCircle, UserRound, Loader2 } from 'lucide-react';
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { useOperationLabels, type OperationType } from '@/hooks/useOperationLabels';

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
    is_business_hours?: boolean;
    is_break_time?: boolean;
    business_hours?: { start: string, end: string };
    break_time?: { enabled: boolean, start: string, end: string };
}


// Trigger Vercel Rebuild
export default function ReceptionPage() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [waitingStatus, setWaitingStatus] = useState<WaitingSlot | null>(null);
    const [storeName, setStoreName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [keypadStyle, setKeypadStyle] = useState('modern');
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [memberName, setMemberName] = useState('');

    const labels = useOperationLabels(storeSettings?.operation_type || 'general');

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
            const res = await api.get('/waiting/next-slot');
            console.log('[ReceptionStatus] Status response:', res.data);
            setWaitingStatus(res.data);
            if (res.data.voice_settings) {
                setStoreSettings((prev: any) => ({ ...prev, ...res.data.voice_settings }));
            }
        } catch (error) {
            console.error('[ReceptionStatus] Load failed:', error);
        }
    }, []);

    const loadStoreSettings = useCallback(async () => {
        try {
            const storeRes = await api.get('/store');
            const storeData = Array.isArray(storeRes.data) ? storeRes.data[0] : storeRes.data;
            setStoreName(storeData?.name || storeData?.store_name || '매장 정보 없음');
            if (storeData) {
                setStoreSettings(storeData);
                if (storeData.keypad_style) {
                    setKeypadStyle(storeData.keypad_style);
                }
            }
        } catch (error) {
            console.error('[ReceptionSettings] Load failed:', error);
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

    // SWR Polling Implementation
    const fetchStatusSWR = useCallback(async () => {
        const res = await api.get('/waiting/next-slot');
        return res.data;
    }, []);

    useSWR('reception_status', fetchStatusSWR, {
        refreshInterval: 5000,
        onSuccess: (data) => {
            setWaitingStatus(data);
            setIsConnected(true);
            if (data.voice_settings) {
                setStoreSettings((prev: any) => ({ ...prev, ...data.voice_settings }));
            }
        },
        onError: () => {
            setIsConnected(false);
        }
    });

    // Audio Context for Keypad Sounds
    const audioContextRef = useRef<AudioContext | null>(null);

    const playKeypadSound = useCallback((key: string = '0', actionType: 'number' | 'action' = 'number') => {
        // Initialize Audio Context on first interaction (User Gesture)
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            if (ctx.state === 'suspended') {
                ctx.resume().catch(e => console.warn('[Audio] Failed to resume context:', e));
            }

            // --- Voice Warmup ---
            // Critical: Ensure SpeechSynthesis is "woken up" inside a user gesture event
            // This prevents browsers from blocking subsequent async speak() calls
            if (!(window as any).__voiceWarmedUp && window.speechSynthesis) {
                console.log('[Audio] Warming up SpeechSynthesis engine...');
                (window as any).__voiceWarmedUp = true;
                window.speechSynthesis.cancel();
                const silentUtterance = new SpeechSynthesisUtterance(" ");
                silentUtterance.volume = 0;
                silentUtterance.rate = 10;
                window.speechSynthesis.speak(silentUtterance);
            }
        } catch (e) {
            console.warn('[Audio] Init failed:', e);
        }

        // Check Settings for Sound Effect
        // Forced to ALWAYS ON as per user request
        // if (storeSettings?.keypad_sound_enabled === false) return;

        try {
            const ctx = audioContextRef.current;
            if (!ctx) return;
            const now = ctx.currentTime;
            const soundType = storeSettings?.keypad_sound_type || 'button';

            if (soundType === 'modern') {
                // 현대적인 맑은 소리
                const baseFreq = actionType === 'action' ? 880 : 1200;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.06);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

                osc.start(now);
                osc.stop(now + 0.06);

            } else if (soundType === 'soft') {
                // 부드러운 버튼음 - 노년층, 편안한 느낌
                const baseFreq = actionType === 'action' ? 600 : 800;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sine';
                filter.type = 'lowpass';
                filter.frequency.value = 1200;
                filter.Q.value = 1;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.06);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

                osc.start(now);
                osc.stop(now + 0.06);

            } else if (soundType === 'atm') {
                // ATM/전화기 스타일 - 모든 연령대 익숙함
                const baseFreq = actionType === 'action' ? 941 : 697; // DTMF 주파수 기반

                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'sine';

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.frequency.value = baseFreq;
                osc2.frequency.value = baseFreq * 1.5;

                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.08);
                osc2.stop(now + 0.08);

            } else if (soundType === 'elevator') {
                // 엘리베이터 버튼음 - 친숙하고 명확함
                const baseFreq = 1800;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'square';
                filter.type = 'lowpass';
                filter.frequency.value = 3000;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(baseFreq, now);

                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

                osc.start(now);
                osc.stop(now + 0.04);

            } else if (soundType === 'touch') {
                // 터치스크린 피드백음 - 현대적, 스마트폰 세대
                const baseFreq = 2000;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.025);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.025);

                osc.start(now);
                osc.stop(now + 0.025);

            } else if (soundType === 'classic_beep') {
                // 전통적인 삐 소리 - 모든 연령대 보편적
                const baseFreq = actionType === 'action' ? 1000 : 1200;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = baseFreq;

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

                osc.start(now);
                osc.stop(now + 0.05);

            } else {
                // 기본 button 사운드
                const baseFreq = actionType === 'action' ? 1200 : 1500;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.03);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

                osc.start(now);
                osc.stop(now + 0.03);
            }

        } catch (e) {
            console.warn('Audio feedback failed:', e);
        }
    }, [storeSettings]);

    const speak = useCallback((text: string) => {

        if (typeof window === 'undefined' || !window.speechSynthesis) {
            console.error('[Voice] SpeechSynthesis API not available');
            return;
        }

        console.log('[Voice] Attempting to speak:', text);

        // 1. Cancel previous speech to reset state
        window.speechSynthesis.cancel();

        // 2. Prepare voices (handling async loading)
        let voices = window.speechSynthesis.getVoices();
        const speakWithVoice = () => {
            // Retry fetching voices if empty
            if (voices.length === 0) voices = window.speechSynthesis.getVoices();

            const selectedVoiceName = storeSettings?.waiting_voice_name;
            const targetVoice = voices.find(v => v.name === selectedVoiceName) || voices.find(v => v.lang === 'ko-KR') || null;

            console.log('[Voice] Selected voice:', targetVoice?.name || 'Default');

            // 3. Simple Queuing Strategy (Native)
            // Split by double spaces for natural pauses, but queue them natively
            const parts = text.split(/(\s{2,})/);

            parts.forEach((part) => {
                if (!part.trim()) return; // Skip empty/whitespace-only parts

                const utterance = new SpeechSynthesisUtterance(part.trim());
                utterance.lang = 'ko-KR';
                utterance.rate = storeSettings?.waiting_voice_rate || 1.0;
                utterance.pitch = storeSettings?.waiting_voice_pitch || 1.0;
                if (targetVoice) utterance.voice = targetVoice;

                utterance.onstart = () => console.log('[Voice] Started:', part.substring(0, 10) + '...');
                utterance.onerror = (e) => console.error('[Voice] Error:', e);

                window.speechSynthesis.speak(utterance);
            });
        };

        if (voices.length === 0) {
            console.log('[Voice] Voices not loaded yet, waiting for onvoiceschanged...');
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                speakWithVoice();
                // Remove listener to prevent memory leaks/multiple calls
                window.speechSynthesis.onvoiceschanged = null;
            };
            // Fallback: try anyway after small delay if event doesn't fire
            setTimeout(speakWithVoice, 500);
        } else {
            speakWithVoice();
        }
    }, [storeSettings]);

    const handleNumberClick = (num: string) => {
        if (phoneNumber.length >= 11) return;
        playKeypadSound(num, 'number');
        setPhoneNumber(prev => {
            const newVal = prev + num;
            return newVal;
        });
    };

    const handleBackspace = () => {
        playKeypadSound('back', 'action');
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        playKeypadSound('clear', 'action');
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

    // Timeout reference to clear existing timers
    const modalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const processRegistration = async (targetPhone: string, name?: string) => {
        setIsSubmitting(true);
        // Clear any existing modal close timers to prevent premature closing
        if (modalTimeoutRef.current) {
            clearTimeout(modalTimeoutRef.current);
            modalTimeoutRef.current = null;
        }

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

            // Speak success (Non-blocking)
            if (storeSettings?.enable_waiting_voice_alert) {
                setTimeout(() => {
                    const customMsg = storeSettings?.waiting_voice_message;
                    // Use data.name directly from response
                    const memberName = data.name || '';
                    const message = customMsg
                        ? customMsg
                            .replace('{클래스명}', data.class_name)
                            .replace('{순번}', data.class_order)
                            .replace('{회원명}', memberName)
                        : `${data.class_name} ${memberName ? memberName + '님 ' : ''}${data.class_order}번째 대기 접수 되었습니다.`;
                    speak(message);
                }, 0);
            }

            // Custom timeout from settings - Ensure it's a number
            // Force re-fetch from latest state or use passed settings
            let timeoutSeconds = 5;
            if (storeSettings?.waiting_modal_timeout !== undefined && storeSettings?.waiting_modal_timeout !== null) {
                timeoutSeconds = Number(storeSettings.waiting_modal_timeout);
            }

            console.log(`[Modal] Auto-close in ${timeoutSeconds} seconds (Setting: ${storeSettings?.waiting_modal_timeout})`);

            modalTimeoutRef.current = setTimeout(() => {
                setResultDialog(prev => ({ ...prev, open: false }));
            }, timeoutSeconds * 1000);

        } catch (error) {
            const err = error as any;
            const errorMessage = err.response?.data?.detail || '접수에 실패했습니다.';

            // Show large modal for Duplicate or Business Logic Errors (400)
            if (err.response?.status === 400 || errorMessage.includes('이미') || errorMessage.includes('대기')) {
                setErrorDialog({ open: true, message: errorMessage });

                // Duplicate/Business Login Error Voice Feedback
                if (storeSettings?.enable_duplicate_registration_voice) {
                    const duplicateMessage = storeSettings.duplicate_registration_voice_message || "이미 대기 중인 번호입니다.";
                    speak(duplicateMessage);
                }

                // Auto-close error dialog too
                const timeout = (storeSettings?.waiting_modal_timeout || 5) * 1000;
                if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current); // safe clear
                modalTimeoutRef.current = setTimeout(() => {
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
        playKeypadSound('submit', 'action'); // Special sound for submit

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

    // Check if reception desk is disabled
    if (storeSettings && storeSettings.enable_reception_desk === false) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-5xl mb-6">🚫</div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">대기접수 데스크 미사용</h1>
                <p className="text-slate-500 text-lg">
                    현재 매장에서 대기접수 데스크 기능을 사용하지 않도록 설정되어 있습니다.<br />
                    관리자 설정에서 '대기접수 데스크 사용'을 활성화해주세요.
                </p>
            </div>
        );
    }


    return (
        <>
            {/* =================================================================================
               TABLET / DESKTOP LAYOUT (Hidden on Mobile)
               - Existing layout preserved 100%
            ================================================================================= */}
            <div className={`hidden md:flex h-screen w-screen flex-col items-center transition-colors duration-300 overflow-hidden ${styles.container}`}>
                {/* Header */}
                <div className={`w-full h-[80px] px-8 flex flex-row items-center justify-between shrink-0 transition-colors duration-300 ${keypadStyle === 'dark' ? 'bg-slate-800 text-white border-b border-slate-700' : 'bg-white text-slate-900 shadow-sm z-10'}`}>
                    {/* Left: Connection Status */}
                    <div className="flex-1 flex items-center justify-start">
                        <div className={`flex items-center gap-2 text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'} animate-pulse`} />
                            {isConnected ? '시스템 정상 가동중' : '연결 끊김'}
                        </div>
                    </div>

                    {/* Center: Store Name */}
                    <div className="flex-[2] flex items-center justify-center">
                        <h1 className={`text-3xl font-black tracking-tight ${keypadStyle === 'dark' ? 'text-white' : 'text-slate-900'}`}>{storeName}</h1>
                    </div>

                    {/* Right: Business Date/Time */}
                    <div className="flex-1 flex flex-col items-end justify-center">
                        <div className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${keypadStyle === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Current Time</div>
                        <div className={`text-lg font-bold font-mono leading-none ${keypadStyle === 'dark' ? 'text-blue-400' : 'text-slate-700'}`}>
                            {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>

                {/* Main Content - Full Height & Centered */}
                <div className={`flex-1 w-full max-w-4xl p-8 flex flex-col justify-between items-center ${keypadStyle === 'dark' ? 'scrollbar-thin scrollbar-thumb-slate-700' : ''}`}>

                    {/* Status Message (Luxurious Style) */}
                    <div className="w-full flex flex-col items-center justify-center min-h-[120px] transition-all">
                        {waitingStatus?.is_full || waitingStatus?.is_business_hours === false || waitingStatus?.is_break_time === true ? (
                            <div className="text-center animate-in zoom-in duration-300">
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <span className="text-3xl font-bold text-red-600 block">
                                    {waitingStatus?.is_break_time ? (
                                        <>휴게 시간(Break Time)입니다<br /><span className="text-lg font-medium text-slate-500 mt-2 block font-sans">{waitingStatus.break_time?.end} 이후에 다시 시도해주세요</span></>
                                    ) : waitingStatus?.is_business_hours === false ? (
                                        <>{labels.classAction} 시간이 아닙니다<br /><span className="text-lg font-medium text-slate-500 mt-2 block font-sans">{labels.classAction}시간: {waitingStatus.business_hours?.start} ~ {waitingStatus.business_hours?.end}</span></>
                                    ) : (
                                        `현재 ${labels.registerLabel}가 마감되었습니다`
                                    )}
                                </span>
                            </div>
                        ) : (
                            <div className="text-center space-y-3">
                                <div className={`text-lg font-medium tracking-[0.2em] uppercase ${keypadStyle === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Current Waiting Status
                                </div>
                                <div className="relative inline-block">
                                    <span className={`text-4xl md:text-5xl font-black tracking-tight ${keypadStyle === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {waitingStatus ? `${waitingStatus.class_name}` : '...'}
                                    </span>
                                    <span className={`mx-4 text-3xl font-light ${keypadStyle === 'dark' ? 'text-slate-500' : 'text-slate-300'}`}>|</span>
                                    <span className="text-4xl md:text-5xl font-black text-blue-600">
                                        {waitingStatus ? `${waitingStatus.class_order}번째` : '...'}
                                    </span>
                                    <div className="text-xl md:text-2xl font-medium text-slate-400 mt-2 font-serif italic">
                                        {labels.registerLabel} 중입니다
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Interaction Area (Display + Keypad + Button) */}
                    <div className="w-full flex-1 flex flex-col gap-4 min-h-0 pt-4">
                        {/* Phone Display */}
                        <div className={`${styles.display} rounded-[2rem] h-[160px] flex flex-col items-center justify-center relative shadow-lg ring-1 ring-black/5 transition-all duration-300 shrink-0`}>
                            <div className={`text-6xl font-mono font-bold tracking-[0.15em] ${styles.displayText} ${phoneNumber.length === 4 ? '!text-blue-600' : ''}`}>
                                {formatDisplay(phoneNumber)}
                            </div>
                            <div className={`absolute bottom-6 text-lg font-bold ${styles.displayLabel} transition-all duration-300 ${phoneNumber.length === 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                뒷번호 4자리 조회
                            </div>

                        </div>

                        {/* Keypad Grid */}
                        <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
                            {numbers.map(num => (
                                <Button
                                    key={num}
                                    variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                                    className={`text-4xl md:text-5xl font-bold rounded-2xl h-full transition-all duration-100 active:scale-95 shadow-sm border-b-4 active:border-b-0 active:translate-y-1 ${styles.button}`}
                                    onClick={() => handleNumberClick(num)}
                                >
                                    {num}
                                </Button>
                            ))}
                            <Button
                                variant={keypadStyle === 'dark' ? 'ghost' : 'outline'}
                                className={`text-2xl font-bold rounded-2xl h-full transition-all duration-100 active:scale-95 shadow-sm ${styles.clearButton}`}
                                onClick={handleClear}
                            >
                                전체취소
                            </Button>
                            <Button
                                variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                                className={`text-4xl md:text-5xl font-bold rounded-2xl h-full transition-all duration-100 active:scale-95 shadow-sm border-b-4 active:border-b-0 active:translate-y-1 ${styles.button}`}
                                onClick={() => handleNumberClick('0')}
                            >
                                0
                            </Button>
                            <Button
                                variant={keypadStyle === 'dark' ? 'ghost' : 'outline'}
                                className={`rounded-2xl h-full transition-all duration-100 active:scale-95 shadow-sm ${styles.backButton}`}
                                onClick={handleBackspace}
                            >
                                <Delete className="w-10 h-10" />
                            </Button>
                        </div>

                        {/* Submit Button */}
                        <Button
                            className={`w-full h-[100px] text-4xl md:text-5xl font-black rounded-[2rem] shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-[0.98] shrink-0 mt-2 ${styles.submitButton}`}
                            size="lg"
                            disabled={isSubmitting || (waitingStatus?.is_full === true) || (waitingStatus?.is_business_hours === false) || (waitingStatus?.is_break_time === true)}
                            onClick={handleSubmit}
                        >
                            {isSubmitting ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>처리 중...</span>
                                </div>
                            ) : (
                                phoneNumber.length === 4 ? '회원 조회하기' : '대 기 접 수'
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* =================================================================================
               MOBILE LAYOUT (Visible only on small screens)
               - Optimized for vertical scrolling and touch
            ================================================================================= */}
            <div className={`flex md:hidden h-screen w-screen flex-col bg-slate-50 overflow-hidden ${styles.container}`}>
                {/* Mobile Header: Compact */}
                <div className={`w-full px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 relative ${keypadStyle === 'dark' ? 'bg-slate-800 text-white border-b border-slate-700' : 'bg-white text-slate-900'}`}>
                    {/* Left: Status */}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'} animate-pulse`} />
                        {isConnected ? '정상가동' : '연결끊김'}
                    </div>

                    {/* Center: Store Name */}
                    <h1 className={`text-xl font-bold truncate max-w-[200px] absolute left-1/2 -translate-x-1/2 ${keypadStyle === 'dark' ? 'text-white' : 'text-slate-900'}`}>{storeName}</h1>

                    {/* Right: Time */}
                    <div className={`text-sm font-mono font-bold ${keypadStyle === 'dark' ? 'text-blue-400' : 'text-slate-600'}`}>
                        {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                {/* Mobile Waiting Status Banner */}
                <div className="w-full bg-blue-600 text-white p-3 shrink-0 shadow-md">
                    {waitingStatus?.is_full ? (
                        <div className="flex items-center justify-center gap-2 animate-pulse">
                            <AlertCircle className="w-5 h-5 text-yellow-300" />
                            <span className="font-bold">접수 마감</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center px-2">
                            <div className="text-sm opacity-90 font-medium">현재 접수 현황</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold">{waitingStatus?.class_name || '...'}</span>
                                <span className="text-2xl font-black">{waitingStatus ? `${waitingStatus.class_order}팀` : '...'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Content Area */}
                <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">

                    {/* Display */}
                    <div className={`${styles.display} rounded-2xl h-[80px] flex items-center justify-center relative shadow-sm ring-1 ring-black/5 shrink-0`}>
                        <div className={`text-4xl font-mono font-bold tracking-widest ${styles.displayText} ${phoneNumber.length === 4 ? '!text-blue-600' : ''}`}>
                            {formatDisplay(phoneNumber)}
                        </div>

                    </div>

                    {/* Keypad */}
                    <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
                        {numbers.map(num => (
                            <Button
                                key={num}
                                variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                                className={`text-3xl font-bold rounded-xl h-full active:bg-slate-100 ${styles.button}`}
                                onClick={() => handleNumberClick(num)}
                            >
                                {num}
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            className={`text-lg font-bold rounded-xl h-full text-red-500 hover:bg-red-50 active:bg-red-100 ${styles.clearButton}`}
                            onClick={handleClear}
                        >
                            취소
                        </Button>
                        <Button
                            variant={keypadStyle === 'dark' ? 'secondary' : 'outline'}
                            className={`text-3xl font-bold rounded-xl h-full active:bg-slate-100 ${styles.button}`}
                            onClick={() => handleNumberClick('0')}
                        >
                            0
                        </Button>
                        <Button
                            variant="ghost"
                            className={`rounded-xl h-full text-slate-400 hover:bg-slate-100 active:bg-slate-200 ${styles.backButton}`}
                            onClick={handleBackspace}
                        >
                            <Delete className="w-8 h-8" />
                        </Button>
                    </div>

                    {/* Submit Button */}
                    <Button
                        className={`w-full h-[70px] text-2xl font-bold rounded-xl shadow-lg active:scale-[0.98] shrink-0 ${styles.submitButton}`}
                        disabled={isSubmitting || (waitingStatus?.is_full === true)}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (phoneNumber.length === 4 ? '조회' : `${labels.registerLabel}하기`)}
                    </Button>
                </div>
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
                                className="justify-between h-auto py-6 px-8 hover:bg-slate-50"
                                onClick={() => processRegistration(member.phone)}
                            >
                                <div className="flex items-center gap-6 w-full">
                                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100">
                                        <UserRound className="w-8 h-8 text-blue-600" strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 flex items-baseline justify-between gap-6">
                                        <span className="font-bold text-3xl">{member.name}</span>
                                        <span className="font-mono text-3xl font-black text-blue-600">
                                            {member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                                        </span>
                                    </div>
                                </div>
                                <div className="ml-8 text-right text-sm text-slate-400">
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
                            {/* Always show member name if available */}
                            {resultDialog.data?.name && (
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
        </>
    );
}
