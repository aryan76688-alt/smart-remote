import os
import time
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/clipboard", tags=["clipboard"])

CLIPBOARD_FILE = Path(os.path.expanduser("~/.cache/smart_remote_clipboard.txt"))
CLIPBOARD_FILE.parent.mkdir(parents=True, exist_ok=True)

_clipboard_memory = {
    "text": "",
    "updated_at": time.time(),
    "source": "pearOS"
}

# Pre-load initial text if cached
if CLIPBOARD_FILE.exists():
    try:
        _clipboard_memory["text"] = CLIPBOARD_FILE.read_text(encoding="utf-8")
    except Exception:
        pass

class ClipboardSetRequest(BaseModel):
    text: str
    type_immediately: bool = False
    source: str = "mobile"

def _try_system_read() -> str:
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0"

    # Try wl-paste (Wayland)
    try:
        res = subprocess.run(["wl-paste"], env=env, capture_output=True, text=True, timeout=0.8)
        if res.returncode == 0:
            return res.stdout
    except Exception:
        pass

    # Try xclip (X11)
    try:
        res = subprocess.run(["xclip", "-o", "-selection", "clipboard"], env=env, capture_output=True, text=True, timeout=0.8)
        if res.returncode == 0:
            return res.stdout
    except Exception:
        pass

    return ""

def _try_system_write(text: str, type_immediately: bool = False):
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0"

    # Try wl-copy (Wayland)
    try:
        p = subprocess.Popen(["wl-copy"], env=env, stdin=subprocess.PIPE, text=True)
        p.communicate(input=text, timeout=1.0)
    except Exception:
        pass

    # Try xclip (X11)
    try:
        p = subprocess.Popen(["xclip", "-selection", "clipboard"], env=env, stdin=subprocess.PIPE, text=True)
        p.communicate(input=text, timeout=1.0)
    except Exception:
        pass

    if type_immediately and text:
        try:
            subprocess.run(["xdotool", "type", "--delay", "12", text], env=env, timeout=3.0)
        except Exception:
            pass

@router.get("")
def get_clipboard():
    """
    Read text currently on host clipboard.
    Seamlessly returns synchronized text between pearOS and mobile.
    """
    sys_text = _try_system_read()
    if sys_text and sys_text != _clipboard_memory["text"]:
        _clipboard_memory["text"] = sys_text
        _clipboard_memory["updated_at"] = time.time()
        _clipboard_memory["source"] = "pearOS"
        try:
            CLIPBOARD_FILE.write_text(sys_text, encoding="utf-8")
        except Exception:
            pass

    return {
        "success": True,
        "text": _clipboard_memory["text"],
        "length": len(_clipboard_memory["text"]),
        "updated_at": _clipboard_memory["updated_at"],
        "source": _clipboard_memory["source"]
    }

@router.post("")
def set_clipboard(req: ClipboardSetRequest):
    """
    Set host clipboard text and broadcast to connected mobile devices.
    """
    _clipboard_memory["text"] = req.text
    _clipboard_memory["updated_at"] = time.time()
    _clipboard_memory["source"] = req.source or "mobile"

    try:
        CLIPBOARD_FILE.write_text(req.text, encoding="utf-8")
    except Exception:
        pass

    _try_system_write(req.text, req.type_immediately)

    return {
        "success": True,
        "length": len(req.text),
        "updated_at": _clipboard_memory["updated_at"],
        "source": _clipboard_memory["source"],
        "message": "Universal Clipboard updated"
    }

@router.post("/clear")
def clear_clipboard():
    """
    Wipe clipboard contents securely.
    """
    _clipboard_memory["text"] = ""
    _clipboard_memory["updated_at"] = time.time()
    try:
        CLIPBOARD_FILE.write_text("", encoding="utf-8")
    except Exception:
        pass
    _try_system_write("")
    return {"success": True, "message": "Universal Clipboard cleared"}
