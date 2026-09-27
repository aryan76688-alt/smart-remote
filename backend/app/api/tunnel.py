import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from app.services.tunnel_manager import tunnel_manager

router = APIRouter(prefix="/tunnel", tags=["tunnel"])


class TunnelStartRequest(BaseModel):
    provider: str = "auto"
    custom_url: Optional[str] = None
    custom_token: Optional[str] = None


class TunnelRestartRequest(BaseModel):
    provider: Optional[str] = None


@router.get("/status")
def get_tunnel_status():
    return tunnel_manager.get_status()


@router.post("/start")
def start_tunnel(req: TunnelStartRequest):
    res = tunnel_manager.start(
        provider=req.provider,
        custom_url=req.custom_url,
        custom_token=req.custom_token
    )
    return res


@router.post("/stop")
def stop_tunnel():
    res = tunnel_manager.stop()
    return res


@router.post("/restart")
def restart_tunnel(req: Optional[TunnelRestartRequest] = None):
    p = req.provider if req else None
    res = tunnel_manager.restart(provider=p)
    return res


@router.get("/qr")
def get_qr_image():
    status = tunnel_manager.get_status()
    svg = status.get("qr_code_svg")
    if not svg:
        raise HTTPException(status_code=404, detail="No active tunnel URL or QR code available.")
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/ping")
def tunnel_ping():
    return {
        "pong": True,
        "timestamp": time.time(),
        "tunnel_active": tunnel_manager.status == "active",
        "public_url": tunnel_manager.public_url
    }
