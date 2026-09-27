from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.entities import AssistantHistory, CommandHistory, Shortcut, Activity
from app.schemas.common import (
    AssistantMessageRequest, AssistantMessageResponse,
    CommandExecuteRequest, CommandExecuteResponse, ShortcutCreate
)
from app.assistant.assistant_service import assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])

@router.post("/chat", response_model=AssistantMessageResponse)
def chat_with_assistant(req: AssistantMessageRequest, db: Session = Depends(get_db)):
    # Save user message
    db.add(AssistantHistory(role="user", content=req.message))
    db.commit()

    resp = assistant_service.process_message(req.message, req.context)

    # Save assistant response
    db.add(AssistantHistory(role="assistant", content=resp.reply))
    db.commit()

    return resp

@router.post("/execute", response_model=CommandExecuteResponse)
def execute_command(req: CommandExecuteRequest, db: Session = Depends(get_db)):
    res = assistant_service.execute_command(req.command, confirmed=req.confirmed)
    
    # Save in command history
    db.add(CommandHistory(
        command=req.command,
        output=res.stdout if res.exit_code == 0 else res.stderr,
        exit_code=res.exit_code,
        source="assistant"
    ))
    db.add(Activity(
        action_type="command",
        description=f"Executed: {req.command[:80]}",
        result="success" if res.exit_code == 0 else "failed"
    ))
    db.commit()

    return res

@router.get("/shortcuts")
def get_shortcuts(db: Session = Depends(get_db)):
    shortcuts = db.query(Shortcut).all()
    if not shortcuts:
        # Seed defaults
        defaults = [
            Shortcut(name="Quick System Check", icon="Activity", command="uptime && free -h && df -h /", category="diagnostics"),
            Shortcut(name="Network Status", icon="Wifi", command="ip -br a && ss -tuln", category="network"),
            Shortcut(name="Top Processes", icon="Cpu", command="ps aux --sort=-%cpu | head -n 10", category="diagnostics"),
            Shortcut(name="Disk Cleanup Check", icon="HardDrive", command="du -sh /home/aryan/* 2>/dev/null | sort -rh | head -n 10", category="maintenance"),
        ]
        db.add_all(defaults)
        db.commit()
        shortcuts = db.query(Shortcut).all()
    return shortcuts

@router.post("/shortcuts")
def create_shortcut(req: ShortcutCreate, db: Session = Depends(get_db)):
    sc = Shortcut(
        name=req.name,
        icon=req.icon,
        command=req.command,
        sequence=req.sequence,
        confirmation_required=req.confirmation_required,
        category=req.category
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc
