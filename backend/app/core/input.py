import os
import sys
import time
import ctypes
from ctypes import c_int, c_uint, c_ulong, c_char_p, c_void_p, POINTER, Structure

class InputController:
    """High-performance 64-bit X11/XTest input controller."""

    def __init__(self):
        self.display = None
        self.x11 = None
        self.xtst = None
        self.screen_width = 1920
        self.screen_height = 1080
        self._init_x11()

    def _init_x11(self):
        # Auto-detect display if not set
        if not os.environ.get("DISPLAY"):
            for disp in [":0", ":1", ":10"]:
                if os.path.exists(f"/tmp/.X11-unix/X{disp.replace(':', '')}"):
                    os.environ["DISPLAY"] = disp
                    break
            if not os.environ.get("DISPLAY"):
                os.environ["DISPLAY"] = ":0"

        # Auto-detect XAUTHORITY if not set
        if not os.environ.get("XAUTHORITY"):
            for auth in [
                os.path.expanduser("~/.Xauthority"),
                "/run/user/1001/xauth_*",
                "/run/user/1000/xauth_*"
            ]:
                import glob
                matches = glob.glob(auth)
                if matches:
                    os.environ["XAUTHORITY"] = matches[0]
                    break

        try:
            self.x11 = ctypes.cdll.LoadLibrary("libX11.so.6")
            self.xtst = ctypes.cdll.LoadLibrary("libXtst.so.6")

            # Setup 64-bit ctypes signatures
            self.x11.XOpenDisplay.argtypes = [c_char_p]
            self.x11.XOpenDisplay.restype = c_void_p

            self.x11.XCloseDisplay.argtypes = [c_void_p]
            self.x11.XCloseDisplay.restype = c_int

            self.x11.XFlush.argtypes = [c_void_p]
            self.x11.XFlush.restype = c_int

            self.x11.XDefaultScreen.argtypes = [c_void_p]
            self.x11.XDefaultScreen.restype = c_int

            self.x11.XDisplayWidth.argtypes = [c_void_p, c_int]
            self.x11.XDisplayWidth.restype = c_int

            self.x11.XDisplayHeight.argtypes = [c_void_p, c_int]
            self.x11.XDisplayHeight.restype = c_int

            self.xtst.XTestFakeMotionEvent.argtypes = [c_void_p, c_int, c_int, c_int, c_ulong]
            self.xtst.XTestFakeMotionEvent.restype = c_int

            self.xtst.XTestFakeRelativeMotionEvent.argtypes = [c_void_p, c_int, c_int, c_ulong]
            self.xtst.XTestFakeRelativeMotionEvent.restype = c_int

            self.xtst.XTestFakeButtonEvent.argtypes = [c_void_p, c_uint, c_int, c_ulong]
            self.xtst.XTestFakeButtonEvent.restype = c_int

            self.xtst.XTestFakeKeyEvent.argtypes = [c_void_p, c_uint, c_int, c_ulong]
            self.xtst.XTestFakeKeyEvent.restype = c_int

            self.x11.XKeysymToKeycode.argtypes = [c_void_p, c_ulong]
            self.x11.XKeysymToKeycode.restype = c_uint

            self.x11.XStringToKeysym.argtypes = [c_char_p]
            self.x11.XStringToKeysym.restype = c_ulong

            self.display = self.x11.XOpenDisplay(None)
            if self.display:
                screen = self.x11.XDefaultScreen(self.display)
                self.screen_width = self.x11.XDisplayWidth(self.display, screen)
                self.screen_height = self.x11.XDisplayHeight(self.display, screen)
        except Exception as e:
            print(f"[InputController] X11 initialization error: {e}", file=sys.stderr)

    def move_cursor_relative(self, dx: int, dy: int):
        if not self.display:
            return False
        try:
            self.xtst.XTestFakeRelativeMotionEvent(self.display, int(dx), int(dy), 0)
            self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def move_cursor_absolute(self, x: int, y: int):
        if not self.display:
            return False
        try:
            screen = self.x11.XDefaultScreen(self.display)
            self.xtst.XTestFakeMotionEvent(self.display, screen, int(x), int(y), 0)
            self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def click(self, button: int = 1, double: bool = False):
        if not self.display:
            return False
        try:
            # button: 1=left, 2=middle, 3=right
            self.xtst.XTestFakeButtonEvent(self.display, int(button), 1, 0)
            self.xtst.XTestFakeButtonEvent(self.display, int(button), 0, 0)
            self.x11.XFlush(self.display)
            if double:
                time.sleep(0.05)
                self.xtst.XTestFakeButtonEvent(self.display, int(button), 1, 0)
                self.xtst.XTestFakeButtonEvent(self.display, int(button), 0, 0)
                self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def mouse_down(self, button: int = 1):
        if not self.display:
            return False
        try:
            self.xtst.XTestFakeButtonEvent(self.display, int(button), 1, 0)
            self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def mouse_up(self, button: int = 1):
        if not self.display:
            return False
        try:
            self.xtst.XTestFakeButtonEvent(self.display, int(button), 0, 0)
            self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def scroll(self, dy: int):
        if not self.display:
            return False
        try:
            # button 4=up, 5=down
            btn = 4 if dy < 0 else 5
            steps = min(abs(int(dy)), 15)
            for _ in range(max(1, steps)):
                self.xtst.XTestFakeButtonEvent(self.display, btn, 1, 0)
                self.xtst.XTestFakeButtonEvent(self.display, btn, 0, 0)
            self.x11.XFlush(self.display)
            return True
        except Exception:
            return False

    def type_text(self, text: str):
        # Fallback to xdotool for complex unicode text typing
        import subprocess
        try:
            subprocess.run(["xdotool", "type", "--delay", "5", "--", text], check=False)
            return True
        except Exception:
            return False

    def send_shortcut(self, shortcut: str):
        # e.g. "ctrl+c", "alt+Tab", "Super_L"
        import subprocess
        try:
            subprocess.run(["xdotool", "key", shortcut], check=False)
            return True
        except Exception:
            return False

input_controller = InputController()
