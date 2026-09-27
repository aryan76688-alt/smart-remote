"""
WebRTC Signaling Server for Two-Way Video Calls
================================================
Architecture:
  - Mobile (caller) connects as role='mobile'
  - Laptop backend auto-connects as role='laptop'
  - Signaling server relays: call_invite → incoming_call
                             webrtc_offer → webrtc_offer
                             webrtc_answer → webrtc_answer
                             ice_candidate → ice_candidate
                             call_accept/reject/end → forwarded to both sides

  The backend also acts as the laptop-side WebRTC endpoint, capturing the
  webcam + mic and sending them via aiortc (if available) OR acting as a
  pure signaling proxy so the frontend-rendered VideoCallModal gets a 
  real-time stream from /ws/camera/laptop converted to WebRTC tracks.

  For simplicity and reliability without aiortc dependency, we use a
  pure signaling proxy approach: mobile ↔ laptop both connect as WebRTC
  peers via browser (mobile) + a dedicated laptop-side WS client script.
  The backend just routes messages between the two sides.
"""

import asyncio
import json
import time
import threading
from typing import Dict, Optional, Set
from dataclasses import dataclass, field


@dataclass
class CallSession:
    session_id: str
    caller_role: str = 'mobile'
    state: str = 'calling'   # calling | ringing | connected | ended
    created_at: float = field(default_factory=time.time)
    duration_sec: int = 0


class CallSignalingManager:
    """
    Manages WebSocket connections for WebRTC call signaling.
    Routes messages between mobile and laptop WebSocket clients.
    """

    def __init__(self):
        # role -> list of websockets (support multiple tabs)
        self._connections: Dict[str, Set] = {
            'mobile': set(),
            'laptop': set()
        }
        self._sessions: Dict[str, CallSession] = {}
        self._lock = asyncio.Lock()
        self._pending_laptop_offer: Optional[dict] = None  # Store offer for laptop auto-answer

    async def connect(self, ws, role: str, device_id: str = ''):
        async with self._lock:
            if role not in self._connections:
                self._connections[role] = set()
            self._connections[role].add(ws)
        print(f"[CALL-WS] {role.upper()} connected (device_id={device_id}), "
              f"total mobile={len(self._connections['mobile'])}, "
              f"laptop={len(self._connections['laptop'])}")

    async def disconnect(self, ws, role: str):
        async with self._lock:
            self._connections.get(role, set()).discard(ws)
        print(f"[CALL-WS] {role.upper()} disconnected, "
              f"remaining mobile={len(self._connections['mobile'])}, "
              f"laptop={len(self._connections['laptop'])}")

    async def broadcast_to_role(self, role: str, message: dict, exclude_ws=None):
        """Send message to all websockets for a given role."""
        data = json.dumps(message)
        dead = set()
        for ws in list(self._connections.get(role, set())):
            if ws is exclude_ws:
                continue
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        # Clean dead connections
        if dead:
            async with self._lock:
                self._connections.get(role, set()).difference_update(dead)

    async def relay_to_other(self, sender_role: str, message: dict, sender_ws=None):
        """Relay message to the opposite role."""
        target_role = 'laptop' if sender_role == 'mobile' else 'mobile'
        await self.broadcast_to_role(target_role, message)

    async def handle_message(self, ws, role: str, raw: str):
        """Process an incoming signaling message."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        msg_type = msg.get('type', '')
        session_id = msg.get('session_id', '')

        if msg_type == 'call_invite':
            # Mobile wants to call laptop
            session = CallSession(session_id=session_id, caller_role=role)
            self._sessions[session_id] = session
            # Notify laptop that there is an incoming call
            await self.broadcast_to_role('laptop', {
                'type': 'incoming_call',
                'session_id': session_id,
                'caller_role': role
            })
            print(f"[CALL-WS] call_invite → laptop (session={session_id})")

        elif msg_type == 'call_accept':
            # Laptop accepted the call
            if session_id in self._sessions:
                self._sessions[session_id].state = 'connected'
            await self.broadcast_to_role('mobile', {
                'type': 'call_accepted',
                'session_id': session_id
            })
            print(f"[CALL-WS] call_accept → mobile (session={session_id})")

        elif msg_type == 'call_reject':
            if session_id in self._sessions:
                self._sessions[session_id].state = 'ended'
            await self.broadcast_to_role('mobile', {
                'type': 'call_rejected',
                'session_id': session_id
            })
            print(f"[CALL-WS] call_reject → mobile")

        elif msg_type == 'call_end':
            if session_id in self._sessions:
                self._sessions[session_id].state = 'ended'
                self._sessions[session_id].duration_sec = msg.get('duration_sec', 0)
            # Notify both sides
            end_msg = {'type': 'call_ended', 'session_id': session_id}
            await self.broadcast_to_role('mobile', end_msg, exclude_ws=ws)
            await self.broadcast_to_role('laptop', end_msg, exclude_ws=ws)
            print(f"[CALL-WS] call_end → both sides (session={session_id})")

        elif msg_type in ('webrtc_offer', 'webrtc_answer', 'ice_candidate'):
            # Pure relay: forward to the other side
            await self.relay_to_other(role, msg, sender_ws=ws)
            print(f"[CALL-WS] relay {msg_type} from {role} → other side")

        elif msg_type == 'ping':
            # Keepalive
            try:
                await ws.send_text(json.dumps({'type': 'pong', 'ts': time.time()}))
            except Exception:
                pass

    def get_active_sessions(self):
        return [
            {
                'session_id': s.session_id,
                'state': s.state,
                'caller_role': s.caller_role,
                'duration_sec': s.duration_sec,
                'age_sec': int(time.time() - s.created_at)
            }
            for s in self._sessions.values()
        ]

    def get_connected_clients(self):
        return {
            'mobile': len(self._connections.get('mobile', set())),
            'laptop': len(self._connections.get('laptop', set()))
        }


# Global singleton
call_manager = CallSignalingManager()
