from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import time
from app.database import get_db
from app.models.entities import Device
from app.schemas.common import DeviceRead, DeviceUpdate
from app.system.monitor import system_monitor

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("/current")
def get_current_device(db: Session = Depends(get_db)):
    info = system_monitor.get_info()
    device = db.query(Device).filter(Device.hostname == info.hostname).first()
    if not device:
        device = Device(
            name="Kali Remote Host",
            hostname=info.hostname,
            ip_address=info.local_ip,
            tailscale_ip=info.tailscale_ip,
            os_info=info.os_name,
            kernel=info.kernel_version,
            is_favorite=True
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    return device

@router.get("/list", response_model=List[DeviceRead])
def list_devices(db: Session = Depends(get_db)):
    get_current_device(db) # ensure current is synced
    return db.query(Device).all()

@router.post("/ping")
def ping_device():
    return {
        "status": "online",
        "timestamp": time.time(),
        "tailscale": "connected"
    }

@router.put("/{device_id}", response_model=DeviceRead)
def update_device(device_id: int, req: DeviceUpdate, db: Session = Depends(get_db)):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if req.name is not None:
        dev.name = req.name
    if req.is_favorite is not None:
        dev.is_favorite = req.is_favorite
    db.commit()
    db.refresh(dev)
    return dev
