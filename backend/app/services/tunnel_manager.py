import os
import re
import io
import time
import shutil
import signal
import logging
import threading
import subprocess
from collections import deque
from typing import Optional, Dict, Any, List

logger = logging.getLogger("smart_remote.tunnel")

try:
    import qrcode
    import qrcode.image.svg
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False


class TunnelManager:
    def __init__(self, target_port: int = 7070):
        self.target_port = target_port
        self.process: Optional[subprocess.Popen] = None
        self.status: str = "stopped"  # stopped, starting, active, error
        self.provider: str = "auto"
        self.active_provider: str = "none"
        self.public_url: Optional[str] = None
        self.qr_code_svg: Optional[str] = None
        self.error_message: Optional[str] = None
        self.started_at: Optional[float] = None
        self.logs: deque = deque(maxlen=150)
        self.lock = threading.Lock()
        self.monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.custom_url: Optional[str] = None
        self.custom_token: Optional[str] = None

    def get_cloudflared_binary(self) -> Optional[str]:
        # Check in project bin/ first
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
        local_bin = os.path.join(project_root, "bin", "cloudflared")
        if os.path.isfile(local_bin) and os.access(local_bin, os.X_OK):
            return local_bin
        # Check system PATH
        which_cf = shutil.which("cloudflared")
        if which_cf:
            return which_cf
        return None

    def generate_qr_code(self, url: str) -> Optional[str]:
        if not QRCODE_AVAILABLE or not url:
            return None
        try:
            factory = qrcode.image.svg.SvgPathImage
            img = qrcode.make(url, image_factory=factory)
            buf = io.BytesIO()
            img.save(buf)
            svg_content = buf.getvalue().decode("utf-8")
            return svg_content
        except Exception as e:
            logger.warning(f"Error generating QR code SVG: {e}")
            return None

    def start(self, provider: str = "auto", custom_url: Optional[str] = None, custom_token: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            if self.process and self.process.poll() is None:
                if self.provider == provider and self.status == "active":
                    return self.get_status()
                # Stop existing before restarting
                self._terminate_process()

            self.provider = provider
            self.status = "starting"
            self.error_message = None
            self.public_url = None
            self.qr_code_svg = None
            self.logs.clear()
            self._stop_event.clear()
            self.started_at = time.time()
            if custom_url:
                self.custom_url = custom_url
            if custom_token:
                self.custom_token = custom_token

            # Resolve effective provider
            chosen = provider
            if chosen == "auto":
                cf_bin = self.get_cloudflared_binary()
                if cf_bin:
                    chosen = "cloudflare"
                else:
                    chosen = "localhost.run"

            self.active_provider = chosen

            try:
                cmd = self._build_command(chosen)
                self.logs.append(f"[SYSTEM] Launching tunnel provider: {chosen}")
                self.logs.append(f"[SYSTEM] Command: {' '.join(cmd)}")

                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    preexec_fn=os.setsid
                )

                self.monitor_thread = threading.Thread(
                    target=self._monitor_stream,
                    args=(self.process, chosen),
                    daemon=True
                )
                self.monitor_thread.start()

                return self.get_status()

            except Exception as ex:
                self.status = "error"
                self.error_message = str(ex)
                self.logs.append(f"[ERROR] Failed to start tunnel: {ex}")
                logger.exception("Failed to start tunnel")
                return self.get_status()

    def _build_command(self, provider: str) -> List[str]:
        if provider == "cloudflare":
            cf_bin = self.get_cloudflared_binary()
            if not cf_bin:
                raise RuntimeError("cloudflared binary is not available. Please use localhost.run or install cloudflared.")
            if self.custom_token:
                return [cf_bin, "tunnel", "run", "--token", self.custom_token]
            return [
                cf_bin, "tunnel",
                "--url", f"http://127.0.0.1:{self.target_port}",
                "--no-autoupdate",
                "--metrics", "127.0.0.1:0"
            ]

        elif provider == "localhost.run":
            # Ensure SSH key exists
            home_dir = os.path.expanduser("~")
            ssh_key = os.path.join(home_dir, ".ssh", "id_ed25519")
            if not os.path.exists(ssh_key):
                os.makedirs(os.path.join(home_dir, ".ssh"), mode=0o700, exist_ok=True)
                subprocess.run(["ssh-keygen", "-t", "ed25519", "-N", "", "-f", ssh_key], check=False)

            return [
                "ssh",
                "-F", "/dev/null",
                "-o", "StrictHostKeyChecking=no",
                "-o", "ServerAliveInterval=15",
                "-o", "ServerAliveCountMax=4",
                "-o", "ExitOnForwardFailure=yes",
                "-o", "ConnectTimeout=10",
                "-R", f"80:localhost:{self.target_port}",
                "nokey@localhost.run"
            ]

        elif provider == "pinggy":
            return [
                "ssh",
                "-F", "/dev/null",
                "-o", "StrictHostKeyChecking=no",
                "-o", "ServerAliveInterval=15",
                "-o", "ServerAliveCountMax=4",
                "-p", "443",
                "-R0:localhost:7070",
                "a.pinggy.io"
            ]

        else:
            raise ValueError(f"Unknown tunnel provider: {provider}")

    def _monitor_stream(self, proc: subprocess.Popen, provider: str):
        cf_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
        lhr_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.lhr\.life')
        pinggy_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.pinggy\.link')

        url_found = False

        while not self._stop_event.is_set():
            if proc.poll() is not None:
                # Process terminated
                if self.status != "stopped":
                    self.status = "error" if not url_found else "stopped"
                    self.error_message = f"Tunnel process exited unexpectedly with code {proc.returncode}"
                    self.logs.append(f"[SYSTEM] {self.error_message}")
                break

            try:
                line = proc.stdout.readline()
                if not line:
                    time.sleep(0.1)
                    continue

                clean_line = line.strip()
                if clean_line:
                    self.logs.append(clean_line)

                # Search for URL if not yet detected
                if not url_found:
                    target_url = None
                    if provider == "cloudflare":
                        m = cf_pattern.search(clean_line)
                        if m:
                            target_url = m.group(0)
                    elif provider == "localhost.run":
                        m = lhr_pattern.search(clean_line)
                        if m:
                            target_url = m.group(0)
                    elif provider == "pinggy":
                        m = pinggy_pattern.search(clean_line)
                        if m:
                            target_url = m.group(0)

                    if target_url:
                        self.public_url = target_url
                        self.status = "active"
                        self.qr_code_svg = self.generate_qr_code(target_url)
                        url_found = True
                        self.logs.append(f"[SYSTEM] ✓ PUBLIC HTTPS URL LIVE: {target_url}")
                        logger.info(f"Public HTTPS tunnel established: {target_url}")
                        self._publish_current_server_info(target_url)

            except Exception as e:
                self.logs.append(f"[ERROR] Stream reader error: {e}")
                break

    def _publish_current_server_info(self, public_url: str):
        """Saves current_server.json locally and syncs to GitHub in background so APK can auto-discover."""
        def worker():
            try:
                import json
                from datetime import datetime
                from app.config import settings
                from app.system.monitor import system_monitor
                info = system_monitor.get_info()

                payload = {
                    "cloudflare_url": public_url,
                    "tailscale_url": f"http://{settings.TAILSCALE_IP}:{settings.PORT}",
                    "local_wifi_url": f"http://{info.local_ip}:{settings.PORT}",
                    "tunnel_status": "active",
                    "active_provider": self.active_provider,
                    "updated_at": datetime.utcnow().isoformat(),
                    "timestamp": int(time.time())
                }

                project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
                json_path = os.path.join(project_root, "current_server.json")
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)

                for sub in ["frontend/dist", "frontend/public", "backend/static"]:
                    p = os.path.join(project_root, sub, "current_server.json")
                    try:
                        os.makedirs(os.path.dirname(p), exist_ok=True)
                        with open(p, "w", encoding="utf-8") as f:
                            json.dump(payload, f, indent=2)
                    except Exception:
                        pass

                subprocess.run(
                    ["git", "add", "current_server.json"],
                    cwd=project_root,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=5
                )
                subprocess.run(
                    ["git", "commit", "-m", f"chore: update active cloudflare server url [{public_url}]"],
                    cwd=project_root,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=5
                )
                subprocess.run(
                    ["git", "push", "origin", "main"],
                    cwd=project_root,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=15
                )
                logger.info(f"Published active server URL to GitHub: {public_url}")
            except Exception as e:
                logger.warning(f"Failed to publish current_server.json: {e}")

        threading.Thread(target=worker, daemon=True).start()

    def stop(self) -> Dict[str, Any]:
        with self.lock:
            self._terminate_process()
            self.status = "stopped"
            self.public_url = None
            self.qr_code_svg = None
            self.active_provider = "none"
            self.logs.append("[SYSTEM] Tunnel stopped by user.")
            return self.get_status()

    def _terminate_process(self):
        self._stop_event.set()
        if self.process:
            try:
                pgid = os.getpgid(self.process.pid)
                os.killpg(pgid, signal.SIGTERM)
                try:
                    self.process.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    os.killpg(pgid, signal.SIGKILL)
            except Exception as e:
                logger.debug(f"Process termination warning: {e}")
            finally:
                self.process = None

    def restart(self, provider: Optional[str] = None) -> Dict[str, Any]:
        req_provider = provider or self.provider
        self.stop()
        time.sleep(0.5)
        return self.start(provider=req_provider)

    def get_status(self) -> Dict[str, Any]:
        is_running = self.process is not None and self.process.poll() is None
        current_status = self.status
        if is_running and self.public_url:
            current_status = "active"
        elif is_running and not self.public_url:
            current_status = "starting"
        elif not is_running and self.status == "active":
            current_status = "stopped"

        uptime = 0
        if current_status == "active" and self.started_at:
            uptime = int(time.time() - self.started_at)

        cf_ready = self.get_cloudflared_binary() is not None

        return {
            "status": current_status,
            "provider": self.provider,
            "active_provider": self.active_provider,
            "public_url": self.public_url,
            "qr_code_svg": self.qr_code_svg,
            "error_message": self.error_message,
            "uptime_seconds": uptime,
            "target_port": self.target_port,
            "cloudflare_available": cf_ready,
            "available_providers": [
                {"id": "auto", "name": "Auto (Smart Selection)", "description": "Prefers Cloudflare edge network, fallbacks to SSH reverse tunnel"},
                {"id": "localhost.run", "name": "SSH Tunnel (localhost.run)", "description": "Instant Let's Encrypt HTTPS, zero installation, works anywhere"},
                {"id": "cloudflare", "name": "Cloudflare Quick Tunnel", "description": "Global Cloudflare Anycast edge network with valid TLS certificate"},
                {"id": "pinggy", "name": "Pinggy.io SSH Tunnel", "description": "High-speed public HTTP/HTTPS tunnel via SSH"}
            ],
            "logs": list(self.logs)[-40:]
        }


# Global singleton instance
tunnel_manager = TunnelManager(target_port=7070)
