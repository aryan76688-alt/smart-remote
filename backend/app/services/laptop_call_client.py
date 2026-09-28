import os
import sys
import time
import json
import shutil
import asyncio
import subprocess
import threading
from typing import Optional

# Global handle for active laptop call browser process
_active_laptop_call_proc: Optional[subprocess.Popen] = None
_proc_lock = threading.Lock()

def play_ringtone(duration_sec=2):
    """Plays an alert chime on Kali Linux laptop speakers."""
    try:
        # Unmute laptop speakers and set clear volume
        subprocess.run(["amixer", "set", "Master", "unmute", "85%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        subprocess.run(["amixer", "set", "Speaker", "unmute", "85%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        # Gentle dual-tone chime
        ring_cmd = "ffplay -nodisp -autoexit -loglevel quiet -f lavfi -i 'sine=frequency=880:duration=0.15,sine=frequency=1174:duration=0.3' 2>/dev/null"
        subprocess.run(ring_cmd, shell=True, timeout=4)
    except Exception as e:
        print(f"[LAPTOP-CALL] Chime notice: {e}")

def open_laptop_call_interface(session_id: str, server_base: str = "https://smart-remote-app-production.up.railway.app"):
    """Directly opens the full video call interface on the Kali Linux laptop display with camera and mic automatically enabled."""
    global _active_laptop_call_proc
    with _proc_lock:
        # If an interface is already open, don't open multiple windows
        if _active_laptop_call_proc and _active_laptop_call_proc.poll() is None:
            print(f"[LAPTOP-CALL] Video call window already active for session {session_id}")
            return

        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0.0"
        if "XAUTHORITY" not in env:
            xauth = os.path.expanduser("~/.Xauthority")
            if os.path.exists(xauth):
                env["XAUTHORITY"] = xauth

        # Dedicated direct video call URL with auto_join and laptop role
        call_url = f"{server_base}/call-laptop?session_id={session_id}&role=laptop&auto_join=true"

        chromium_bin = shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chromium-browser")
        if chromium_bin:
            cmd = [
                chromium_bin,
                f"--app={call_url}",
                "--use-fake-ui-for-media-stream",       # Auto-approves webcam & microphone without prompt
                "--autoplay-policy=no-user-gesture-required", # Allows audio/video autoplay
                "--no-first-run",
                "--disable-infobars",
                "--disable-session-crashed-bubble",
                "--window-size=1280,720",
                "--window-position=100,50",
                "--start-maximized"
            ]
            try:
                print(f"[LAPTOP-CALL] 🚀 DIRECTLY OPENING VIDEO CALL INTERFACE ON LAPTOP SCREEN: {call_url}")
                proc = subprocess.Popen(
                    cmd,
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    preexec_fn=os.setsid
                )
                _active_laptop_call_proc = proc
            except Exception as e:
                print(f"[LAPTOP-CALL] Failed to spawn Chromium: {e}, falling back to xdg-open")
                _active_laptop_call_proc = subprocess.Popen(["xdg-open", call_url], env=env)
        else:
            print(f"[LAPTOP-CALL] Opening call URL via xdg-open: {call_url}")
            _active_laptop_call_proc = subprocess.Popen(["xdg-open", call_url], env=env)

def close_laptop_call_interface():
    """Closes the laptop video call window when the call terminates."""
    global _active_laptop_call_proc
    with _proc_lock:
        if _active_laptop_call_proc and _active_laptop_call_proc.poll() is None:
            try:
                print("[LAPTOP-CALL] Terminating laptop video call window...")
                _active_laptop_call_proc.terminate()
                _active_laptop_call_proc.wait(timeout=1.5)
            except Exception:
                try:
                    _active_laptop_call_proc.kill()
                except Exception:
                    pass
            finally:
                _active_laptop_call_proc = None

def handle_incoming_call_on_laptop(session_id: str, server_base: str = "https://smart-remote-app-production.up.railway.app"):
    """Directly opens video call interface on Kali Linux screen and alerts via speakers — ZERO notifications/requests to click."""
    print(f"[LAPTOP-CALL] 📞 Instant direct video call from mobile! Session ID: {session_id}")
    # 1. Play alert chime
    threading.Thread(target=play_ringtone, daemon=True).start()
    # 2. Directly open full video call interface on laptop screen immediately
    threading.Thread(target=open_laptop_call_interface, args=(session_id, server_base), daemon=True).start()

