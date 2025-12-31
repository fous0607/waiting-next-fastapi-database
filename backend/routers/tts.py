from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.tts_service import TtsService

router = APIRouter()
tts_service = TtsService()

class TtsRequest(BaseModel):
    text: str
    voice_name: Optional[str] = "ko-KR-Wavenet-B" # Default to a male voice like waiting board often uses, or generic
    rate: Optional[float] = 1.0
    pitch: Optional[float] = 0.0

from fastapi import Response

@router.post("/speak")
async def generate_speech(request: TtsRequest):
    try:
        audio_content = await tts_service.synthesize_speech(
            text=request.text,
            voice_name=request.voice_name,
            rate=request.rate,
            pitch=request.pitch
        )
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
