import json
import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import Setting, Shortcut, RemoteProfile, CommandHistory, VoiceHistory

class SyncService:
    def export_backup_data(self, db: Session) -> Dict[str, Any]:
        settings = db.query(Setting).all()
        shortcuts = db.query(Shortcut).all()
        profiles = db.query(RemoteProfile).all()
        
        # Non-sensitive export only
        data = {
            "version": "1.0",
            "exported_at": datetime.datetime.utcnow().isoformat(),
            "settings": [{"key": s.key, "value": s.value, "category": s.category} for s in settings if "secret" not in s.key.lower()],
            "shortcuts": [{"name": sc.name, "icon": sc.icon, "command": sc.command, "category": sc.category} for sc in shortcuts],
            "profiles": [{"name": p.name, "layout_config": p.layout_config, "is_default": p.is_default} for p in profiles],
        }
        return data

    def import_backup_data(self, db: Session, data: Dict[str, Any]) -> bool:
        if "shortcuts" in data:
            for sc in data["shortcuts"]:
                existing = db.query(Shortcut).filter(Shortcut.name == sc["name"]).first()
                if not existing:
                    db.add(Shortcut(
                        name=sc["name"],
                        icon=sc.get("icon", "Zap"),
                        command=sc.get("command"),
                        category=sc.get("category", "custom")
                    ))
        if "settings" in data:
            for s in data["settings"]:
                if "secret" not in s["key"].lower():
                    setting = db.query(Setting).filter(Setting.key == s["key"]).first()
                    if setting:
                        setting.value = s["value"]
                    else:
                        db.add(Setting(key=s["key"], value=s["value"], category=s.get("category", "general")))
        db.commit()
        return True

sync_service = SyncService()
