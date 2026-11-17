from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.entities import VoiceHistory, Activity
from app.schemas.common import VoiceCommandRequest, VoiceCommandResponse
from app.voice.voice_service import voice_service

router = APIRouter(prefix="/voice", tags=["voice"])

@router.post("/process", response_model=VoiceCommandResponse)
def process_voice(req: VoiceCommandRequest, db: Session = Depends(get_db)):
    res = voice_service.process_voice_transcript(req.transcript)
    
    db.add(VoiceHistory(
        transcript=req.transcript,
        response=res.spoken_reply,
        intent=res.action_executed or "general"
    ))
    db.add(Activity(
        action_type="voice",
        description=f"Voice: '{req.transcript[:60]}' -> {res.action_executed or 'chat'}",
        result="success"
    ))
    db.commit()

    return res

@router.get("/history")
def get_voice_history(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(VoiceHistory).order_by(VoiceHistory.created_at.desc()).limit(limit).all()
