from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database import get_db
from app.models.entities import Setting

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("")
def get_all_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    res = {s.key: s.value for s in settings}
    defaults = {
        "device_name": "Kali Mobile Controller",
        "theme": "dark",
        "mouse_sensitivity": "1.0",
        "mouse_acceleration": "true",
        "dpad_speed": "20",
        "terminal_font_size": "14",
        "terminal_theme": "cyberpunk",
        "voice_wake_word": "hey kali",
        "voice_continuous": "false",
        "haptic_feedback": "true",
        "cloud_sync_auto": "true",
        "biometric_enabled": "false"
    }
    for k, v in defaults.items():
        if k not in res:
            res[k] = v
    return res

@router.post("")
def update_settings(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    for key, val in payload.items():
        s = db.query(Setting).filter(Setting.key == key).first()
        val_str = str(val)
        if s:
            s.value = val_str
        else:
            db.add(Setting(key=key, value=val_str))
    db.commit()
    return {"success": True}
