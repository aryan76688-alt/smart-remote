import os
import subprocess
import time
import re
from typing import Tuple, Optional
from PIL import Image
import io

class ScreenStreamer:
    def __init__(self):
        self.display = os.environ.get("DISPLAY", ":0")
        self._cached_resolution: Optional[Tuple[int, int]] = None
        self._last_res_check = 0

    def get_resolution(self) -> Tuple[int, int]:
        now = time.time()
        if self._cached_resolution and (now - self._last_res_check) < 60:
            return self._cached_resolution
        
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display
            
        try:
            res = subprocess.run(["xrandr"], env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=2)
            # Find current resolution like "1920x1080"
            match = re.search(r"current\s+(\d+)\s+x\s+(\d+)", res.stdout)
            if match:
                self._cached_resolution = (int(match.group(1)), int(match.group(2)))
                self._last_res_check = now
                return self._cached_resolution
        except Exception:
            pass

        # Fallback default resolution
        self._cached_resolution = (1920, 1080)
        self._last_res_check = now
        return self._cached_resolution

    def capture_frame_jpeg(self, quality: int = 50, scale: Optional[float] = None) -> Optional[bytes]:
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display

        q = max(10, min(95, quality))
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
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = self.display
        
        fmt = "png" if format.lower() == "png" else "jpeg"
        cmd = ["import", "-window", "root", f"{fmt}:-"]
        try:
            proc = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=4)
            if proc.returncode == 0 and len(proc.stdout) > 0:
                return proc.stdout
        except Exception:
            pass
        return None

screen_streamer = ScreenStreamer()
