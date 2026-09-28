import os
import sys
import time
import json
import logging
import threading
import requests
from typing import Optional
from websockets.sync.client import connect as ws_connect

from app.services.laptop_call_client import handle_incoming_call_on_laptop, close_laptop_call_interface
from app.services.tunnel_manager import tunnel_manager

logger = logging.getLogger("smart_remote.railway_bridge")

RAILWAY_HTTP_BASE = os.getenv("RAILWAY_HTTP_URL", "https://smart-remote-app-production.up.railway.app")
RAILWAY_WS_BASE = os.getenv("RAILWAY_WS_URL", "wss://smart-remote-app-production.up.railway.app")

class RailwayBridge:
    def __init__(self):
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.last_registered_tunnel: Optional[str] = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, name="RailwayBridgeThread", daemon=True)
        self.thread.start()
        print("[RAILWAY-BRIDGE] 🚀 Background bridge started. Monitoring Railway cloud signaling...")

    def stop(self):
        self.running = False

    def _sync_tunnel_to_railway(self):
        """Notifies Railway cloud server of the laptop's live tunnel URL so Railway can proxy CCTV & controls."""
        try:
            current_tunnel = tunnel_manager.public_url
            if not current_tunnel:
                return
            if current_tunnel == self.last_registered_tunnel:
                return

            resp = requests.post(
                f"{RAILWAY_HTTP_BASE}/api/tunnel/register_node",
                json={
                    "tunnel_url": current_tunnel,
                    "tailscale_ip": "100.69.194.11"
                },
                timeout=5
            )
            if resp.status_code in (200, 201):
                self.last_registered_tunnel = current_tunnel
                print(f"[RAILWAY-BRIDGE] ✓ Synced live laptop tunnel with Railway: {current_tunnel}")
        except Exception as e:
            # Silent fallback if Railway sync network glitch
            pass

    def _run_loop(self):
        ws_url = f"{RAILWAY_WS_BASE}/api/call/ws?role=laptop&device_id=kali-laptop-bridge"
        
        while self.running:
            # Try to sync tunnel whenever available
            self._sync_tunnel_to_railway()

            try:
                print(f"[RAILWAY-BRIDGE] Connecting to Railway call signaling: {ws_url}")
                with ws_connect(ws_url, open_timeout=6) as ws:
                    print("[RAILWAY-BRIDGE] 🟢 Connected to Railway cloud signaling server. Ready for instant calls.")
                    
                    last_ping = time.time()
                    last_sync = time.time()

                    while self.running:
                        # Periodic keepalive ping
                        now = time.time()
                        if now - last_ping > 20:
                            ws.send(json.dumps({"type": "ping"}))
                            last_ping = now

                        # Periodic tunnel check
                        if now - last_sync > 30:
                            self._sync_tunnel_to_railway()
                            last_sync = now

                        try:
                            # Non-blocking receive with 1s timeout
                            raw = ws.recv(timeout=1.0)
                            if not raw:
                                continue
                            
                            data = json.loads(raw)
                            msg_type = data.get("type")

                            if msg_type == "incoming_call":
                                session_id = data.get("session_id", "direct")
                                print(f"[RAILWAY-BRIDGE] 📞 INCOMING VIDEO CALL RECEIVED FROM RAILWAY! Session: {session_id}")
                                # Directly trigger zero-click interface on Kali display
                                handle_incoming_call_on_laptop(session_id)

                            elif msg_type in ("call_ended", "call_rejected"):
                                print(f"[RAILWAY-BRIDGE] Call ended event received ({msg_type}).")
                                close_laptop_call_interface()

                        except TimeoutError:
                            continue
                        except Exception as parse_err:
                            if self.running and "timed out" not in str(parse_err).lower():
                                print(f"[RAILWAY-BRIDGE] Message loop notice: {parse_err}")

            except Exception as conn_err:
                if self.running:
                    # Connection dropped or server unreachable, retry after 4 seconds
                    time.sleep(4)

railway_bridge = RailwayBridge()
