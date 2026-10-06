import os
import subprocess
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/clipboard", tags=["clipboard"])

class ClipboardSetRequest(BaseModel):
    text: str
    type_immediately: bool = False

@router.get("")
def get_clipboard():
    """
    Read text currently on host clipboard.
    """
    env = os.environ.copy()
    env["DISPLAY"] = ":0"

    text = ""
    try:
        res = subprocess.run(["xclip", "-o", "-selection", "clipboard"], env=env, capture_output=True, text=True, timeout=1.5)
        if res.returncode == 0:
            text = res.stdout
        else:
            # Try primary selection
            res_prim = subprocess.run(["xclip", "-o", "-selection", "primary"], env=env, capture_output=True, text=True, timeout=1.5)
            if res_prim.returncode == 0:
                text = res_prim.stdout
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}

    return {"success": True, "text": text, "length": len(text)}

@router.post("")
def set_clipboard(req: ClipboardSetRequest):
    """
    Set host clipboard text and optionally type it via xdotool.
    """
    env = os.environ.copy()
    env["DISPLAY"] = ":0"

    try:
        p = subprocess.Popen(["xclip", "-selection", "clipboard"], env=env, stdin=subprocess.PIPE, text=True)
        p.communicate(input=req.text, timeout=2)

        # Also populate primary selection for middle-click paste
        p_prim = subprocess.Popen(["xclip", "-selection", "primary"], env=env, stdin=subprocess.PIPE, text=True)
        p_prim.communicate(input=req.text, timeout=2)

        typed = False
        if req.type_immediately and req.text:
            subprocess.run(["xdotool", "type", "--delay", "12", req.text], env=env, timeout=5)
            typed = True

        return {"success": True, "length": len(req.text), "typed": typed}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/clear")
def clear_clipboard():
    """
    Wipe clipboard contents securely.
    """
    env = os.environ.copy()
    env["DISPLAY"] = ":0"
    try:
        p = subprocess.Popen(["xclip", "-selection", "clipboard"], env=env, stdin=subprocess.PIPE, text=True)
        p.communicate(input="", timeout=1)
        p_prim = subprocess.Popen(["xclip", "-selection", "primary"], env=env, stdin=subprocess.PIPE, text=True)
        p_prim.communicate(input="", timeout=1)
        return {"success": True, "message": "Clipboard cleared"}
    except Exception as e:
        return {"success": False, "error": str(e)}
