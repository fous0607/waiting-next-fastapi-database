import { useCallback, useEffect, useState, useRef } from 'react';

interface VoiceSettings {
    enable_waiting_voice_alert?: boolean;
    enable_calling_voice_alert?: boolean;
    waiting_voice_name?: string | null;
    waiting_voice_rate?: number;
    waiting_voice_pitch?: number;
    waiting_call_voice_repeat_count?: number;
    waiting_voice_message?: string | null;
    waiting_call_voice_message?: string | null;
    enable_duplicate_registration_voice?: boolean;
    duplicate_registration_voice_message?: string | null;
}

export function useVoiceAlert(settings: VoiceSettings | null) {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const isSpeakingRef = useRef(false);

    // Load and listen for voices
    useEffect(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
            console.log('[Voice] Voices loaded:', availableVoices.length);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    const speak = useCallback((text: string, options?: {
        rate?: number,
        pitch?: number,
        voiceName?: string | null,
        repeat?: number,
        cancelPrevious?: boolean
    }) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            console.warn('[Voice] SpeechSynthesis not available');
            return;
        }

        if (options?.cancelPrevious) {
            window.speechSynthesis.cancel();
        }

        console.log('[Voice] Speak called:', text, options);

        const rate = options?.rate ?? settings?.waiting_voice_rate ?? 1.0;
        const pitch = options?.pitch ?? settings?.waiting_voice_pitch ?? 1.0;
        const voiceName = options?.voiceName ?? settings?.waiting_voice_name;
        const repeatCount = options?.repeat ?? 1;

        // Find best voice
        const availableVoices = window.speechSynthesis.getVoices();
        const targetVoice =
            (voiceName ? availableVoices.find(v => v.name === voiceName) : null) ||
            availableVoices.find(v => v.lang.includes('ko-KR')) ||
            availableVoices.find(v => v.lang.includes('ko')) ||
            null;

        // Message preparation (Handling pauses marked by double spaces)
        const parts = text.split(/(\s{2,})/);

        const playMessage = () => {
            let offset = 0;
            parts.forEach((part) => {
                if (/^\s{2,}$/.test(part)) {
                    // Natural pause
                    const pauseSeconds = Math.floor(part.length / 2) * 0.5;
                    // We can't easily wait here in a non-async way without overlapping timers
                    // SpeechSynthesisUtterance doesn't have a built-in pause part
                    // So we use an empty utterance with duration if needed, or just let it be.
                    // For now, let's stick to simple queuing.
                } else if (part.trim()) {
                    const utterance = new SpeechSynthesisUtterance(part.trim());
                    utterance.lang = 'ko-KR';
                    utterance.rate = rate;
                    utterance.pitch = pitch;
                    if (targetVoice) utterance.voice = targetVoice;

                    window.speechSynthesis.speak(utterance);
                }
            });
        };

        // Handle Repeat
        for (let i = 0; i < repeatCount; i++) {
            playMessage();

            // Add a small pause between repeats if not the last one
            if (i < repeatCount - 1) {
                const pause = new SpeechSynthesisUtterance('  '); // Two spaces for a natural pause
                pause.volume = 0;
                pause.rate = 0.5; // Slower pause
                window.speechSynthesis.speak(pause);
            }
        }
    }, [settings]);

    const speakCall = useCallback((item: { class_order: number, display_name: string, class_name: string }) => {
        if (!settings?.enable_calling_voice_alert) {
            console.log('[Voice] Calling alert disabled in settings:', settings);
            return;
        }

        const template = settings?.waiting_call_voice_message || "{순번}번 {회원명}님, 데스크로 오시기 바랍니다.";
        const message = template
            .replace(/{순번}/g, item.class_order.toString())
            .replace(/{회원명}/g, item.display_name)
            .replace(/{클래스명}/g, item.class_name);

        speak(message, {
            repeat: settings?.waiting_call_voice_repeat_count || 1,
            cancelPrevious: true
        });
    }, [settings, speak]);

    const speakRegistration = useCallback((item: { class_name: string, display_name: string, class_order: number }) => {
        if (!settings?.enable_waiting_voice_alert) return;

        const template = settings?.waiting_voice_message || "{클래스명}  {회원명}님 대기 접수 되었습니다.";
        const message = template
            .replace(/{클래스명}/g, item.class_name)
            .replace(/{회원명}/g, item.display_name)
            .replace(/{순번}/g, item.class_order.toString());

        speak(message, { cancelPrevious: true });
    }, [settings, speak]);

    const speakDuplicate = useCallback(() => {
        if (!settings?.enable_duplicate_registration_voice) return;

        const message = settings?.duplicate_registration_voice_message || "이미 대기 중인 번호입니다.";
        speak(message, { cancelPrevious: true });
    }, [settings, speak]);

    return {
        speak,
        speakCall,
        speakRegistration,
        speakDuplicate,
        voices: voices.filter(v => v.lang.includes('ko')) // Expose Korean voices for UI
    };
}
