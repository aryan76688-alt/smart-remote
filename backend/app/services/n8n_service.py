import os
import json
import asyncio
import subprocess
import requests
from datetime import datetime
from typing import Dict, Any, Optional

N8N_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "recordings", "n8n_config.json")

DEFAULT_CONFIG = {
    "enabled": True,
    "n8n_base_url": "http://localhost:5678",
    "webhook_url": "http://localhost:5678/webhook/smart-remote",
    "api_key": "",
    "triggers": {
        "cctv_motion": True,
        "battery_alert": True,
        "face_auth": True,
        "voice_command": True,
        "system_event": True
    }
}

class N8nService:
    def __init__(self):
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        os.makedirs(os.path.dirname(N8N_CONFIG_PATH), exist_ok=True)
        if os.path.exists(N8N_CONFIG_PATH):
            try:
                with open(N8N_CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    merged = DEFAULT_CONFIG.copy()
                    merged.update(cfg)
                    return merged
            except Exception as e:
                print(f"[N8N] Error loading config: {e}")
        return DEFAULT_CONFIG.copy()

    def save_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        self.config.update(new_config)
        try:
            with open(N8N_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"[N8N] Error saving config: {e}")
        return self.config

    def get_status(self) -> Dict[str, Any]:
        base_url = self.config.get("n8n_base_url", "http://localhost:5678").rstrip('/')
        is_online = False
        status_msg = "Offline"
        version = None

        try:
            resp = requests.get(f"{base_url}/healthz", timeout=1.8)
            if resp.status_code in (200, 204):
                is_online = True
                status_msg = "Running & Healthy"
            else:
                resp2 = requests.get(base_url, timeout=1.8)
                if resp2.status_code in (200, 301, 302):
                    is_online = True
                    status_msg = "Web UI Active"
        except Exception:
            is_online = False
            status_msg = "Not Reachable (Starting or Offline)"

        return {
            "online": is_online,
            "status": status_msg,
            "base_url": base_url,
            "webhook_url": self.config.get("webhook_url"),
            "enabled": self.config.get("enabled", True),
            "triggers": self.config.get("triggers", {})
        }

    def dispatch_event(self, event_type: str, data: Dict[str, Any]):
        """Dispatches an event asynchronously to the configured n8n webhook."""
        if not self.config.get("enabled", True):
            return

        triggers = self.config.get("triggers", {})
        if not triggers.get(event_type, True):
            return

        webhook_url = self.config.get("webhook_url")
        if not webhook_url:
            return

        payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "smart_remote_kali",
            "data": data
        }

        def _send():
            try:
                headers = {"Content-Type": "application/json"}
                api_key = self.config.get("api_key")
                if api_key:
                    headers["X-N8N-API-KEY"] = api_key
                requests.post(webhook_url, json=payload, headers=headers, timeout=3.0)
            except Exception as e:
                # Silently catch webhook send failures if n8n workflow isn't active
                pass

        import threading
        threading.Thread(target=_send, daemon=True).start()

    def execute_action(self, action: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Allows n8n workflow to trigger smart actions on the Kali Linux laptop."""
        params = params or {}
        action = action.lower()

        try:
            if action == "lock_screen":
                subprocess.Popen(["xdg-screensaver", "lock"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "action": "lock_screen", "message": "Kali screen locked successfully"}

            elif action == "screen_off":
                subprocess.Popen(["xset", "dpms", "force", "off"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "action": "screen_off", "message": "Screen turned off"}

            elif action == "screen_on":
                subprocess.Popen(["xset", "dpms", "force", "on"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "action": "screen_on", "message": "Screen awakened"}

            elif action == "set_volume":
                vol = params.get("volume", 50)
                subprocess.run(["amixer", "set", "Master", f"{vol}%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "action": "set_volume", "volume": vol}

            elif action == "speak":
                text = params.get("text", "Smart Remote alert from n8n")
                subprocess.Popen(["espeak-ng", text], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "action": "speak", "text": text}

            elif action == "cctv_snapshot":
                from app.camera.camera_manager import camera_manager
                success = camera_manager.take_snapshot()
                return {"success": success, "action": "cctv_snapshot"}

            elif action == "command":
                cmd = params.get("command")
                if not cmd:
                    return {"success": False, "error": "No command provided"}
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
                return {"success": res.returncode == 0, "stdout": res.stdout, "stderr": res.stderr}

            else:
                return {"success": False, "error": f"Unknown action: {action}"}

        except Exception as e:
            return {"success": False, "error": str(e)}

n8n_service = N8nService()
