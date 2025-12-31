import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 0.5s silent MP3 (minimal size)
const SILENT_AUDIO_DATA_URI = 'data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQyAFRTU0UAAAAPAAADTGF2ZjU3LjU2LjEwMAAAAAAAAAAAAAAA//tQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAJAAAB3AAZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZ//tQZBQAABAAAAAAAAAAAAAAABAAAABAAAAAAAAAAAAAAABAAAAA==';

export const playSilentAudio = async () => {
  try {
    const audio = new Audio(SILENT_AUDIO_DATA_URI);
    audio.volume = 0.01; // Not completely 0 to ensure browser treats it as "audio"
    await audio.play();
    console.log('[Audio] Silent unlock audio played successfully');
    return true;
  } catch (error) {
    console.warn('[Audio] Failed to play silent unlock audio:', error);
    return false;
  }
};
