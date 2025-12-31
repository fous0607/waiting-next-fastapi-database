import { useCallback, useState } from 'react';
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

const CLOUD_TTS_VOICES = [
    { name: "ko-KR-Wavenet-A", displayName: "여성 1 (차분한 뉴스 앵커 톤)" },
    { name: "ko-KR-Wavenet-B", displayName: "여성 2 (부드러운 상담원 톤)" },
    { name: "ko-KR-Wavenet-C", displayName: "남성 1 (굵고 신뢰감 있는 톤)" },
    { name: "ko-KR-Wavenet-D", displayName: "남성 2 (명쾌하고 젊은 톤)" },
];

export function useVoiceAlert(settings: VoiceSettings | null) {
    // Return static list of Cloud TTS voices
    const voices = CLOUD_TTS_VOICES;

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
        let voiceName = options?.voiceName ?? settings?.waiting_voice_name;

        // Ensure we have a valid Cloud TTS ID
        const isValidVoice = CLOUD_TTS_VOICES.some(v => v.name === voiceName);
        if (!isValidVoice) {
            // Fallback logic for legacy settings
            if (voiceName?.includes('Male') || voiceName?.includes('남성')) {
                voiceName = "ko-KR-Wavenet-C";
            } else {
                voiceName = "ko-KR-Wavenet-B";
            }
        }

        const rate = options?.rate ?? settings?.waiting_voice_rate ?? 1.1;
        const pitch = options?.pitch ?? settings?.waiting_voice_pitch ?? 0.0;
        const repeatCount = options?.repeat ?? 1;

        console.log('[Cloud TTS] Requesting:', { text: textToSpeech, voiceName, rate, pitch });

        const playAudio = async () => {
            try {
                // Request binary data (blob)
                const response = await api.post('/tts/speak', {
                    text: textToSpeech,
                    voice_name: voiceName,
                    rate: rate,
                    pitch: pitch
                }, {
                    responseType: 'blob'
                });

                if (response.data) {
                    // Create a blob URL from the binary response
                    const audioUrl = URL.createObjectURL(response.data);
                    console.log('[Cloud TTS] Playing Blob URL:', audioUrl);

                    const audio = new Audio(audioUrl);
                    await audio.play();

                    return new Promise((resolve) => {
                        audio.onended = () => {
                            // Clean up blob URL to avoid memory leaks
                            URL.revokeObjectURL(audioUrl);
                            resolve(null);
                        };
                        audio.onerror = (e) => {
                            console.error('[Cloud TTS] Audio playback error:', e);
                            URL.revokeObjectURL(audioUrl);
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
        voices: voices
    };
}
