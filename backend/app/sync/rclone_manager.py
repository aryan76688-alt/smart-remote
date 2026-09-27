import os
import re
import json
import time
import shutil
import select
import urllib.request
import urllib.parse
import subprocess
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List

class RcloneManager:
    """Manages system rclone binary for Google Drive authentication and CCTV syncing."""

    def __init__(self):
        self.rclone_bin = self._find_rclone()
        self.config_dir = Path.home() / ".config" / "rclone"
        self.config_file = self.config_dir / "rclone.conf"
        self.config_dir.mkdir(parents=True, exist_ok=True)

        self.cctv_folder_name = "Kali_CCTV_Recordings2.0"
        self.target_email = "aryan76688@gmail.com"

        # Auth session state
        self._auth_proc: Optional[subprocess.Popen] = None
        self._auth_url: Optional[str] = None
        self._auth_state: Optional[str] = None
        self._auth_local_url: Optional[str] = None
        self._auth_lock = threading.Lock()

    def _find_rclone(self) -> str:
        candidates = [
            "/home/aryan/.gemini/antigravity/scratch/smart-remote/bin/rclone",
            "/usr/local/bin/rclone",
            "/home/aryan/.local/bin/rclone",
            shutil.which("rclone") or "rclone"
        ]
        for c in candidates:
            if c and os.path.isfile(c) and os.access(c, os.X_OK):
                return c
        return "rclone"

    def _run_cmd(self, args: List[str], timeout: int = 15) -> subprocess.CompletedProcess:
        env = os.environ.copy()
        return subprocess.run(
            [self.rclone_bin] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env
        )

    def get_version(self) -> str:
        try:
            res = self._run_cmd(["version"], timeout=5)
            first_line = res.stdout.splitlines()[0] if res.stdout else "unknown"
            return first_line.strip()
        except Exception:
            return "not available"

    def is_configured(self) -> bool:
        if not self.config_file.exists():
            return False
        content = self.config_file.read_text(encoding="utf-8", errors="ignore")
        return "[gdrive]" in content and "token" in content

    def test_connection(self) -> Dict[str, Any]:
        """Verify live Google Drive connectivity and check for Kali_CCTV_Recordings folder."""
        if not self.is_configured():
            return {"authenticated": False, "folder_exists": False, "error": "Not configured"}

        try:
            # Check root listing to verify token validity
            res = self._run_cmd(["lsd", "gdrive:", "--max-depth", "1"], timeout=8)
            if res.returncode != 0:
                return {
                    "authenticated": False,
                    "folder_exists": False,
                    "error": res.stderr.strip() or "Google Drive authentication failed"
                }

            # Check if Kali_CCTV_Recordings is in stdout
            folder_found = self.cctv_folder_name in res.stdout
            return {
                "authenticated": True,
                "folder_exists": folder_found,
                "listing": res.stdout.strip()
            }
        except Exception as e:
            return {
                "authenticated": False,
                "folder_exists": False,
                "error": str(e)
            }

    def get_status(self) -> Dict[str, Any]:
        installed = os.path.isfile(self.rclone_bin) and os.access(self.rclone_bin, os.X_OK)
        configured = self.is_configured()
        conn = self.test_connection() if configured else {"authenticated": False, "folder_exists": False}

        return {
            "installed": installed,
            "version": self.get_version() if installed else None,
            "binary_path": self.rclone_bin,
            "configured": configured,
            "authenticated": conn.get("authenticated", False),
            "folder_exists": conn.get("folder_exists", False),
            "folder_name": self.cctv_folder_name,
            "target_email": self.target_email,
            "auth_in_progress": self._auth_proc is not None and self._auth_proc.poll() is None,
            "auth_url": self._auth_url if (self._auth_proc and self._auth_proc.poll() is None) else None,
            "auth_state": self._auth_state if (self._auth_proc and self._auth_proc.poll() is None) else None,
            "error": conn.get("error")
        }

    def start_auth(self, open_in_kali_browser: bool = False) -> Dict[str, Any]:
        """Start rclone authorize drive session and extract Google OAuth link."""
        with self._auth_lock:
            # Terminate existing session if active
            if self._auth_proc and self._auth_proc.poll() is None:
                try:
                    self._auth_proc.terminate()
                except Exception:
                    pass

            try:
                subprocess.run(["fuser", "-k", "53682/tcp"], capture_output=True)
                subprocess.run(["pkill", "-9", "-f", "rclone authorize"], capture_output=True)
                time.sleep(0.3)
            except Exception:
                pass

            self._auth_proc = None
            self._auth_url = None
            self._auth_state = None
            self._auth_local_url = None

            cmd = [self.rclone_bin, "authorize", "drive", "--auth-no-open-browser"]
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            self._auth_proc = proc

            # Read stderr lines with timeout to capture the auth link without blocking
            lines = []
            state_match = None
            start_t = time.time()
            while time.time() - start_t < 3.0:
                r, _, _ = select.select([proc.stderr], [], [], 0.4)
                if r:
                    line = proc.stderr.readline()
                    if line:
                        lines.append(line)
                        state_match = re.search(r'http://127\.0\.0\.1:53682/auth\?state=([a-zA-Z0-9_\-]+)', line)
                        if state_match:
                            break
                else:
                    if lines:
                        break

            stderr_text = "".join(lines)
            if not state_match:
                state_match = re.search(r'http://127\.0\.0\.1:53682/auth\?state=([a-zA-Z0-9_\-]+)', stderr_text)

            if not state_match:
                try:
                    proc.terminate()
                except Exception:
                    pass
                return {
                    "success": False,
                    "error": f"Failed to start OAuth server: {stderr_text}"
                }

            state = state_match.group(1)
            self._auth_state = state
            self._auth_local_url = f"http://127.0.0.1:53682/auth?state={state}"

            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    return None

            opener = urllib.request.build_opener(NoRedirect)
            try:
                req = urllib.request.Request(self._auth_local_url, headers={"User-Agent": "Mozilla/5.0"})
                opener.open(req)
            except urllib.error.HTTPError as e:
                location = e.headers.get("Location")
                if location:
                    self._auth_url = location
            except Exception:
                pass

            if not self._auth_url:
                self._auth_url = (
                    f"https://accounts.google.com/o/oauth2/auth?access_type=offline"
                    f"&client_id=202264815644.apps.googleusercontent.com"
                    f"&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F"
                    f"&response_type=code"
                    f"&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive"
                    f"&state={state}"
                )

            if open_in_kali_browser:
                self.open_in_kali_display(self._auth_url)

            return {
                "success": True,
                "auth_url": self._auth_url,
                "local_url": self._auth_local_url,
                "state": self._auth_state,
                "target_email": self.target_email,
                "folder": self.cctv_folder_name
            }

    def open_in_kali_display(self, url: str) -> bool:
        """Opens URL in a browser on Kali Linux X11 display :0.0."""
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0.0"

        browsers = ["xdg-open", "firefox", "chromium", "sensible-browser"]
        for b in browsers:
            path = shutil.which(b)
            if path:
                try:
                    subprocess.Popen([path, url], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    print(f"[GDRIVE] Opened auth URL in {b} on display :0.0")
                    return True
                except Exception:
                    continue
        return False

    def finish_auth(self, redirect_input: str) -> Dict[str, Any]:
        """Submit the OAuth callback URL or code to complete authentication."""
        with self._auth_lock:
            redirect_input = (redirect_input or "").strip()
            if not redirect_input:
                return {"success": False, "error": "No redirect URL or code provided"}

            if redirect_input.startswith("{") and "access_token" in redirect_input:
                return self.save_raw_token(redirect_input)

            code = None
            state = self._auth_state

            if "code=" in redirect_input:
                if "?" in redirect_input:
                    qs = redirect_input.split("?", 1)[1]
                else:
                    qs = redirect_input
                params = urllib.parse.parse_qs(qs)
                code = params.get("code", [None])[0]
                if params.get("state"):
                    state = params.get("state")[0]
            else:
                code = redirect_input

            if not code:
                return {"success": False, "error": "Could not parse Google OAuth code"}

            req_url = f"http://127.0.0.1:53682/?state={state}&code={urllib.parse.quote(code)}"
            try:
                urllib.request.urlopen(req_url, timeout=4)
            except Exception as e:
                print(f"[GDRIVE] Local callback response note: {e}")

            token_json = None
            if self._auth_proc:
                try:
                    stdout_data, _ = self._auth_proc.communicate(timeout=6)
                    match = re.search(r'\{.*"access_token".*\}', stdout_data, re.DOTALL)
                    if match:
                        token_json = match.group(0).strip()
                except Exception:
                    pass

            if token_json:
                res = self.save_raw_token(token_json)
                self.ensure_cctv_folder()
                return res

            self.ensure_cctv_folder()
            conn = self.test_connection()
            return {
                "success": conn.get("authenticated", False),
                "authenticated": conn.get("authenticated", False),
                "folder_exists": conn.get("folder_exists", False),
                "error": conn.get("error") if not conn.get("authenticated") else None
            }

    def save_raw_token(self, token_json_str: str) -> Dict[str, Any]:
        """Writes [gdrive] configuration block to rclone.conf."""
        try:
            parsed = json.loads(token_json_str)
            clean_token = json.dumps(parsed)

            conf_text = f"""[gdrive]
type = drive
scope = drive
token = {clean_token}
"""
            self.config_file.write_text(conf_text, encoding="utf-8")
            self.ensure_cctv_folder()
            conn = self.test_connection()
            return {
                "success": True,
                "authenticated": conn.get("authenticated", False),
                "folder_exists": conn.get("folder_exists", False),
                "message": "Google Drive configured successfully"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def ensure_cctv_folder(self) -> bool:
        """Ensures the Kali_CCTV_Recordings folder exists on real Google Drive."""
        if not self.is_configured():
            return False
        try:
            res = self._run_cmd(["mkdir", f"gdrive:{self.cctv_folder_name}"], timeout=15)
            if res.returncode == 0:
                print(f"[GDRIVE] ✓ Created/verified Google Drive folder: {self.cctv_folder_name}")
                return True
            else:
                print(f"[GDRIVE] Warning creating folder: {res.stderr.strip()}")
                return False
        except Exception as e:
            print(f"[GDRIVE] Error creating folder {self.cctv_folder_name}: {e}")
            return False

    def sync_cctv_file(self, local_filepath: str) -> Dict[str, Any]:
        """Uploads a specific CCTV .mp4 file to Google Drive."""
        path_obj = Path(local_filepath)
        if not path_obj.exists():
            return {"success": False, "error": f"File not found: {local_filepath}"}

        if not self.is_configured():
            return {"success": False, "error": "Google Drive not configured with rclone"}

        try:
            target_remote = f"gdrive:{self.cctv_folder_name}"
            res = self._run_cmd(["copy", str(path_obj), target_remote], timeout=120)
            if res.returncode == 0:
                print(f"[GDRIVE] ✓ Successfully uploaded {path_obj.name} to {target_remote}")
                return {
                    "success": True,
                    "filename": path_obj.name,
                    "target_remote": target_remote
                }
            else:
                return {"success": False, "error": res.stderr.strip()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def sync_all_cctv(self, cctv_dir: str) -> Dict[str, Any]:
        """Uploads all .mp4 CCTV files to Google Drive."""
        if not self.is_configured():
            return {"success": False, "error": "Google Drive not configured with rclone"}

        try:
            target_remote = f"gdrive:{self.cctv_folder_name}"
            res = self._run_cmd(["copy", cctv_dir, target_remote, "--include", "*.{mp4,mp3,jpg}"], timeout=300)
            if res.returncode == 0:
                return {"success": True, "target_remote": target_remote, "output": res.stdout.strip()}
            else:
                return {"success": False, "error": res.stderr.strip()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_cctv_files(self) -> List[Dict[str, Any]]:
        """Lists files currently in Kali_CCTV_Recordings on Google Drive."""
        if not self.is_configured():
            return []
        try:
            res = self._run_cmd(["lsjson", f"gdrive:{self.cctv_folder_name}"], timeout=15)
            if res.returncode == 0 and res.stdout:
                return json.loads(res.stdout)
            return []
        except Exception:
            return []

rclone_manager = RcloneManager()
