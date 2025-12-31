import os
import hashlib
from google.cloud import texttospeech
from core.logger import logger

# Directory for caching TTS files
TTS_CACHE_DIR = os.path.join("static", "audio", "tts_cache")

class TtsService:
    def __init__(self):
        self._client = None
    
    @property
    def client(self):
        if self._client is None:
            try:
                # Support for Serverless (Vercel): Load credentials from ENV string if file not found
                # Vercel doesn't let us upload secrets as files easily, but we can use ENV variables.
                google_creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
                if google_creds_json and "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ:
                    # Write to a temp file
                    import tempfile
                    # specific temp path or just generic
                    # Use /tmp for permission reasons in serverless
                    temp_cred_path = os.path.join(tempfile.gettempdir(), "google_credentials.json")
                    with open(temp_cred_path, "w") as f:
                        f.write(google_creds_json)
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_cred_path
                    logger.info(f"Created temporary credential file at {temp_cred_path} from ENV")

                self._client = texttospeech.TextToSpeechClient()
            except Exception as e:
                logger.error(f"Failed to initialize Google Cloud TTS client: {e}")
                # We don't raise here to allow app startup even if creds are missing (for dev/testing)
                pass
        return self._client

    async def synthesize_speech(self, text: str, voice_name: str = "ko-KR-Wavenet-A", rate: float = 1.0, pitch: float = 0.0) -> bytes:
        """
        Synthesizes speech from text using Google Cloud TTS.
        Returns the audio content as bytes directly.
        Caching is disabled for serverless compatibility.
        """
        if not self.client:
            logger.warning("TTS Client not available")
            raise Exception("Google Cloud TTS client not initialized. Check credentials.")

        # API Call
        input_text = texttospeech.SynthesisInput(text=text)
        
        # Voice Selection
        # Parse language code from voice name (e.g. "ko-KR-Wavenet-A" -> "ko-KR")
        lang_code = "-".join(voice_name.split("-")[:2])
        voice = texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=rate,
            pitch=pitch
        )

        try:
            response = self.client.synthesize_speech(
                input=input_text, voice=voice, audio_config=audio_config
            )
            # Return binary content directly
            return response.audio_content

        except Exception as e:
            logger.error(f"Error calling Google Cloud TTS API: {e}")
            raise e
