from fastapi import APIRouter, Request, Body, HTTPException
from typing import Dict, Any, Optional
from app.services.n8n_service import n8n_service

router = APIRouter(prefix="/n8n", tags=["n8n"])

@router.get("/status")
def get_n8n_status():
    """Returns n8n connectivity status, web UI link, and active triggers."""
    return n8n_service.get_status()

@router.get("/config")
def get_n8n_config():
    """Returns current n8n integration configuration."""
    return n8n_service.config

@router.post("/config")
def update_n8n_config(payload: Dict[str, Any] = Body(...)):
    """Updates n8n integration configuration (webhook URL, base URL, triggers)."""
    updated = n8n_service.save_config(payload)
    return {"success": True, "config": updated}

@router.post("/test-trigger")
def test_trigger(payload: Dict[str, Any] = Body(default={})):
    """Sends a test event to the configured n8n webhook."""
    event_type = payload.get("event", "test_ping")
    data = payload.get("data", {"message": "Hello from Smart Remote! n8n workflow test successfully dispatched."})
    n8n_service.dispatch_event(event_type, data)
    return {"success": True, "message": f"Dispatched '{event_type}' to n8n webhook."}

@router.post("/action")
def execute_n8n_action(payload: Dict[str, Any] = Body(...)):
    """
    Incoming webhook for n8n to execute smart actions on Kali Linux laptop:
    - lock_screen
    - screen_off
    - screen_on
    - set_volume
    - speak
    - cctv_snapshot
    - command
    """
    action = payload.get("action")
    if not action:
        raise HTTPException(status_code=400, detail="Missing 'action' parameter")
    params = payload.get("params", {})
    return n8n_service.execute_action(action, params)
