import os
import re
import json
import uuid
import time
import signal
import shutil
import logging
import threading
import subprocess
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger("pearos.nexus.tunnel")

class NexusTunnelManager:
    """Persistent Cloudflare Quick Tunnel + Workers Edge Hub Auto-Sync Engine."""

    def __init__(self, target_port: int = 7070):
        self.target_port = target_port
        self.project_root = Path(__file__).resolve().parent.parent.parent.parent
        self.process: Optional[subprocess.Popen] = None
        self.public_url: Optional[str] = None
        self.worker_url: str = "https://smart-remote.aryan76688.workers.dev"
        self.status: str = "stopped"
        self.worker_synced: bool = False
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def _get_cloudflared_bin(self) -> Optional[str]:
        local_bin = self.project_root / "bin" / "cloudflared"
        if local_bin.is_file() and os.access(local_bin, os.X_OK):
            return str(local_bin)
        return shutil.which("cloudflared")

    def _load_cf_credentials(self):
        cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
        env_path = self.project_root / ".env"
        if (not cf_account or not cf_token) and env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("CLOUDFLARE_ACCOUNT_ID=") and not cf_account:
                        cf_account = line.split("=", 1)[1].strip()
                    elif line.startswith("CLOUDFLARE_API_TOKEN=") and not cf_token:
                        cf_token = line.split("=", 1)[1].strip()
        return cf_account, cf_token

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self.status = "starting"
        self._thread = threading.Thread(target=self._supervisor_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        self._terminate_process()
        self.status = "stopped"

    def _terminate_process(self):
        if self.process:
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            finally:
                self.process = None

    def _supervisor_loop(self):
        cf_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

        while not self._stop_event.is_set():
            cf_bin = self._get_cloudflared_bin()
            if not cf_bin:
                self.status = "error"
                logger.error("cloudflared binary not found")
                time.sleep(15)
                continue

            cmd = [
                cf_bin, "tunnel",
                "--url", f"http://127.0.0.1:{self.target_port}",
                "--no-autoupdate",
                "--metrics", "127.0.0.1:0"
            ]
            self.status = "starting"
            self.public_url = None
            self.worker_synced = False

            try:
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    preexec_fn=os.setsid
                )

                while not self._stop_event.is_set() and self.process.poll() is None:
                    line = self.process.stdout.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    if not self.public_url:
                        match = cf_pattern.search(line)
                        if match:
                            self.public_url = match.group(0)
                            self.status = "active"
                            print(f"[NexusTunnel] Public Tunnel Active: {self.public_url}")
                            threading.Thread(
                                target=self._sync_cloudflare_worker,
                                args=(self.public_url,),
                                daemon=True
                            ).start()
            except Exception as e:
                logger.warning(f"Tunnel supervisor error: {e}")
            finally:
                self._terminate_process()

            if not self._stop_event.is_set():
                time.sleep(5)

    def _sync_cloudflare_worker(self, public_url: str):
        # Save current_server.json
        payload = {
            "local": f"http://127.0.0.1:{self.target_port}",
            "tailscale": f"http://100.69.194.11:{self.target_port}",
            "cloudflare_url": public_url,
            "workers_dev_url": self.worker_url,
            "tunnel_status": "active",
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        for target in [
            self.project_root / "current_server.json",
            self.project_root / "backend" / "app" / "static" / "current_server.json"
        ]:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                with open(target, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            except Exception:
                pass

        # Sync Cloudflare Worker script to point smart-remote.aryan76688.workers.dev -> public_url
        cf_account, cf_token = self._load_cf_credentials()
        if not cf_account or not cf_token:
            return

        try:
            hub_js_path = self.project_root / "backend" / "cloudflare_worker_hub.js"
            if hub_js_path.exists():
                worker_script = hub_js_path.read_text(encoding="utf-8").replace("__TARGET_BASE__", public_url)
            else:
                return

            boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
            metadata = {
                "body_part": "script",
                "bindings": [
                    {
                        "type": "kv_namespace",
                        "name": "HUB_KV",
                        "namespace_id": "f546d50caa2e4e6e8115c4c7070f4df2"
                    }
                ]
            }
            multipart_body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="metadata"\r\n'
                f"Content-Type: application/json\r\n\r\n"
                f"{json.dumps(metadata)}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="script"; filename="script.js"\r\n'
                f"Content-Type: application/javascript\r\n\r\n"
                f"{worker_script}\r\n"
                f"--{boundary}--\r\n"
            ).encode("utf-8")

            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/workers/scripts/smart-remote",
                data=multipart_body,
                headers={
                    "Authorization": f"Bearer {cf_token}",
                    "Content-Type": f"multipart/form-data; boundary={boundary}"
                },
                method="PUT"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    self.worker_synced = True
                    print(f"[NexusTunnel] Synced permanent Worker {self.worker_url} -> {public_url}")
        except Exception as e:
            print(f"[NexusTunnel] Worker sync error: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "success": True,
            "status": self.status,
            "public_url": self.public_url,
            "worker_url": self.worker_url,
            "worker_synced": self.worker_synced
        }

tunnel_manager = NexusTunnelManager(target_port=7070)
