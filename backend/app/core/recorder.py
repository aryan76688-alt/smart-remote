import os
import time
import shutil
import threading
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from .camera import camera_core

class CCTVRecorder:
    """
    Background 30-Minute CCTV Recording Engine.
    Streams live MJPEG frames from Laptop Cam or Mobile CCTV directly into an
    FFmpeg H.264 MP4 pipeline (-movflags +faststart) with zero temporary frame files.
    Supports single 30-minute recordings or continuous rolling 30-minute loops.
    """

    DEFAULT_DURATION_SECONDS = 30 * 60  # 1800 seconds (30 minutes)
    MAX_STORED_CLIPS = 24
    TARGET_FPS = 10

    def __init__(self):
        self.project_root = Path(__file__).resolve().parent.parent.parent.parent
        self.recordings_dir = self.project_root / "recordings"
        self.recordings_dir.mkdir(parents=True, exist_ok=True)

        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._ffmpeg_proc: Optional[subprocess.Popen] = None

        self.recording: bool = False
        self.source: str = "laptop"  # "laptop" or "mobile"
        self.filename: Optional[str] = None
        self.started_at: float = 0.0
        self.max_seconds: int = self.DEFAULT_DURATION_SECONDS
        self.frames_written: int = 0
        self.continuous_loop: bool = False
        self.last_error: Optional[str] = None

    def start_recording(
        self,
        source: str = "laptop",
        duration_minutes: int = 30,
        continuous_loop: bool = False
    ) -> Dict[str, Any]:
        source = "mobile" if source == "mobile" else "laptop"
        duration_secs = max(60, min(int(duration_minutes) * 60, 1800))  # 1 min to 30 min

        with self._lock:
            if self.recording:
                return {
                    "success": True,
                    "message": f"Already recording {self.source}",
                    "status": self._build_status_unlocked()
                }

            self._stop_event.clear()
            self.recording = True
            self.source = source
            self.max_seconds = duration_secs
            self.continuous_loop = continuous_loop
            self.frames_written = 0
            self.last_error = None
            self.started_at = time.time()

            if source == "laptop":
                camera_core.start_laptop_cam()
            else:
                camera_core.set_mobile_cctv_requested(True)

            self._thread = threading.Thread(target=self._record_loop, daemon=True)
            self._thread.start()

            return {
                "success": True,
                "message": f"Started {duration_minutes}-minute {source} CCTV recording",
                "status": self._build_status_unlocked()
            }

    def stop_recording(self) -> Dict[str, Any]:
        with self._lock:
            if not self.recording:
                return {
                    "success": True,
                    "message": "No active recording",
                    "status": self._build_status_unlocked()
                }
            self.continuous_loop = False
            self._stop_event.set()
            was_source = self.source
            was_file = self.filename

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=4.0)

        return {
            "success": True,
            "message": f"Saved {was_source} CCTV clip: {was_file}",
            "filename": was_file,
            "status": self.get_status()
        }

    def _spawn_ffmpeg(self, output_path: Path) -> subprocess.Popen:
        ffmpeg_bin = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
        cmd = [
            ffmpeg_bin,
            "-y",
            "-loglevel", "error",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-framerate", str(self.TARGET_FPS),
            "-i", "-",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_path)
        ]
        return subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )

    def _record_loop(self):
        frame_interval = 1.0 / self.TARGET_FPS
        try:
            while not self._stop_event.is_set():
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                fname = f"cctv_{self.source}_{ts}.mp4"
                out_path = self.recordings_dir / fname

                with self._lock:
                    self.filename = fname
                    self.started_at = time.time()
                    self.frames_written = 0

                proc = self._spawn_ffmpeg(out_path)
                with self._lock:
                    self._ffmpeg_proc = proc

                segment_start = time.time()
                try:
                    while not self._stop_event.is_set():
                        elapsed = time.time() - segment_start
                        if elapsed >= self.max_seconds:
                            break

                        loop_t0 = time.time()
                        if self.source == "laptop":
                            frame = camera_core.get_laptop_frame()
                        else:
                            # Keep mobile camera awake during 30-min recording
                            camera_core.set_mobile_cctv_requested(True)
                            camera_core.mobile_last_active_time = time.time()
                            frame = camera_core.get_mobile_frame()

                        if frame and proc.stdin:
                            try:
                                proc.stdin.write(frame)
                                proc.stdin.flush()
                                with self._lock:
                                    self.frames_written += 1
                            except BrokenPipeError:
                                self.last_error = "FFmpeg encoder pipe closed unexpectedly"
                                break

                        sleep_time = frame_interval - (time.time() - loop_t0)
                        if sleep_time > 0:
                            self._stop_event.wait(timeout=sleep_time)
                finally:
                    try:
                        if proc.stdin:
                            proc.stdin.close()
                        proc.wait(timeout=8.0)
                    except Exception:
                        try:
                            proc.kill()
                        except Exception:
                            pass
                    with self._lock:
                        self._ffmpeg_proc = None

                # Prune very small/empty files if failed immediately
                if out_path.exists() and out_path.stat().st_size < 1024:
                    try:
                        out_path.unlink()
                    except Exception:
                        pass

                self._enforce_storage_cap()

                if not self.continuous_loop or self._stop_event.is_set():
                    break
        except Exception as e:
            self.last_error = str(e)
        finally:
            with self._lock:
                was_mobile = (self.source == "mobile")
                self.recording = False
                self._ffmpeg_proc = None
            if was_mobile:
                camera_core.set_mobile_cctv_requested(False)

    def _enforce_storage_cap(self):
        try:
            clips = sorted(
                self.recordings_dir.glob("cctv_*.mp4"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            for old_clip in clips[self.MAX_STORED_CLIPS:]:
                old_clip.unlink(missing_ok=True)
        except Exception:
            pass

    def _build_status_unlocked(self) -> Dict[str, Any]:
        elapsed = int(time.time() - self.started_at) if self.recording and self.started_at > 0 else 0
        elapsed = min(elapsed, self.max_seconds)
        remaining = max(0, self.max_seconds - elapsed)
        pct = round((elapsed / self.max_seconds) * 100.0, 1) if self.max_seconds > 0 else 0.0
        return {
            "recording": self.recording,
            "source": self.source,
            "filename": self.filename if self.recording else None,
            "elapsed_seconds": elapsed,
            "max_seconds": self.max_seconds,
            "remaining_seconds": remaining,
            "progress_percent": pct,
            "frames_written": self.frames_written,
            "continuous_loop": self.continuous_loop,
            "last_error": self.last_error
        }

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return self._build_status_unlocked()

    def list_recordings(self) -> List[Dict[str, Any]]:
        items = []
        active_file = self.filename if self.recording else None
        for f in sorted(self.recordings_dir.glob("cctv_*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                stat = f.stat()
                parts = f.stem.split("_")
                src = parts[1] if len(parts) > 1 else "laptop"
                items.append({
                    "filename": f.name,
                    "source": src,
                    "size_bytes": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "is_active": (f.name == active_file),
                    "stream_url": f"/api/cctv/recordings/play/{f.name}",
                    "download_url": f"/api/cctv/recordings/download/{f.name}"
                })
            except Exception:
                continue
        return items

    def get_recording_path(self, filename: str) -> Optional[Path]:
        safe_name = os.path.basename(filename)
        if not safe_name.endswith(".mp4"):
            return None
        target = (self.recordings_dir / safe_name).resolve()
        if not str(target).startswith(str(self.recordings_dir.resolve())):
            return None
        return target if target.is_file() else None

    def delete_recording(self, filename: str) -> bool:
        if self.recording and self.filename == filename:
            return False
        target = self.get_recording_path(filename)
        if target and target.exists():
            target.unlink()
            return True
        return False

cctv_recorder = CCTVRecorder()
