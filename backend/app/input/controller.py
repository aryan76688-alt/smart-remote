import subprocess
import os
import time
import re
import ctypes
import ctypes.util
from typing import List, Optional, Tuple

class InputController:
    def __init__(self):
        self.display = os.environ.get("DISPLAY", ":0")
        self._x11 = None
        self._xtst = None
        self._disp = None
        self._root = None
        self._init_native_x11()

    def _init_native_x11(self):
        try:
            x11_name = ctypes.util.find_library('X11') or 'libX11.so.6'
            xtst_name = ctypes.util.find_library('Xtst') or 'libXtst.so.6'
            self._x11 = ctypes.cdll.LoadLibrary(x11_name)
            self._xtst = ctypes.cdll.LoadLibrary(xtst_name)

            self._x11.XOpenDisplay.restype = ctypes.c_void_p
            self._x11.XDefaultRootWindow.restype = ctypes.c_ulong
            self._x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]

            disp_bytes = self.display.encode('utf-8') if self.display else b':0'
            self._disp = self._x11.XOpenDisplay(disp_bytes)
            if self._disp:
                self._root = self._x11.XDefaultRootWindow(self._disp)
        except Exception as e:
            self._x11 = None
            self._xtst = None
            self._disp = None
            self._root = None

    def _run_xdotool(self, *args) -> Tuple[bool, str]:
        cmd = ["xdotool"] + list(args)
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display
        try:
            res = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
            return (res.returncode == 0, res.stdout.strip())
        except Exception as e:
            return (False, str(e))

    def get_mouse_position(self) -> Optional[Tuple[int, int]]:
        """Ultra-fast 0.5ms pointer query directly from X11 memory."""
        if self._x11 and self._disp and self._root:
            try:
                root_ret = ctypes.c_ulong()
                child_ret = ctypes.c_ulong()
                root_x = ctypes.c_int()
                root_y = ctypes.c_int()
                win_x = ctypes.c_int()
                win_y = ctypes.c_int()
                mask = ctypes.c_uint()
                self._x11.XQueryPointer(
                    self._disp, self._root,
                    ctypes.byref(root_ret), ctypes.byref(child_ret),
                    ctypes.byref(root_x), ctypes.byref(root_y),
                    ctypes.byref(win_x), ctypes.byref(win_y),
                    ctypes.byref(mask)
                )
                return (root_x.value, root_y.value)
            except Exception:
                pass
        return None

    # --- Mouse Pointer & Clicks (Sub-millisecond Low-Latency) ---
    def move_relative(self, dx: float, dy: float) -> bool:
        idx = int(round(dx))
        idy = int(round(dy))
        if idx == 0 and idy == 0:
            return True
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeRelativeMotionEvent(self._disp, idx, idy, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("mousemove_relative", "--", str(idx), str(idy))
        return ok

    def move_absolute(self, x: float, y: float) -> bool:
        ix = int(round(x))
        iy = int(round(y))
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeMotionEvent(self._disp, 0, ix, iy, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("mousemove", str(ix), str(iy))
        return ok

    def click(self, button: int = 1) -> bool:
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeButtonEvent(self._disp, button, 1, 0)
                self._xtst.XTestFakeButtonEvent(self._disp, button, 0, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("click", str(button))
        return ok

    def double_click(self, button: int = 1) -> bool:
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeButtonEvent(self._disp, button, 1, 0)
                self._xtst.XTestFakeButtonEvent(self._disp, button, 0, 0)
                self._xtst.XTestFakeButtonEvent(self._disp, button, 1, 0)
                self._xtst.XTestFakeButtonEvent(self._disp, button, 0, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("click", "--repeat", "2", "--delay", "80", str(button))
        return ok

    def mouse_down(self, button: int = 1) -> bool:
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeButtonEvent(self._disp, button, 1, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("mousedown", str(button))
        return ok

    def mouse_up(self, button: int = 1) -> bool:
        if self._xtst and self._disp:
            try:
                self._xtst.XTestFakeButtonEvent(self._disp, button, 0, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass
        ok, _ = self._run_xdotool("mouseup", str(button))
        return ok

    def scroll(self, delta_y: float = 0.0, delta_x: float = 0.0) -> bool:
        if self._xtst and self._disp:
            try:
                if delta_y != 0:
                    btn = 4 if delta_y > 0 else 5  # 4=Up, 5=Down
                    steps = max(1, min(10, int(abs(delta_y))))
                    for _ in range(steps):
                        self._xtst.XTestFakeButtonEvent(self._disp, btn, 1, 0)
                        self._xtst.XTestFakeButtonEvent(self._disp, btn, 0, 0)
                if delta_x != 0:
                    btn = 6 if delta_x < 0 else 7  # 6=Left, 7=Right
                    steps = max(1, min(10, int(abs(delta_x))))
                    for _ in range(steps):
                        self._xtst.XTestFakeButtonEvent(self._disp, btn, 1, 0)
                        self._xtst.XTestFakeButtonEvent(self._disp, btn, 0, 0)
                self._x11.XFlush(self._disp)
                return True
            except Exception:
                pass

        success = True
        if delta_y != 0:
            btn = "4" if delta_y > 0 else "5"
            steps = max(1, min(10, int(abs(delta_y))))
            for _ in range(steps):
                ok, _ = self._run_xdotool("click", btn)
                if not ok:
                    success = False
        if delta_x != 0:
            btn = "6" if delta_x < 0 else "7"
            steps = max(1, min(10, int(abs(delta_x))))
            for _ in range(steps):
                ok, _ = self._run_xdotool("click", btn)
                if not ok:
                    success = False
        return success

    # --- D-Pad Directional Movement ---
    def dpad_move(self, direction: str, step: int = 20, precision: bool = False) -> bool:
        dist = 5 if precision else step
        dx, dy = 0, 0
        d = direction.lower().strip()
        if d == "up":
            dy = -dist
        elif d == "down":
            dy = dist
        elif d == "left":
            dx = -dist
        elif d == "right":
            dx = dist
        elif d in ("up-left", "upleft"):
            dx = -int(dist * 0.7)
            dy = -int(dist * 0.7)
        elif d in ("up-right", "upright"):
            dx = int(dist * 0.7)
            dy = -int(dist * 0.7)
        elif d in ("down-left", "downleft"):
            dx = -int(dist * 0.7)
            dy = int(dist * 0.7)
        elif d in ("down-right", "downright"):
            dx = int(dist * 0.7)
            dy = int(dist * 0.7)
        return self.move_relative(dx, dy)

    # --- Virtual Keyboard & Combos ---
    def key_press(self, key: str, modifiers: Optional[List[str]] = None) -> bool:
        key_map = {
            "enter": "Return",
            "return": "Return",
            "backspace": "BackSpace",
            "tab": "Tab",
            "esc": "Escape",
            "escape": "Escape",
            "space": "space",
            "caps": "Caps_Lock",
            "capslock": "Caps_Lock",
            "up": "Up",
            "down": "Down",
            "left": "Left",
            "right": "Right",
            "super": "Super_L",
            "win": "Super_L",
            "windows": "Super_L",
            "ctrl": "Control_L",
            "alt": "Alt_L",
            "shift": "Shift_L",
            "delete": "Delete",
            "del": "Delete",
            "insert": "Insert",
            "ins": "Insert",
            "home": "Home",
            "end": "End",
            "pageup": "Page_Up",
            "page_up": "Page_Up",
            "pagedown": "Page_Down",
            "page_down": "Page_Down",
            "prtscn": "Print",
            "print": "Print",
            "printscreen": "Print",
            "scrolllock": "Scroll_Lock",
            "scroll_lock": "Scroll_Lock",
            "pause": "Pause",
            "break": "Pause",
            "numlock": "Num_Lock",
            "num_lock": "Num_Lock",
            # Function keys F1 - F12
            "f1": "F1",
            "f2": "F2",
            "f3": "F3",
            "f4": "F4",
            "f5": "F5",
            "f6": "F6",
            "f7": "F7",
            "f8": "F8",
            "f9": "F9",
            "f10": "F10",
            "f11": "F11",
            "f12": "F12",
            # Keypad
            "kp_0": "KP_0", "kp_1": "KP_1", "kp_2": "KP_2", "kp_3": "KP_3", "kp_4": "KP_4",
            "kp_5": "KP_5", "kp_6": "KP_6", "kp_7": "KP_7", "kp_8": "KP_8", "kp_9": "KP_9",
            "kp_add": "KP_Add", "kp_subtract": "KP_Subtract", "kp_multiply": "KP_Multiply",
            "kp_divide": "KP_Divide", "kp_enter": "KP_Enter", "kp_decimal": "KP_Decimal",
        }
        target_key = key_map.get(key.lower(), key)
        if modifiers:
            mod_prefix = "+".join([m.lower() for m in modifiers])
            combo = f"{mod_prefix}+{target_key}"
            ok, _ = self._run_xdotool("key", combo)
        else:
            ok, _ = self._run_xdotool("key", target_key)
        return ok

    def key_down(self, key: str) -> bool:
        ok, _ = self._run_xdotool("keydown", key)
        return ok

    def key_up(self, key: str) -> bool:
        ok, _ = self._run_xdotool("keyup", key)
        return ok

    def type_text(self, text: str) -> bool:
        ok, _ = self._run_xdotool("type", "--delay", "12", text)
        return ok

    # --- Media / OTT Commands with Smart Window Switching ---
    def media_action(self, action: str, volume_level: Optional[int] = None) -> bool:
        act = action.lower()
        if act == "vol_up":
            ok, _ = self._run_xdotool("key", "XF86AudioRaiseVolume")
            return ok
        elif act == "vol_down":
            ok, _ = self._run_xdotool("key", "XF86AudioLowerVolume")
            return ok
        elif act == "mute":
            ok, _ = self._run_xdotool("key", "XF86AudioMute")
            return ok
        elif act == "play_pause":
            ok, _ = self._run_xdotool("key", "XF86AudioPlay")
            return ok
        elif act == "next":
            ok, _ = self._run_xdotool("key", "XF86AudioNext")
            return ok
        elif act == "prev":
            ok, _ = self._run_xdotool("key", "XF86AudioPrev")
            return ok
        elif act == "power":
            ok, _ = self._run_xdotool("key", "Super_L+l")
            return ok
        elif act == "seek_fwd":
            ok, _ = self._run_xdotool("key", "Right")
            return ok
        elif act == "seek_rew":
            ok, _ = self._run_xdotool("key", "Left")
            return ok
        elif act == "set_volume" and volume_level is not None:
            vol = max(0, min(100, volume_level))
            try:
                subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{vol}%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
            except Exception:
                return False
        return False

    def switch_to_window(self, search_pattern: str) -> bool:
        """Find an already open window matching pattern and switch/activate it instead of opening duplicate windows."""
        try:
            # First search by exact or case-insensitive window title
            ok, out = self._run_xdotool("search", "--name", search_pattern)
            if ok and out:
                wids = [w.strip() for w in out.splitlines() if w.strip()]
                if wids:
                    # Activate the first matching window and bring to top
                    last_wid = wids[-1]
                    self._run_xdotool("windowactivate", "--sync", last_wid)
                    self._run_xdotool("windowraise", last_wid)
                    return True
            
            # Also search by window class
            ok_cls, out_cls = self._run_xdotool("search", "--class", search_pattern)
            if ok_cls and out_cls:
                wids = [w.strip() for w in out_cls.splitlines() if w.strip()]
                if wids:
                    self._run_xdotool("windowactivate", "--sync", wids[-1])
                    self._run_xdotool("windowraise", wids[-1])
                    return True
        except Exception:
            pass
        return False

    def launch_ott(self, app_name: str) -> bool:
        ott_catalog = {
            "youtube": {"pattern": "YouTube", "url": "https://www.youtube.com"},
            "youtube_music": {"pattern": "YouTube Music", "url": "https://music.youtube.com"},
            "netflix": {"pattern": "Netflix", "url": "https://www.netflix.com"},
            "prime": {"pattern": "Prime Video", "url": "https://www.primevideo.com"},
            "spotify": {"pattern": "Spotify", "url": "https://open.spotify.com"},
            "disney": {"pattern": "Disney", "url": "https://www.disneyplus.com"},
            "twitch": {"pattern": "Twitch", "url": "https://www.twitch.tv"},
            "apple_tv": {"pattern": "Apple TV", "url": "https://tv.apple.com"},
            "hulu": {"pattern": "Hulu", "url": "https://www.hulu.com"},
            "crunchyroll": {"pattern": "Crunchyroll", "url": "https://www.crunchyroll.com"},
            "plex": {"pattern": "Plex", "url": "https://app.plex.tv"},
            "soundcloud": {"pattern": "SoundCloud", "url": "https://soundcloud.com"},
            "max": {"pattern": "Max", "url": "https://play.max.com"},
            "jiocinema": {"pattern": "JioCinema", "url": "https://www.jiocinema.com"},
            "hotstar": {"pattern": "Hotstar", "url": "https://www.hotstar.com"},
            "peacock": {"pattern": "Peacock", "url": "https://www.peacocktv.com"},
            "paramount": {"pattern": "Paramount", "url": "https://www.paramountplus.com"},
            "sonyliv": {"pattern": "Sony", "url": "https://www.sonyliv.com"},
            "zee5": {"pattern": "ZEE5", "url": "https://www.zee5.com"},
            "espn": {"pattern": "ESPN", "url": "https://www.espn.com/espnplus"},
            "dazn": {"pattern": "DAZN", "url": "https://www.dazn.com"},
            "vlc": {"pattern": "VLC", "url": "vlc"},
            "chrome": {"pattern": "Chrome", "url": "google-chrome"},
            "firefox": {"pattern": "Firefox", "url": "firefox"},
        }

        key = app_name.lower().replace(" ", "_").replace("+", "")
        item = ott_catalog.get(key)
        
        target_pattern = item["pattern"] if item else app_name
        target_url = item["url"] if item else (app_name if app_name.startswith("http") else f"https://{app_name}")

        # Rule: ALWAYS switch to already open window first to avoid duplicate browser tabs!
        if self.switch_to_window(target_pattern):
            return True

        # If not open, launch the URL
        try:
            subprocess.Popen(["xdg-open", target_url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            return False

    def unlock_screen(self) -> bool:
        """Wake up display, dismiss screensaver, and unlock session in Kali Linux X11 desktop without asking for password."""
        env = os.environ.copy()
        if "DISPLAY" not in env or not env["DISPLAY"]:
            env["DISPLAY"] = self.display
        uid = os.getuid()
        env["XDG_RUNTIME_DIR"] = f"/run/user/{uid}"
        env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path=/run/user/{uid}/bus"

        try:
            # 1. Force DPMS display power on and disable screensaver blanking
            subprocess.run(["xset", "dpms", "force", "on"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["xset", "s", "reset"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["xset", "s", "off"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)

            # 2. Systemd session unlock for all active desktop sessions
            subprocess.run(["loginctl", "unlock-sessions"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)

            # 3. Dismiss XFCE / Light-Locker / Gnome / XScreenSaver
            subprocess.run(["xfce4-screensaver-command", "--deactivate"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["xfce4-screensaver-command", "--exit"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["light-locker-command", "-d"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["gnome-screensaver-command", "-d"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)
            subprocess.run(["xscreensaver-command", "-deactivate"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)

            # 4. Gracefully terminate lockscreen dialogs if still blocking desktop
            subprocess.run(["pkill", "-f", "xfce4-screensaver-dialog"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1)

            # 5. Wake keys
            self._run_xdotool("key", "Escape")
            time.sleep(0.05)
            self._run_xdotool("key", "space")
            time.sleep(0.05)
            self._run_xdotool("key", "Return")

            # 6. Passwordless auto-unlock fallback: if a LightDM / PAM prompt is focused, auto-type password
            pwd = os.environ.get("SMART_REMOTE_SYSTEM_PASSWORD", "0001")
            time.sleep(0.05)
            self._run_xdotool("type", pwd)
            time.sleep(0.05)
            self._run_xdotool("key", "Return")

            return True
        except Exception as e:
            print(f"[UNLOCK] Unlock notice: {e}")
            return True

input_controller = InputController()
