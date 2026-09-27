from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from app.database import get_db
from app.models.entities import Activity
from app.schemas.common import ActivityRead

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/list", response_model=List[ActivityRead])
def list_activities(
    limit: int = 50,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Activity)
    if action_type:
        query = query.filter(Activity.action_type == action_type)
    return query.order_by(Activity.timestamp.desc()).limit(limit).all()

@router.delete("/clear")
def clear_history(db: Session = Depends(get_db)):
    db.query(Activity).delete()
    db.commit()
    return {"success": True, "message": "History cleared"}

@router.get("/export")
def export_history(db: Session = Depends(get_db)):
    items = db.query(Activity).order_by(Activity.timestamp.desc()).all()
    return [
        {
            "id": i.id,
            "timestamp": i.timestamp.isoformat(),
            "action_type": i.action_type,
            "description": i.description,
            "result": i.result,
            "device_id": i.device_id
        }
        for i in items
    ]
