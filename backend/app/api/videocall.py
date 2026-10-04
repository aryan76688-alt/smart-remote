import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Set, Optional, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse

from app.database import SessionLocal
from app.models.entities import VideoCallSessionEntity

router = APIRouter(prefix="/call", tags=["videocall"])

class CallManager:
    def __init__(self):
        # Active connections mapped by connection id: { "ws": WebSocket, "role": "mobile"|"laptop", "device_id": str }
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.current_call: Optional[Dict[str, Any]] = None

    async def connect(self, ws: WebSocket, role: str, device_id: str) -> str:
        await ws.accept()
        conn_id = str(uuid.uuid4())
        self.active_connections[conn_id] = {
            "ws": ws,
            "role": role,
            "device_id": device_id
        }
        print(f"[CALL-WS] Client connected: {role} ({device_id}), total clients: {len(self.active_connections)}")

        # If a call is currently ringing/active and this client matches the target role, replay call invite & offer
        if self.current_call and self.current_call.get("status") in ("ringing", "connected"):
            if self.current_call.get("target_role") == role:
                print(f"[CALL-WS] Replaying active call invitation to newly joined {role}")
                try:
                    await ws.send_text(json.dumps({
                        "type": "incoming_call",
                        "session_id": self.current_call["session_id"],
                        "caller_role": self.current_call["caller_role"],
                        "timestamp": self.current_call.get("started_at", datetime.utcnow().isoformat())
                    }))
                    # If offer already generated, deliver it
                    if "last_offer" in self.current_call:
                        await ws.send_text(json.dumps(self.current_call["last_offer"]))
                except Exception as e:
                    print(f"[CALL-WS] Error notifying new client: {e}")

            # Notify the other peer that target has joined and is ready for WebRTC handshake!
            peer_role = "mobile" if role == "laptop" else "laptop"
            await self.broadcast_to_role(peer_role, {
                "type": "peer_joined",
                "role": role,
                "session_id": self.current_call["session_id"]
            }, sender_conn_id=conn_id)

        return conn_id

    def disconnect(self, conn_id: str):
        if conn_id in self.active_connections:
            info = self.active_connections.pop(conn_id)
            print(f"[CALL-WS] Client disconnected: {info['role']}, remaining: {len(self.active_connections)}")

    async def broadcast_to_role(self, target_role: str, message: dict, sender_conn_id: Optional[str] = None):
        """Sends message to all connections with target_role (or all peers if target_role is 'peer')."""
        sent = 0
        for cid, client in list(self.active_connections.items()):
            if cid == sender_conn_id:
                continue
            if target_role == "peer" or client["role"] == target_role:
                try:
                    await client["ws"].send_text(json.dumps(message))
                    sent += 1
                except Exception as e:
                    print(f"[CALL-WS] Error sending to {cid}: {e}")
        return sent

    async def handle_message(self, conn_id: str, data: dict):
        client = self.active_connections.get(conn_id)
        if not client:
            return

        msg_type = data.get("type")
        caller_role = client["role"]

        if msg_type == "call_invite":
            # Initiate a new call
            session_id = data.get("session_id") or str(uuid.uuid4())[:8]
            target_role = "laptop" if caller_role == "mobile" else "mobile"

            self.current_call = {
                "session_id": session_id,
                "caller_role": caller_role,
                "target_role": target_role,
                "caller_id": conn_id,
                "status": "ringing",
                "started_at": datetime.utcnow().isoformat()
            }

            # Save in database
            db = SessionLocal()
            try:
                record = VideoCallSessionEntity(
                    session_id=session_id,
                    caller_role=caller_role,
                    receiver_role=target_role,
                    status="ringing"
                )
                db.add(record)
                db.commit()
            except Exception as e:
                print(f"[CALL-DB] Error saving call session: {e}")
            finally:
                db.close()

            # Broadcast incoming call to target
            await self.broadcast_to_role(target_role, {
                "type": "incoming_call",
                "session_id": session_id,
                "caller_role": caller_role,
                "timestamp": datetime.utcnow().isoformat()
            }, sender_conn_id=conn_id)

            # Pause CCTV recording & release /dev/video0 and microphone for WebRTC
            try:
                from app.camera.camera_manager import camera_manager
                camera_manager.pause_for_call()
            except Exception as e:
                print(f"[CALL] Camera pause notice: {e}")

            if target_role == "laptop":
                try:
                    from app.services.laptop_call_client import handle_incoming_call_on_laptop
                    handle_incoming_call_on_laptop(session_id, "http://localhost:7070")
                except Exception as e:
                    print(f"[CALL] Laptop ring alert notice: {e}")

        elif msg_type == "call_accept":
            # Ensure webcam is released
            try:
                from app.camera.camera_manager import camera_manager
                camera_manager.pause_for_call()
            except Exception as e:
                print(f"[CALL] Camera pause notice: {e}")

            if self.current_call:
                self.current_call["status"] = "connected"
                session_id = data.get("session_id") or self.current_call["session_id"]

                # Update in DB
                db = SessionLocal()
                try:
                    rec = db.query(VideoCallSessionEntity).filter(VideoCallSessionEntity.session_id == session_id).first()
                    if rec:
                        rec.status = "connected"
                        db.commit()
                except Exception as e:
                    print(f"[CALL-DB] Error updating call status: {e}")
                finally:
                    db.close()

                target_role = "laptop" if caller_role == "mobile" else "mobile"
                await self.broadcast_to_role(target_role, {
                    "type": "call_accepted",
                    "session_id": session_id,
                    "accepted_by": caller_role
                }, sender_conn_id=conn_id)

        elif msg_type == "call_reject":
            if self.current_call:
                session_id = data.get("session_id") or self.current_call["session_id"]
                self.current_call["status"] = "declined"

                db = SessionLocal()
                try:
                    rec = db.query(VideoCallSessionEntity).filter(VideoCallSessionEntity.session_id == session_id).first()
                    if rec:
                        rec.status = "declined"
                        rec.ended_at = datetime.utcnow()
                        db.commit()
                except Exception as e:
                    print(f"[CALL-DB] Error updating call status: {e}")
                finally:
                    db.close()

                target_role = "laptop" if caller_role == "mobile" else "mobile"
                await self.broadcast_to_role(target_role, {
                    "type": "call_rejected",
                    "session_id": session_id
                }, sender_conn_id=conn_id)
                self.current_call = None

                try:
                    from app.camera.camera_manager import camera_manager
                    camera_manager.resume_from_call()
                except Exception:
                    pass

        elif msg_type == "call_end":
            if self.current_call:
                session_id = data.get("session_id") or self.current_call["session_id"]
                duration = data.get("duration_sec", 0)

                db = SessionLocal()
                try:
                    rec = db.query(VideoCallSessionEntity).filter(VideoCallSessionEntity.session_id == session_id).first()
                    if rec:
                        rec.status = "ended"
                        rec.ended_at = datetime.utcnow()
                        rec.duration_sec = int(duration)
                        db.commit()
                except Exception as e:
                    print(f"[CALL-DB] Error updating call session: {e}")
                finally:
                    db.close()

                target_role = "laptop" if caller_role == "mobile" else "mobile"
                await self.broadcast_to_role(target_role, {
                    "type": "call_ended",
                    "session_id": session_id
                }, sender_conn_id=conn_id)
                self.current_call = None

                try:
                    from app.services.laptop_call_client import close_laptop_call_interface
                    close_laptop_call_interface()
                except Exception:
                    pass

                try:
                    from app.camera.camera_manager import camera_manager
                    camera_manager.resume_from_call()
                except Exception:
                    pass

        elif msg_type == "webrtc_offer":
            if self.current_call:
                self.current_call["last_offer"] = data
            target_role = "laptop" if caller_role == "mobile" else "mobile"
            await self.broadcast_to_role(target_role, data, sender_conn_id=conn_id)

        elif msg_type in ("webrtc_answer", "ice_candidate"):
            # Relay WebRTC signaling payload directly to peer
            target_role = "laptop" if caller_role == "mobile" else "mobile"
            await self.broadcast_to_role(target_role, data, sender_conn_id=conn_id)

call_manager = CallManager()

@router.websocket("/ws")
async def call_websocket_endpoint(websocket: WebSocket):
    role = websocket.query_params.get("role", "mobile")
    device_id = websocket.query_params.get("device_id", "default")
    conn_id = await call_manager.connect(websocket, role, device_id)
    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            await call_manager.handle_message(conn_id, data)
    except WebSocketDisconnect:
        call_manager.disconnect(conn_id)
    except Exception as e:
        print(f"[CALL-WS] Error: {e}")
        call_manager.disconnect(conn_id)

@router.post("/direct_start")
async def direct_start_call(request: Request):
    """Directly triggers the full video call interface to open immediately on the Kali Linux laptop display with camera and mic."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    session_id = body.get("session_id") or str(uuid.uuid4())[:8]

    # Explicitly pause CCTV recording and release camera/mic hardware
    try:
        from app.camera.camera_manager import camera_manager
        camera_manager.pause_for_call()
    except Exception as e:
        print(f"[CALL] Camera pause notice: {e}")
    try:
        from app.services.laptop_call_client import handle_incoming_call_on_laptop
        handle_incoming_call_on_laptop(session_id, "http://localhost:7070")
        return {"success": True, "session_id": session_id, "message": "Video call interface opened directly on Kali Linux laptop screen."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/status")
def get_call_status():
    """Get active call state and connected participants."""
    return {
        "active_call": call_manager.current_call,
        "total_clients": len(call_manager.active_connections),
        "clients": [
            {"role": v["role"], "device_id": v["device_id"]}
            for v in call_manager.active_connections.values()
        ]
    }

@router.get("/history")
def get_call_history():
    """Get list of past video calls."""
    db = SessionLocal()
    try:
        records = db.query(VideoCallSessionEntity).order_by(VideoCallSessionEntity.started_at.desc()).limit(50).all()
        return [
            {
                "id": r.id,
                "session_id": r.session_id,
                "caller_role": r.caller_role,
                "receiver_role": r.receiver_role,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "duration_sec": r.duration_sec
            }
            for r in records
        ]
    finally:
        db.close()
