import { useCallback, useEffect, useState, useRef } from 'react';
import api from '@/lib/api';

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
    // Keep this for UI compatibility if needed, but we don't really select browser voices anymore
    const [voices, setVoices] = useState<any[]>([]);

    // We still preload "voices" mock to not break settings page logic if it relies on this hook
    // But for playback we use Cloud TTS.

    const speak = useCallback(async (text: string, options?: {
        rate?: number,
        pitch?: number,
        voiceName?: string | null,
        repeat?: number,
        cancelPrevious?: boolean
    }) => {
        const textToSpeech = text.trim();
        if (!textToSpeech) return;

        // 1. Prepare Params
        // Wavenet voices: ko-KR-Wavenet-A (Female), B (Female), C (Male), D (Male)
        // Default to a professional WaveNet voice
        const voiceName = options?.voiceName ?? settings?.waiting_voice_name ?? "ko-KR-Wavenet-C";
        const rate = options?.rate ?? settings?.waiting_voice_rate ?? 1.2; // Slightly faster default
        const pitch = options?.pitch ?? settings?.waiting_voice_pitch ?? 0.0;
        const repeatCount = options?.repeat ?? 1;

        console.log('[Cloud TTS] Requesting:', { text: textToSpeech, voiceName, rate, pitch });

        const playAudio = async () => {
            try {
                const response = await api.post('/tts/speak', {
                    text: textToSpeech,
                    voice_name: voiceName,
                    rate: rate,
                    pitch: pitch
                });

                if (response.data && response.data.audio_url) {
                    const audioUrl = response.data.audio_url;
                    // Prepend API base URL if relative path
                    // api.js usually handles base URL but returned URL is relative static path
                    // We need full URL or relative to public. 
                    // Since it's /static/..., browser can resolve it relative to domain root.
                    // But we might be on a different port in dev (3000 vs 8000).
                    // api.defaults.baseURL is usually 'http://localhost:8088/api/v1' or similar.
                    // We need the root backend URL.

                    // Simple heuristic: attach backend origin
                    const backendOrigin = api.defaults.baseURL ? new URL(api.defaults.baseURL).origin : '';
                    const fullUrl = `${backendOrigin}${audioUrl}`;

                    console.log('[Cloud TTS] Playing URL:', fullUrl);

                    const audio = new Audio(fullUrl);
                    await audio.play();

                    return new Promise((resolve) => {
                        audio.onended = resolve;
                        audio.onerror = (e) => {
                            console.error('[Cloud TTS] Audio playback error:', e);
                            resolve(null);
                        }
                    });
                }
            } catch (error) {
                console.error('[Cloud TTS] Failed to fetch or play speech:', error);
            }
        };

        // Handle Repeat
        for (let i = 0; i < repeatCount; i++) {
            await playAudio();
            // Small pause between repeats
            if (i < repeatCount - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

    }, [settings]);

    const speakCall = useCallback((item: { class_order: number, display_name: string, class_name: string }) => {
        if (!settings?.enable_calling_voice_alert) return;

        const template = settings?.waiting_call_voice_message || "{순번}번 {회원명}님, 데스크로 오시기 바랍니다.";
        const message = template
            .replace(/{순번}/g, item.class_order.toString())
            .replace(/{회원명}/g, item.display_name)
            .replace(/{클래스명}/g, item.class_name);

        speak(message, {
            repeat: settings?.waiting_call_voice_repeat_count || 1,
            // Voice selection can be customized per type logic here if needed
            // Use "ko-KR-Wavenet-B" (Female) for calls? or C (Male)? 
            // Let's use what's passed or default in speak()
        });
    }, [settings, speak]);

    const speakRegistration = useCallback((item: { class_name: string, display_name: string, class_order: number }) => {
        if (!settings?.enable_waiting_voice_alert) return;

        const template = settings?.waiting_voice_message || "{클래스명}  {회원명}님 대기 접수 되었습니다.";
        const message = template
            .replace(/{클래스명}/g, item.class_name)
            .replace(/{회원명}/g, item.display_name)
            .replace(/{순번}/g, item.class_order.toString());

        speak(message);
    }, [settings, speak]);

    const speakDuplicate = useCallback(() => {
        if (!settings?.enable_duplicate_registration_voice) return;
        const message = settings?.duplicate_registration_voice_message || "이미 대기 중인 번호입니다.";
        speak(message);
    }, [settings, speak]);

    return {
        speak,
        speakCall,
        speakRegistration,
        speakDuplicate,
        voices: [] as { name: string; lang: string }[] // Return empty typed array to satisfy TS in Settings
    };
}
