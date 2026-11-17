import os
import subprocess
import time
import re
import threading
from typing import Tuple, Optional
import ctypes
from ctypes import c_void_p, c_int, c_uint, c_ulong, Structure, POINTER, c_char_p

try:
    import numpy as np
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False


class _XImage(Structure):
    _fields_ = [
        ('width', c_int),
        ('height', c_int),
        ('xoffset', c_int),
        ('format', c_int),
        ('data', c_void_p),
        ('byte_order', c_int),
        ('bitmap_unit', c_int),
        ('bitmap_bit_order', c_int),
        ('bitmap_pad', c_int),
        ('depth', c_int),
        ('bytes_per_line', c_int),
        ('bits_per_pixel', c_int),
        ('red_mask', c_ulong),
        ('green_mask', c_ulong),
        ('blue_mask', c_ulong),
    ]


class ScreenStreamer:
    def __init__(self):
        self.display_name = os.environ.get("DISPLAY", ":0")
        self._cached_resolution: Optional[Tuple[int, int]] = None
        self._last_res_check = 0.0
        self._lock = threading.Lock()
        
        # X11 Ctypes setup
        self._x11 = None
        self._disp = None
        self._root = None
        self._x11_width = 0
        self._x11_height = 0
        self._init_x11()

    def _init_x11(self):
        try:
            self._x11 = ctypes.cdll.LoadLibrary('libX11.so.6')
            self._x11.XOpenDisplay.argtypes = [c_char_p]
            self._x11.XOpenDisplay.restype = c_void_p
            self._x11.XCloseDisplay.argtypes = [c_void_p]
            self._x11.XCloseDisplay.restype = c_int
            self._x11.XDefaultRootWindow.argtypes = [c_void_p]
            self._x11.XDefaultRootWindow.restype = c_ulong
            self._x11.XDefaultScreen.argtypes = [c_void_p]
            self._x11.XDefaultScreen.restype = c_int
            self._x11.XDisplayWidth.argtypes = [c_void_p, c_int]
            self._x11.XDisplayWidth.restype = c_int
            self._x11.XDisplayHeight.argtypes = [c_void_p, c_int]
            self._x11.XDisplayHeight.restype = c_int
            self._x11.XGetImage.argtypes = [c_void_p, c_ulong, c_int, c_int, c_uint, c_uint, c_ulong, c_int]
            self._x11.XGetImage.restype = POINTER(_XImage)
            self._x11.XDestroyImage.argtypes = [POINTER(_XImage)]
            self._x11.XDestroyImage.restype = c_int

            disp_bytes = self.display_name.encode('utf-8')
            self._disp = self._x11.XOpenDisplay(disp_bytes)
            if self._disp:
                screen = self._x11.XDefaultScreen(self._disp)
                self._x11_width = self._x11.XDisplayWidth(self._disp, screen)
                self._x11_height = self._x11.XDisplayHeight(self._disp, screen)
                self._root = self._x11.XDefaultRootWindow(self._disp)
                self._cached_resolution = (self._x11_width, self._x11_height)
                self._last_res_check = time.time()
        except Exception:
            self._disp = None

    def get_resolution(self) -> Tuple[int, int]:
        now = time.time()
        if self._cached_resolution and (now - self._last_res_check) < 30:
            return self._cached_resolution
        
        # Try X11 directly
        if self._disp and self._x11:
            try:
                screen = self._x11.XDefaultScreen(self._disp)
                w = self._x11.XDisplayWidth(self._disp, screen)
                h = self._x11.XDisplayHeight(self._disp, screen)
                if w > 0 and h > 0:
                    self._x11_width = w
                    self._x11_height = h
                    self._cached_resolution = (w, h)
                    self._last_res_check = now
                    return self._cached_resolution
            except Exception:
                pass

        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display_name
            
        try:
            res = subprocess.run(["xrandr"], env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=2)
            match = re.search(r"current\s+(\d+)\s+x\s+(\d+)", res.stdout)
            if match:
                self._cached_resolution = (int(match.group(1)), int(match.group(2)))
                self._last_res_check = now
                return self._cached_resolution
        except Exception:
            pass

        # Fallback default resolution
        self._cached_resolution = (1366, 768)
        self._last_res_check = now
        return self._cached_resolution

    def capture_frame_jpeg(self, quality: int = 35, scale: Optional[float] = None) -> Optional[bytes]:
        """
        Fast in-memory capture using libX11 XGetImage and OpenCV imencode.
        Falls back to ImageMagick `import` if X11 or OpenCV are unavailable.
        """
        q = max(10, min(95, quality))
        
        # 1. Fast in-memory path via ctypes + OpenCV
        if _HAS_CV2 and self._x11:
            with self._lock:
                if not self._disp:
                    self._init_x11()
                
                if self._disp and self._root and self._x11_width > 0 and self._x11_height > 0:
                    try:
                        # 0x00FFFFFF = AllPlanes, 2 = ZPixmap
                        img_ptr = self._x11.XGetImage(
                            self._disp, self._root, 0, 0,
                            self._x11_width, self._x11_height,
                            0x00FFFFFF, 2
                        )
                        if img_ptr:
                            try:
                                img = img_ptr.contents
                                raw_array = np.ctypeslib.as_array(
                                    ctypes.cast(img.data, POINTER(ctypes.c_uint8)),
                                    shape=(img.height, img.bytes_per_line)
                                )
                                # Slice BGRA to BGR
                                bgr = raw_array[:, :img.width * 4].reshape((img.height, img.width, 4))[:, :, :3]
                                
                                if scale and 0.1 <= scale < 1.0:
                                    bgr = cv2.resize(bgr, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
                                
                                _, encoded = cv2.imencode('.jpg', bgr, [int(cv2.IMWRITE_JPEG_QUALITY), q])
                                return bytes(encoded.tobytes())
                            finally:
                                self._x11.XDestroyImage(img_ptr)
                    except Exception:
                        # Reset connection on failure
                        self._disp = None

        # 2. Fallback to ImageMagick import
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display_name

        cmd = ["import", "-window", "root", "-quality", str(q)]
        if scale and 0.1 <= scale < 1.0:
            percent = int(scale * 100)
            cmd.extend(["-resize", f"{percent}%"])
        cmd.append("jpeg:-")

        try:
            proc = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2)
            if proc.returncode == 0 and len(proc.stdout) > 0:
                return proc.stdout
        except Exception:
            pass
        return None

    def capture_screenshot(self, format: str = "png") -> Optional[bytes]:
        """Capture a crisp full-resolution screenshot."""
        fmt = "png" if format.lower() == "png" else "jpeg"
        
        # Fast path via ctypes + OpenCV
        if _HAS_CV2 and self._x11:
            with self._lock:
                if not self._disp:
                    self._init_x11()
                if self._disp and self._root and self._x11_width > 0 and self._x11_height > 0:
                    try:
                        img_ptr = self._x11.XGetImage(
                            self._disp, self._root, 0, 0,
                            self._x11_width, self._x11_height,
                            0x00FFFFFF, 2
                        )
                        if img_ptr:
                            try:
                                img = img_ptr.contents
                                raw_array = np.ctypeslib.as_array(
                                    ctypes.cast(img.data, POINTER(ctypes.c_uint8)),
                                    shape=(img.height, img.bytes_per_line)
                                )
                                bgr = raw_array[:, :img.width * 4].reshape((img.height, img.width, 4))[:, :, :3]
                                ext = f".{fmt}"
                                _, encoded = cv2.imencode(ext, bgr)
                                return bytes(encoded.tobytes())
                            finally:
                                self._x11.XDestroyImage(img_ptr)
                    except Exception:
                        self._disp = None

        # Fallback to ImageMagick import
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display_name
        
        cmd = ["import", "-window", "root", f"{fmt}:-"]
        try:
            proc = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=4)
            if proc.returncode == 0 and len(proc.stdout) > 0:
                return proc.stdout
        except Exception:
            pass
        return None

screen_streamer = ScreenStreamer()
