import os
import sys
import time
import json
import asyncio
import subprocess
import threading

def play_ringtone(duration_sec=3):
    """Plays an alert chime on Kali Linux laptop speakers."""
    try:
        # Use speaker unmuting
        subprocess.run(["amixer", "set", "Master", "unmute", "95%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Synthetic ringtone using ffplay / aplay
        ring_cmd = "ffplay -nodisp -autoexit -loglevel quiet -f lavfi -i 'sine=frequency=800:duration=0.2,sine=frequency=1000:duration=0.2' 2>/dev/null"
        subprocess.run(ring_cmd, shell=True, timeout=5)
    except Exception as e:
        print(f"[LAPTOP-CALL] Ringtone notice: {e}")

def notify_desktop(title: str, message: str):
    """Displays a desktop notification on Kali Linux X11 display :0.0."""
    try:
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0.0"
        subprocess.Popen(["notify-send", "-u", "critical", "-t", "10000", title, message], env=env)
    except Exception:
        pass

def handle_incoming_call_on_laptop(session_id: str):
    """Executed when mobile user calls the laptop."""
    print(f"[LAPTOP-CALL] 📞 Incoming video call from mobile device! Session ID: {session_id}")
    threading.Thread(target=play_ringtone, daemon=True).start()
    notify_desktop("📞 Incoming Video Call", f"Mobile user is calling! Opening Smart Remote video call...")
