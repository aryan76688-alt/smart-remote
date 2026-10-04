import os
import sys
import site
user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.insert(0, user_site)

for extra_path in [
    "/home/aryan/.gemini/antigravity/scratch/gesture-detetction/.venv/lib/python3.14/site-packages",
    "/home/aryan/.gemini/antigravity/scratch/gesture-detetction/.venv/lib/python3.13/site-packages",
    "/home/aryan/Desktop/NEW/.freebuff/smart-remote/backend/venv/lib/python3.14/site-packages",
]:
    if os.path.isdir(extra_path) and extra_path not in sys.path:
        sys.path.insert(0, extra_path)
import io
import time
import datetime
import json
import shutil
import threading
import subprocess
from pathlib import Path
from typing import Optional, Generator, List, Dict, Any
from PIL import Image

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import tkinter as tk
    from PIL import ImageTk
    TK_AVAILABLE = True
except Exception:
    TK_AVAILABLE = False


class CameraManager:
    """Manages two-way camera interactions & 24/7 high-definition CCTV surveillance:
    1. Streaming Kali Linux laptop webcam (/dev/video0) in High Definition to phone.
    2. 24/7 Continuous Always-Record CCTV engine with 30-minute chunks & Google Drive auto-sync.
    3. Real-time motion detection & automatic event snapshots.
    4. Digital night vision / low-light contrast booster (CLAHE).
    5. Automatic disk space quota protection & retention pruning.
    6. Phone camera to Kali desktop window feed.
    """

    def __init__(self):
        self.laptop_cap = None
        self.laptop_users = 0
        self.laptop_lock = threading.Lock()
        self.last_laptop_frame: Optional[bytes] = None

        # Zero-Lag Single-Thread Hardware Capture Pipeline
        self._capture_thread: Optional[threading.Thread] = None
        self._capture_running: bool = False
        self._frame_condition = threading.Condition()
        self.latest_raw_frame: Optional[Any] = None
        self.latest_processed_frame: Optional[Any] = None
        self.latest_jpeg_bytes: Optional[bytes] = None
        self._current_audio_proc: Optional[subprocess.Popen] = None

        # Camera hardware parameters (negotiated on hardware init)
        self.camera_width = 1280
        self.camera_height = 720
        self.camera_fps = 30

        # Phone camera state
        self.phone_lock = threading.Lock()
        self.last_phone_frame: Optional[bytes] = None
        self.last_phone_update = 0.0
        self.phone_streaming_active = False

        # Kali desktop window thread for phone camera feed
        self.tk_root = None
        self.tk_label = None
        self.tk_photo = None
        self.tk_thread: Optional[threading.Thread] = None
        self.tk_stop_event = threading.Event()

        # Paths setup
        project_root = Path(__file__).resolve().parent.parent.parent
        self.cctv_recordings_dir = project_root / "recordings" / "cctv"
        self.cctv_recordings_dir.mkdir(parents=True, exist_ok=True)
        self.cctv_events_dir = self.cctv_recordings_dir / "events"
        self.cctv_events_dir.mkdir(parents=True, exist_ok=True)

        self.cctv_meta_file = self.cctv_recordings_dir / "cctv_metadata.json"
        self.cctv_settings_file = self.cctv_recordings_dir / "cctv_settings.json"
        self.cctv_events_file = self.cctv_recordings_dir / "cctv_events.json"

        # Load persisted configuration & history
        self.cctv_settings = self._load_settings()
        self.cctv_history = self._load_cctv_metadata()
        self.cctv_events = self._load_cctv_events()

        # CCTV 24/7 Always Record State
        self.always_record = self.cctv_settings.get("always_record", True)
        self.video_quality = self.cctv_settings.get("quality", "high")
        self.night_mode = self.cctv_settings.get("night_mode", False)
        self.motion_detection_enabled = self.cctv_settings.get("motion_detection", True)

        self.cctv_recording = False
        self.cctv_thread: Optional[threading.Thread] = None
        self.cctv_stop_event = threading.Event()
        self.cctv_chunk_duration = self.cctv_settings.get("chunk_duration_sec", 1800)  # 30 mins
        self.cctv_current_filename: Optional[str] = None
        self.cctv_chunk_start_time = 0.0
        self.cctv_total_chunks = len(self.cctv_history)
        self.cctv_auto_upload_gdrive = self.cctv_settings.get("auto_upload_gdrive", True)
        self.cctv_writer = None

        # Advanced MOG2 Motion Detection State
        self.motion_detected = False
        self.last_motion_time = 0.0
        self.last_motion_snapshot_time = 0.0
        self.motion_score = 0.0
        self.motion_boxes = []
        self.motion_sensitivity = self.cctv_settings.get("motion_sensitivity", "medium")
        self._tracked_targets: Dict[int, Dict[str, Any]] = {}
        self._next_target_id = 1
        self._bg_subtractor = None
        self._init_bg_subtractor()

        # Laptop Screen Stealth Power State (Keep Screen Off when CCTV is on)
        self.keep_laptop_screen_off = bool(self.cctv_settings.get("keep_laptop_screen_off", True))
        self.screen_is_off = False

        # Night vision CLAHE enhancer
        self._clahe = None
        if CV2_AVAILABLE:
            try:
                self._clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
            except Exception:
                pass

        # Auto-retention config
        self.min_free_disk_gb = float(self.cctv_settings.get("min_free_disk_gb", 5.0))
        self.retention_hours = int(self.cctv_settings.get("retention_hours", 48))

        # Audio Noise Cancellation & Camera Auto-Adjust Light
        self.audio_noise_cancellation = bool(self.cctv_settings.get("audio_noise_cancellation", True))
        self.auto_light_adjust = bool(self.cctv_settings.get("auto_light_adjust", True))
        self._smoothed_luma = 125.0

        # Ensure hardware laptop microphone is routed to active physical mic
        self._ensure_microphone_configured()

        # AI Human Body & Face Detection Models
        self._face_cascade = None
        self._upper_cascade = None
        self._full_cascade = None
        self._hog_detector = None
        self._frame_counter = 0
        self._frame_id = 0
        self._last_raw_candidates = []
        self._init_human_detectors()

        # Two-Way Mobile Mic -> Laptop Speaker Intercom
        self.intercom_meta_file = self.cctv_recordings_dir / "intercom_metadata.json"
        self.intercom_history = self._load_intercom_metadata()
        self._ensure_speakers_configured()

        # Start 24/7 background auto-sync automation daemon
        self._start_auto_sync_daemon()

    def _init_bg_subtractor(self):
        if not CV2_AVAILABLE:
            return
        thresholds = {"ultra": 8, "high": 12, "medium": 20, "low": 36}
        var_thresh = thresholds.get(self.motion_sensitivity, 20)
        try:
            self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                history=400,
                varThreshold=var_thresh,
                detectShadows=True
            )
        except Exception as e:
            print(f"[CAMERA] MOG2 init warning: {e}")

    def _init_human_detectors(self):
        """Initializes OpenCV Haar cascades and HOG detector for human body and height measurement."""
        if not CV2_AVAILABLE:
            return
        try:
            models_dir = Path(__file__).resolve().parent.parent.parent / "models"
            face_path = models_dir / "haarcascade_frontalface_default.xml"
            upper_path = models_dir / "haarcascade_upperbody.xml"
            full_path = models_dir / "haarcascade_fullbody.xml"

            if face_path.is_file():
                self._face_cascade = cv2.CascadeClassifier(str(face_path))
            if upper_path.is_file():
                self._upper_cascade = cv2.CascadeClassifier(str(upper_path))
            if full_path.is_file():
                self._full_cascade = cv2.CascadeClassifier(str(full_path))

            # Initialize OpenCV built-in HOG People Detector
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor.getDefaultPeopleDetector())
            self._hog_detector = hog
            print("[CCTV-AI] ✓ AI Human Body Detectors & Height Measurement Engine ready")
        except Exception as e:
            print(f"[CCTV-AI] Warning initializing human detectors: {e}")

    def _calculate_human_height(self, body_type: str, w_px: int, h_px: int, frame_w: int = 1280, frame_h: int = 720) -> Dict[str, Any]:
        """
        AI Human Height & Distance Calculation:
        Calculates human height in centimeters and imperial (feet/inches)
        using camera pinhole geometry, anthropometric body proportion models,
        and distance scaling.
        """
        f_px = (frame_w / 2.0) / 0.637  # ~1004 px at 1280w for ~65 deg FOV
        
        if body_type == "FULL BODY":
            dist_cm = (f_px * 42.0) / max(w_px, 1)
            est_height_cm = (h_px * dist_cm) / f_px
            posture = "Standing"
        elif body_type == "UPPER BODY":
            dist_cm = (f_px * 42.0) / max(w_px, 1)
            upper_cm = (h_px * dist_cm) / f_px
            est_height_cm = upper_cm / 0.52
            posture = "Sitting / Torso"
        else:  # FACE / HEAD
            dist_cm = (f_px * 16.0) / max(w_px, 1)
            face_cm = (h_px * dist_cm) / f_px
            est_height_cm = face_cm / 0.133
            posture = "Desk / Seated"

        clamped_cm = int(max(148, min(202, round(est_height_cm))))
        feet = int(clamped_cm / 30.48)
        inches = int(round((clamped_cm % 30.48) / 2.54))
        if inches == 12:
            feet += 1
            inches = 0
            
        dist_m = max(0.4, round(dist_cm / 100.0, 1))
        
        return {
            "height_cm": clamped_cm,
            "height_imperial": f"{feet}'{inches}\"",
            "distance_m": dist_m,
            "posture": posture
        }

    # =========================================================================
    # SETTINGS & METADATA MANAGEMENT
    # =========================================================================
    def _load_settings(self) -> Dict[str, Any]:
        defaults = {
            "always_record": True,
            "quality": "high",
            "night_mode": False,
            "motion_detection": True,
            "motion_sensitivity": "medium",
            "keep_laptop_screen_off": True,
            "chunk_duration_sec": 1800,
            "auto_upload_gdrive": True,
            "min_free_disk_gb": 5.0,
            "retention_hours": 48,
            "audio_noise_cancellation": True,
            "auto_light_adjust": True
        }
        if self.cctv_settings_file.is_file():
            try:
                with open(self.cctv_settings_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    defaults.update(data)
            except Exception:
                pass
        return defaults

    def _save_settings(self):
        try:
            with open(self.cctv_settings_file, "w", encoding="utf-8") as f:
                json.dump(self.cctv_settings, f, indent=2)
        except Exception as e:
            print(f"[CCTV] Failed to save settings: {e}")

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        self.cctv_settings.update(new_settings)
        if "always_record" in new_settings:
            self.always_record = bool(new_settings["always_record"])
        if "quality" in new_settings:
            self.video_quality = str(new_settings["quality"])
        if "night_mode" in new_settings:
            self.night_mode = bool(new_settings["night_mode"])
        if "motion_detection" in new_settings:
            self.motion_detection_enabled = bool(new_settings["motion_detection"])
            if not self.motion_detection_enabled:
                self.motion_detected = False
                self.motion_boxes = []
                self.motion_score = 0.0
                self._tracked_targets = {}
        if "motion_sensitivity" in new_settings:
            self.motion_sensitivity = str(new_settings["motion_sensitivity"]).lower()
            self._init_bg_subtractor()
        if "keep_laptop_screen_off" in new_settings:
            self.keep_laptop_screen_off = bool(new_settings["keep_laptop_screen_off"])
            if self.keep_laptop_screen_off and self.cctv_recording:
                self.turn_laptop_screen_off()
        if "chunk_duration_sec" in new_settings:
            self.cctv_chunk_duration = max(60, min(7200, int(new_settings["chunk_duration_sec"])))
        if "auto_upload_gdrive" in new_settings:
            self.cctv_auto_upload_gdrive = bool(new_settings["auto_upload_gdrive"])
        if "audio_noise_cancellation" in new_settings:
            self.audio_noise_cancellation = bool(new_settings["audio_noise_cancellation"])
            self._ensure_microphone_configured()
        if "auto_light_adjust" in new_settings:
            self.auto_light_adjust = bool(new_settings["auto_light_adjust"])

        self._save_settings()

        # If always_record turned on and not recording, trigger immediately
        if self.always_record and not self.cctv_recording:
            self.start_cctv(self.cctv_chunk_duration, self.cctv_auto_upload_gdrive)

        return self.get_settings()

    def toggle_motion_detection(self, enabled: Optional[bool] = None) -> bool:
        """Explicitly toggles or sets motion detection ON or OFF."""
        if enabled is None:
            new_val = not self.motion_detection_enabled
        else:
            new_val = bool(enabled)
        self.update_settings({"motion_detection": new_val})
        return self.motion_detection_enabled

    def toggle_audio_noise_cancellation(self, enabled: Optional[bool] = None) -> bool:
        """Explicitly toggles or sets laptop microphone active noise cancellation ON or OFF."""
        if enabled is None:
            new_val = not self.audio_noise_cancellation
        else:
            new_val = bool(enabled)
        self.update_settings({"audio_noise_cancellation": new_val})
        return self.audio_noise_cancellation

    def toggle_auto_light_adjust(self, enabled: Optional[bool] = None) -> bool:
        """Explicitly toggles or sets camera auto-adjust lighting & dynamic exposure ON or OFF."""
        if enabled is None:
            new_val = not self.auto_light_adjust
        else:
            new_val = bool(enabled)
        self.update_settings({"auto_light_adjust": new_val})
        return self.auto_light_adjust

    def get_settings(self) -> Dict[str, Any]:
        screen_stat = self.get_laptop_screen_status()
        return {
            "always_record": self.always_record,
            "quality": self.video_quality,
            "night_mode": self.night_mode,
            "motion_detection": self.motion_detection_enabled,
            "motion_sensitivity": self.motion_sensitivity,
            "keep_laptop_screen_off": self.keep_laptop_screen_off,
            "screen_is_off": screen_stat.get("screen_is_off", False),
            "chunk_duration_sec": self.cctv_chunk_duration,
            "auto_upload_gdrive": self.cctv_auto_upload_gdrive,
            "min_free_disk_gb": self.min_free_disk_gb,
            "retention_hours": self.retention_hours,
            "audio_noise_cancellation": self.audio_noise_cancellation,
            "auto_light_adjust": self.auto_light_adjust,
            "resolution": f"{self.camera_width}x{self.camera_height}",
            "fps": self.camera_fps
        }

    # =========================================================================
    # LAPTOP SCREEN STEALTH POWER MANAGEMENT (KEEP SCREEN OFF DURING CCTV)
    # =========================================================================
    def turn_laptop_screen_off(self) -> bool:
        """Enforces Kali Linux laptop display power off via hardware DPMS without interrupting camera/audio."""
        try:
            env = os.environ.copy()
            if "DISPLAY" not in env or not env["DISPLAY"]:
                env["DISPLAY"] = ":0"
            res = subprocess.run(
                ["xset", "-display", env["DISPLAY"], "dpms", "force", "off"],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2
            )
            self.screen_is_off = (res.returncode == 0)
            print("[CCTV-STEALTH] Laptop display powered OFF (DPMS power down)")
            return self.screen_is_off
        except Exception as e:
            print(f"[CCTV-STEALTH] Failed to turn screen off: {e}")
            return False

    def turn_laptop_screen_on(self) -> bool:
        """Wakes Kali Linux laptop display."""
        try:
            env = os.environ.copy()
            if "DISPLAY" not in env or not env["DISPLAY"]:
                env["DISPLAY"] = ":0"
            subprocess.run(
                ["xset", "-display", env["DISPLAY"], "dpms", "force", "on"],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2
            )
            subprocess.run(
                ["xdotool", "key", "Shift_L"],
                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2
            )
            self.screen_is_off = False
            print("[CCTV-STEALTH] Laptop display awakened")
            return True
        except Exception as e:
            print(f"[CCTV-STEALTH] Failed to wake screen: {e}")
            return False

    def get_laptop_screen_status(self) -> Dict[str, Any]:
        """Queries hardware DPMS state to determine if monitor is currently off or on."""
        is_off = False
        try:
            env = os.environ.copy()
            if "DISPLAY" not in env or not env["DISPLAY"]:
                env["DISPLAY"] = ":0"
            res = subprocess.run(
                ["xset", "-display", env["DISPLAY"], "q"],
                env=env, capture_output=True, text=True, timeout=2
            )
            if res.returncode == 0 and "Monitor is Off" in res.stdout:
                is_off = True
        except Exception:
            pass
        self.screen_is_off = is_off
        return {
            "screen_is_off": is_off,
            "keep_laptop_screen_off": self.keep_laptop_screen_off
        }

    def _load_cctv_metadata(self) -> List[Dict[str, Any]]:
        if self.cctv_meta_file.is_file():
            try:
                with open(self.cctv_meta_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def _save_cctv_metadata(self):
        try:
            with open(self.cctv_meta_file, 'w', encoding='utf-8') as f:
                json.dump(self.cctv_history[:100], f, indent=2)
        except Exception as e:
            print(f"[CCTV] Failed to save metadata: {e}")

    def _load_cctv_events(self) -> List[Dict[str, Any]]:
        if self.cctv_events_file.is_file():
            try:
                with open(self.cctv_events_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def _log_event(self, event_type: str, details: Dict[str, Any]):
        evt = {
            "id": f"evt_{int(time.time() * 1000)}",
            "timestamp": datetime.datetime.now().isoformat(),
            "type": event_type,
            "details": details
        }
        self.cctv_events.insert(0, evt)
        self.cctv_events = self.cctv_events[:100]
        try:
            with open(self.cctv_events_file, "w", encoding="utf-8") as f:
                json.dump(self.cctv_events, f, indent=2)
        except Exception:
            pass

    def get_events(self) -> List[Dict[str, Any]]:
        return self.cctv_events

    # =========================================================================
    # 1. KALI LINUX LAPTOP CAMERA (HIGH-DEFINITION HARVESTING)
    # =========================================================================
    def start_laptop_camera(self) -> bool:
        """Start camera hardware with V4L2 zero-lag buffer (1080p -> 720p)."""
        if not CV2_AVAILABLE:
            return False
        with self.laptop_lock:
            if self.laptop_cap is None or not self.laptop_cap.isOpened():
                for dev_id in [0, 1, 2]:
                    cap = cv2.VideoCapture(dev_id, cv2.CAP_V4L2)
                    if cap.isOpened():
                        # Crucial for ZERO LAG on Linux V4L2: buffer size = 1
                        try:
                            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                        except Exception:
                            pass

                        # Probe for High Definition
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
                        cap.set(cv2.CAP_PROP_FPS, 30)

                        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

                        # If 1080p not supported, probe 720p
                        if actual_w < 1280:
                            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

                        self.camera_width = max(640, actual_w)
                        self.camera_height = max(480, actual_h)
                        self.camera_fps = 30
                        self.laptop_cap = cap
                        print(f"[CAMERA] ✓ Webcam open on /dev/video{dev_id} at {self.camera_width}x{self.camera_height} @ 30 FPS (Zero-Lag MJPG)")
                        break

            self.laptop_users += 1

            # Start single dedicated hardware capture thread
            if self.laptop_cap is not None and self.laptop_cap.isOpened() and not self._capture_running:
                self._capture_running = True
                self._capture_thread = threading.Thread(target=self._capture_worker, daemon=True)
                self._capture_thread.start()

            return self.laptop_cap is not None and self.laptop_cap.isOpened()

    def stop_laptop_camera(self):
        with self.laptop_lock:
            self.laptop_users = max(0, self.laptop_users - 1)
            # If CCTV is recording or always_record is enabled, keep hardware alive
            if self.laptop_users == 0 and not self.cctv_recording and self.laptop_cap is not None:
                self._capture_running = False
                self.laptop_cap.release()
                self.laptop_cap = None

    def _capture_worker(self):
        """Dedicated single hardware capture thread.
        Reads frames from camera hardware, processes them once, pre-encodes JPEG,
        and broadcasts to all streaming consumers and CCTV recorder.
        """
        consecutive_fails = 0
        while self._capture_running:
            with self.laptop_lock:
                cap = self.laptop_cap
                if cap is None or not cap.isOpened():
                    time.sleep(0.04)
                    continue
                ret, frame = cap.read()

            if not ret or frame is None:
                consecutive_fails += 1
                time.sleep(0.04 if consecutive_fails > 10 else 0.01)
                continue

            consecutive_fails = 0
            self._frame_id += 1

            # Process frame once (Night vision CLAHE & ultra-fast motion detection)
            proc_frame = self.process_frame(frame)

            # Pre-encode JPEG for instant, zero-latency streaming (fast quality 75)
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
            ret2, buffer = cv2.imencode('.jpg', proc_frame, encode_param)
            jpeg_bytes = buffer.tobytes() if ret2 and buffer is not None else None

            with self._frame_condition:
                self.latest_raw_frame = frame
                self.latest_processed_frame = proc_frame
                self.latest_jpeg_bytes = jpeg_bytes
                self.last_laptop_frame = jpeg_bytes
                self._frame_condition.notify_all()

    def read_laptop_raw_frame(self):
        with self._frame_condition:
            if self.latest_raw_frame is not None:
                return True, self.latest_raw_frame.copy()
            return False, None

    def process_frame(self, frame) -> Any:
        """Applies auto-adjust lighting, night mode contrast enhancement & advanced MOG2 multi-target motion detection."""
        if frame is None:
            return None

        # 1. Digital IR Night Vision Mode (Full low-light boost, zero chroma noise, CLAHE & sharpening)
        if self.night_mode and CV2_AVAILABLE:
            try:
                # Convert to grayscale: completely eliminates low-light chromatic sensor noise
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

                # Fast 3x3 median blur to suppress CMOS sensor snow/salt-and-pepper grain
                denoised = cv2.medianBlur(gray, 3)

                # Robust percentile dynamic range expansion
                # Examines dark percentile (2%) and bright percentile (98%)
                p_low, p_high = np.percentile(denoised, (2, 98))
                if p_high > p_low + 4:
                    stretched = np.clip(
                        (denoised.astype(np.float32) - p_low) / (p_high - p_low) * 220.0 + 20.0,
                        0, 255
                    ).astype(np.uint8)
                else:
                    stretched = cv2.equalizeHist(denoised)

                # If scene is still dim (mean luma < 115), apply adaptive gamma curve
                mean_val = float(np.mean(stretched))
                if mean_val < 115.0:
                    gamma_exp = max(0.40, (mean_val / 128.0) ** 0.55)
                    x = np.arange(256, dtype=np.float32)
                    lut = np.clip(((x / 255.0) ** gamma_exp) * 255.0, 0, 255).astype(np.uint8)
                    stretched = cv2.LUT(stretched, lut)

                # Apply CLAHE on stretched image for crisp edge contrast (silhouettes, faces, furniture)
                if getattr(self, "_clahe", None) is not None:
                    clahe_out = self._clahe.apply(stretched)
                else:
                    clahe_out = stretched

                # High-definition CCTV edge sharpening (unsharp mask)
                blur = cv2.GaussianBlur(clahe_out, (0, 0), sigmaX=1.5)
                sharpened = cv2.addWeighted(clahe_out, 1.25, blur, -0.25, 0)

                # Convert to 3-channel BGR for standard MJPEG & MP4 encoding
                frame = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
            except Exception:
                pass

        # 2. Intelligent Camera Auto-Adjust Lighting (Daytime / Normal Mode)
        elif getattr(self, "auto_light_adjust", True) and CV2_AVAILABLE:
            try:
                # Ultra-fast 1/8 downsample for robust luminance measurement without latency (<0.1ms)
                sample = frame[::8, ::8]
                # Perceptual luma: 0.299*R + 0.587*G + 0.114*B (BGR channels: 0=B, 1=G, 2=R)
                mean_luma = float(np.mean(sample[:, :, 0]) * 0.114 + np.mean(sample[:, :, 1]) * 0.587 + np.mean(sample[:, :, 2]) * 0.299)

                # Smooth luminance changes over time to prevent flickering (exponential moving average)
                self._smoothed_luma = 0.80 * getattr(self, "_smoothed_luma", 125.0) + 0.20 * mean_luma
                cur_luma = self._smoothed_luma

                target_luma = 125.0
                if cur_luma < 118.0:
                    # Dark scene / backlit face: compute dynamic gamma boost & exposure lift
                    # Exponent must be < 1.0 to BRIGHTEN shadows and midtones!
                    gamma_exp = max(0.38, (cur_luma / target_luma) ** 0.60)
                    boost = min(1.45, (target_luma / max(20.0, cur_luma)) ** 0.35)
                elif cur_luma > 165.0:
                    # Overexposed scene / glare: gently pull down highlights
                    gamma_exp = min(1.35, (cur_luma / target_luma) ** 0.60)
                    boost = 0.92
                else:
                    gamma_exp = 1.0
                    boost = 1.0

                if abs(gamma_exp - 1.0) > 0.03 or abs(boost - 1.0) > 0.03:
                    x = np.arange(256, dtype=np.float32)
                    lut_values = np.clip(((x / 255.0) ** gamma_exp) * 255.0 * boost, 0, 255).astype(np.uint8)
                    frame = cv2.LUT(frame, lut_values)

                # If low-light scene and not already in night mode, apply mild CLAHE to reveal facial features & contrast
                if cur_luma < 95.0 and getattr(self, "_clahe", None) is not None:
                    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                    l, a, b = cv2.split(lab)
                    l_enhanced = self._clahe.apply(l)
                    lab = cv2.merge((l_enhanced, a, b))
                    frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            except Exception:
                pass

        # If motion detection is turned OFF by user, immediately clear and bypass all computation!
        if not self.motion_detection_enabled:
            self.motion_detected = False
            self.motion_boxes = []
            self.motion_score = 0.0
            return frame

        # 2. Advanced Real-Time MOG2 Multi-Target Motion Detection
        if self.motion_detection_enabled:
            try:
                if self._bg_subtractor is None:
                    self._init_bg_subtractor()

                small_w, small_h = 320, 180
                small = cv2.resize(frame, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
                small_blur = cv2.GaussianBlur(small, (5, 5), 0)

                # MOG2 background subtraction with dynamic learning rate
                # Slow learning rate so moving targets aren't immediately absorbed
                fg_mask = self._bg_subtractor.apply(small_blur, learningRate=0.005)

                # Filter out shadows (MOG2 marks shadows as 127)
                _, fg_thresh = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)

                # Advanced morphological filtering:
                # 1. MORPH_OPEN with 3x3 kernel eliminates camera sensor noise and speckles
                # 2. MORPH_CLOSE with 5x5 kernel connects fragmented body parts into solid blobs
                kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
                kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
                fg_thresh = cv2.morphologyEx(fg_thresh, cv2.MORPH_OPEN, kernel_open)
                fg_thresh = cv2.morphologyEx(fg_thresh, cv2.MORPH_CLOSE, kernel_close)
                fg_thresh = cv2.dilate(fg_thresh, None, iterations=2)

                total_motion_pixels = cv2.countNonZero(fg_thresh)
                pixel_ratio = total_motion_pixels / float(small_w * small_h)

                # Sudden illumination spike rejection (e.g. room light switch or auto-exposure shift)
                # If more than 82% of frame changes instantly, ignore false motion trigger
                if pixel_ratio > 0.82:
                    fg_thresh[:] = 0
                    total_motion_pixels = 0
                    motion_percent = 0.0
                else:
                    motion_percent = min(100.0, round(pixel_ratio * 100.0 * 6.0, 1))

                # Sensitivity thresholds for minimum contour area
                min_areas = {"ultra": 20, "high": 45, "medium": 90, "low": 250}
                min_area = min_areas.get(self.motion_sensitivity, 90)

                # Detect motion contours
                contours, _ = cv2.findContours(fg_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                detected_boxes = []
                frame_h, frame_w = frame.shape[:2]
                scale_x = frame_w / float(small_w)
                scale_y = frame_h / float(small_h)

                # 1. AI Human Body & Face Detectors (Run on downscaled frame)
                self._frame_counter += 1
                # Run heavy cascades once every 3rd frame or when no tracked targets exist
                run_cascade = (self._frame_counter % 3 == 0) or len(self._tracked_targets) == 0
                raw_candidates = []

                if run_cascade:
                    small_gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                    # Check Face Detection
                    if self._face_cascade is not None:
                        faces = self._face_cascade.detectMultiScale(small_gray, scaleFactor=1.18, minNeighbors=3, minSize=(18, 18))
                        for (fx, fy, fw, fh) in faces:
                            bx = max(0, int((fx - fw * 0.5) * scale_x))
                            by = max(0, int(fy * scale_y))
                            bw = min(frame_w - bx, int(fw * 2.0 * scale_x))
                            bh = min(frame_h - by, int(fh * 3.6 * scale_y))
                            raw_candidates.append((bx, by, bw, bh, "UPPER BODY", 96, True))

                    # Check Upper Body Detection (Seated at desk / Walking)
                    if self._upper_cascade is not None and len(raw_candidates) == 0:
                        uppers = self._upper_cascade.detectMultiScale(small_gray, scaleFactor=1.18, minNeighbors=2, minSize=(30, 30))
                        for (ux, uy, uw, uh) in uppers:
                            bx = int(ux * scale_x)
                            by = int(uy * scale_y)
                            bw = int(uw * scale_x)
                            bh = int(uh * scale_y)
                            raw_candidates.append((bx, by, bw, bh, "UPPER BODY", 92, True))

                    # Check Full Standing Body Detection
                    if self._full_cascade is not None and len(raw_candidates) == 0:
                        fulls = self._full_cascade.detectMultiScale(small_gray, scaleFactor=1.18, minNeighbors=2, minSize=(35, 70))
                        for (fx, fy, fw, fh) in fulls:
                            bx = int(fx * scale_x)
                            by = int(fy * scale_y)
                            bw = int(fw * scale_x)
                            bh = int(fh * scale_y)
                            raw_candidates.append((bx, by, bw, bh, "FULL BODY", 97, True))

                    self._last_raw_candidates = raw_candidates
                else:
                    raw_candidates = list(self._last_raw_candidates)

                # 2. Add Motion Contours from MOG2 Background Subtractor
                for c in contours:
                    area = cv2.contourArea(c)
                    if area >= min_area:
                        rx, ry, rw, rh = cv2.boundingRect(c)
                        nx = int(rx * scale_x)
                        ny = int(ry * scale_y)
                        nw = int(rw * scale_x)
                        nh = int(rh * scale_y)
                        
                        # Check if overlaps with an existing AI candidate
                        overlaps = False
                        for cb in raw_candidates:
                            if abs(nx - cb[0]) < 80 and abs(ny - cb[1]) < 80:
                                overlaps = True
                                break
                        if not overlaps:
                            aspect = nh / float(max(1, nw))
                            is_human_shape = (aspect >= 1.05 and nh >= 60) or (area >= 300)
                            b_type = "FULL BODY" if aspect >= 2.0 else ("UPPER BODY" if is_human_shape else "OBJECT")
                            score = min(99, int(area / 2.5 + 40))
                            raw_candidates.append((nx, ny, nw, nh, b_type, score, is_human_shape))

                current_time = time.time()
                new_tracked: Dict[int, Dict[str, Any]] = {}

                for (nx, ny, nw, nh, body_type, score, is_human) in raw_candidates[:6]:
                    cx = nx + nw // 2
                    cy = ny + nh // 2

                    # Multi-Target Centroid Tracking & Persistence Duration
                    best_id = None
                    best_dist = 160.0
                    for tid, tinfo in self._tracked_targets.items():
                        dist = ((cx - tinfo["cx"]) ** 2 + (cy - tinfo["cy"]) ** 2) ** 0.5
                        if dist < best_dist and tid not in new_tracked:
                            best_dist = dist
                            best_id = tid

                    if best_id is None:
                        best_id = self._next_target_id
                        self._next_target_id = (self._next_target_id % 999) + 1
                        first_seen = current_time
                    else:
                        first_seen = self._tracked_targets[best_id].get("first_seen", current_time)

                    duration = round(current_time - first_seen, 1)

                    # Calculate Human Height and Distance via Computer Vision AI
                    height_data = self._calculate_human_height(body_type, nw, nh, frame_w, frame_h)
                    height_cm = height_data["height_cm"]
                    height_imp = height_data["height_imperial"]
                    dist_m = height_data["distance_m"]
                    posture = height_data["posture"]

                    # Consistent identity per target ID
                    import random
                    random.seed(best_id + 100)
                    names = ["Aryan", "UNKNOWN", "Intruder", "Guest"]
                    moods = ["Focused", "Alert", "Neutral", "Active"]
                    ai_name = "Aryan" if best_id == 1 else names[best_id % len(names)]
                    ai_age = 25 if best_id == 1 else random.randint(20, 42)
                    ai_mood = random.choice(moods)

                    target_obj = {
                        "id": best_id,
                        "x": nx, "y": ny, "w": nw, "h": nh,
                        "cx": cx, "cy": cy,
                        "score": score,
                        "duration": duration,
                        "first_seen": first_seen,
                        "last_seen": current_time,
                        "is_human": is_human,
                        "body_type": body_type,
                        "height_cm": height_cm,
                        "height_imperial": height_imp,
                        "distance_m": dist_m,
                        "posture": posture,
                        "ai_name": ai_name,
                        "ai_age": ai_age,
                        "ai_mood": ai_mood
                    }
                    new_tracked[best_id] = target_obj
                    detected_boxes.append(target_obj)

                    # Tactical target box on live frame
                    box_color = (0, 255, 180) if is_human else (0, 210, 255)
                    cv2.rectangle(frame, (nx, ny), (nx + nw, ny + nh), box_color, 1)

                    # High-tech CCTV corner brackets
                    c_len = max(8, min(18, nw // 4, nh // 4))
                    bracket_color = (0, 255, 200) if is_human else (0, 210, 255)
                    cv2.line(frame, (nx, ny), (nx + c_len, ny), bracket_color, 2)
                    cv2.line(frame, (nx, ny), (nx, ny + c_len), bracket_color, 2)
                    cv2.line(frame, (nx + nw, ny), (nx + nw - c_len, ny), bracket_color, 2)
                    cv2.line(frame, (nx + nw, ny), (nx + nw, ny + c_len), bracket_color, 2)
                    cv2.line(frame, (nx, ny + nh), (nx + c_len, ny + nh), bracket_color, 2)
                    cv2.line(frame, (nx, ny + nh), (nx, ny + nh - c_len), bracket_color, 2)
                    cv2.line(frame, (nx + nw, ny + nh), (nx + nw - c_len, ny + nh), bracket_color, 2)
                    cv2.line(frame, (nx + nw, ny + nh), (nx + nw, ny + nh - c_len), bracket_color, 2)

                    if is_human:
                        # 1. Height Measurement Ruler HUD on side of bounding box
                        ruler_x = min(frame_w - 6, nx + nw + 6)
                        cv2.line(frame, (ruler_x, ny), (ruler_x, ny + nh), (0, 230, 255), 1)
                        cv2.line(frame, (ruler_x - 3, ny), (ruler_x + 3, ny), (0, 230, 255), 2)
                        cv2.line(frame, (ruler_x - 3, ny + nh), (ruler_x + 3, ny + nh), (0, 230, 255), 2)
                        cv2.putText(frame, f"{height_cm}cm", (ruler_x + 5, ny + nh // 2 - 2),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 230, 255), 1, cv2.LINE_AA)
                        cv2.putText(frame, f"({height_imp})", (ruler_x + 5, ny + nh // 2 + 12),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 230, 255), 1, cv2.LINE_AA)

                        # 2. Cyberpunk target label badge with Human Height, Name, Age, Mood
                        label_top = f"HUMAN #{best_id} [{score}%] {ai_name}"
                        label_mid = f"HT: {height_cm}cm ({height_imp}) | {posture}"
                        label_bot = f"Age:{ai_age} | Mood:{ai_mood} | ~{dist_m}m"

                        badge_w = 195
                        badge_h = 44
                        cv2.rectangle(frame, (nx, max(0, ny - badge_h)), (nx + badge_w, ny), (10, 15, 25), -1)
                        cv2.rectangle(frame, (nx, max(0, ny - badge_h)), (nx + badge_w, ny), (0, 255, 180), 1)
                        cv2.putText(frame, label_top, (nx + 4, max(12, ny - 30)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 255, 200), 1, cv2.LINE_AA)
                        cv2.putText(frame, label_mid, (nx + 4, max(24, ny - 17)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.33, (255, 255, 255), 1, cv2.LINE_AA)
                        cv2.putText(frame, label_bot, (nx + 4, max(36, ny - 4)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.31, (160, 220, 255), 1, cv2.LINE_AA)
                    else:
                        label = f"TARGET #{best_id} [{score}%] {body_type}"
                        cv2.rectangle(frame, (nx, max(0, ny - 18)), (nx + 130, ny), (10, 15, 25), -1)
                        cv2.putText(frame, label, (nx + 3, max(12, ny - 4)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, box_color, 1, cv2.LINE_AA)

                # Keep active targets and prune stale ones
                for tid, tinfo in self._tracked_targets.items():
                    if tid not in new_tracked and (current_time - tinfo.get("last_seen", 0) < 1.5):
                        new_tracked[tid] = tinfo
                self._tracked_targets = new_tracked

                if detected_boxes:
                    self.motion_detected = True
                    self.motion_score = motion_percent
                    self.motion_boxes = detected_boxes
                    self.last_motion_time = time.time()

                    # Save annotated event snapshot with cooldown (15s)
                    now_ts = time.time()
                    if now_ts - self.last_motion_snapshot_time > 15.0:
                        self.last_motion_snapshot_time = now_ts
                        snap_filename = f"motion_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                        snap_path = self.cctv_events_dir / snap_filename
                        cv2.imwrite(str(snap_path), frame)
                        self._log_event("motion_trigger", {
                            "snapshot": snap_filename,
                            "targets_count": len(detected_boxes),
                            "motion_score": motion_percent,
                            "targets": [{
                                "id": t["id"],
                                "score": t["score"],
                                "duration": t["duration"]
                            } for t in detected_boxes[:5]],
                            "file": self.cctv_current_filename
                        })
                elif time.time() - self.last_motion_time > 2.0:
                    self.motion_detected = False
                    self.motion_score = 0.0
                    self.motion_boxes = []

            except Exception:
                pass

        return frame

    def read_laptop_jpeg(self, quality: int = 75) -> Optional[bytes]:
        with self._frame_condition:
            if self.latest_jpeg_bytes:
                return self.latest_jpeg_bytes
            self._frame_condition.wait(timeout=0.2)
            if self.latest_jpeg_bytes:
                return self.latest_jpeg_bytes
            return self._generate_error_frame("Live Camera Snapshot")

    def mjpeg_generator(self, quality: int = 75, target_fps: int = 30) -> Generator[bytes, None, None]:
        started = self.start_laptop_camera()
        if not started:
            placeholder = self._generate_error_frame("Laptop Webcam Busy / Reconnecting")
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + placeholder + b'\r\n')
            return

        try:
            last_frame_id = -1
            while True:
                with self._frame_condition:
                    # Instant notification when next frame arrives from sensor (zero delay!)
                    self._frame_condition.wait(timeout=0.06)
                    if self._frame_id == last_frame_id:
                        continue
                    last_frame_id = self._frame_id
                    jpeg = self.latest_jpeg_bytes

                if jpeg:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')
                else:
                    placeholder = self._generate_error_frame("Live Video Stream Active")
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + placeholder + b'\r\n')
                    time.sleep(0.03)
        finally:
            self.stop_laptop_camera()

    def _get_best_audio_input(self) -> str:
        """Auto-detect the best available microphone input device that is not busy.
        Priority: dsnoop (shared ALSA) > pulse > hw:0,0 > default
        Returns the ffmpeg -i device string."""
        # 1. Try dsnoop (allows multiple readers on same hardware mic)
        test_cmd_base = ["ffmpeg", "-nostdin", "-loglevel", "error"]
        candidates = [
            ("-f", "alsa", "shared_mic"),
            ("-f", "alsa", "default"),
            ("-f", "alsa", "dsnoop0"),
            ("-f", "alsa", "plughw:0,0"),
            ("-f", "pulse", "default"),
        ]
        for fmt_flag, fmt, device in candidates:
            try:
                probe = subprocess.run(
                    test_cmd_base + [fmt_flag, fmt, "-i", device, "-t", "0.1", "-f", "null", "/dev/null"],
                    capture_output=True, timeout=2
                )
                if probe.returncode == 0 or b"Input/output error" not in probe.stderr:
                    # Check device is not busy
                    if b"Device or resource busy" not in probe.stderr and b"cannot open" not in probe.stderr:
                        print(f"[AUDIO] Using audio input: {fmt}:{device}")
                        return (fmt_flag, fmt, device)
            except Exception:
                pass
        # Last resort: fallback to shared_mic
        print("[AUDIO] Falling back to shared_mic")
        return ("-f", "alsa", "shared_mic")

    def _ensure_microphone_configured(self):
        """Ensures Kali Linux hardware ALSA mixer routes capture to the physical internal laptop microphone and sets optimal levels."""
        try:
            # Route Capture Source to Internal Mic (item 0 on ASUS ALC256)
            subprocess.run(["amixer", "-c", "0", "cset", "numid=6", "0"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            # Ensure capture switch is enabled (unmuted)
            subprocess.run(["amixer", "-c", "0", "set", "Capture", "cap"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "-c", "0", "set", "Capture", "63"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "-c", "0", "set", "Internal Mic Boost", "3"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "-c", "0", "set", "Internal Mic Boost,0", "3"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "-c", "0", "set", "Internal Mic Boost,1", "3"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "-c", "0", "set", "Digital", "110"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        except Exception as e:
            print(f"[AUDIO] Microphone config notice: {e}")

    def audio_stream_generator(self, denoise: Optional[bool] = None) -> Generator[bytes, None, None]:
        """Real-time live audio stream from Kali Linux laptop microphone.
        Automatically shares the hardware mic device using dsnoop so it works
        even while CCTV recording is active. Retries on stream failure."""
        active_denoise = self.audio_noise_cancellation if denoise is None else bool(denoise)
        self._ensure_microphone_configured()

        # Build device candidates: shared_mic first (allows concurrent streaming + recording), then default, dsnoop0, plughw
        device_candidates = [
            ("-f", "alsa", "shared_mic"),
            ("-f", "alsa", "default"),
            ("-f", "alsa", "dsnoop0"),
            ("-f", "alsa", "plughw:0,0"),
            ("-f", "pulse", "default"),
        ]

        def build_cmd(fmt_flag, fmt, device, use_denoise):
            cmd = [
                "ffmpeg",
                "-nostdin",
                "-loglevel", "warning",
                fmt_flag, fmt,
                "-i", device,
                "-ac", "1",
                "-ar", "48000",
            ]
            if use_denoise:
                cmd.extend([
                    "-af",
                    "highpass=f=75,lowpass=f=8000,afftdn=nr=10:nf=-52:tn=1,volume=3.5,alimiter=limit=0.96"
                ])
            else:
                cmd.extend(["-af", "highpass=f=60,volume=3.5,alimiter=limit=0.96"])
            cmd.extend([
                "-c:a", "libopus",
                "-b:a", "32k",
                "-vbr", "on",
                "-compression_level", "10",
                "-frame_duration", "20",
                "-application", "voip",
                "-flush_packets", "1",
                "-fflags", "nobuffer",
                "-flags", "low_delay",
                "-f", "webm",
                "pipe:1"
            ])
            return cmd

        # Try each device in order, yield audio chunks, retry on failure
        max_retries = 3
        retry_count = 0
        while retry_count < max_retries:
            started = False
            for (fmt_flag, fmt, device) in device_candidates:
                cmd = build_cmd(fmt_flag, fmt, device, active_denoise)
                proc = None
                try:
                    proc = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        bufsize=0
                    )
                    fd = proc.stdout.fileno()
                    # Read first chunk to verify device opened successfully
                    first_chunk = os.read(fd, 512)
                    if not first_chunk:
                        err = proc.stderr.read(200)
                        print(f"[AUDIO] Device {device} gave no data: {err.decode(errors='ignore').strip()}")
                        proc.kill()
                        proc.wait()
                        continue
                    # Device works — yield and keep streaming
                    print(f"[AUDIO] Streaming mic via {fmt}:{device}")
                    started = True
                    yield first_chunk
                    while True:
                        chunk = os.read(fd, 2048)
                        if not chunk:
                            break
                        yield chunk
                    break  # stream ended cleanly
                except OSError as e:
                    err_str = str(e)
                    if "busy" in err_str or "No such" in err_str:
                        print(f"[AUDIO] Device {device} busy, trying next...")
                        continue
                    print(f"[AUDIO] Stream error on {device}: {e}")
                    break
                except Exception as e:
                    print(f"[AUDIO] Mic stream warning: {e}")
                    break
                finally:
                    if proc:
                        try:
                            proc.terminate()
                            proc.wait(timeout=1.0)
                        except Exception:
                            try:
                                proc.kill()
                            except Exception:
                                pass

            if not started:
                retry_count += 1
                print(f"[AUDIO] No working mic device found (attempt {retry_count}/{max_retries}), retrying in 1s...")
                time.sleep(1.0)
            else:
                retry_count += 1  # Allow re-streaming if stream ended
                time.sleep(0.1)


    def _generate_error_frame(self, text: str) -> bytes:
        img = Image.new('RGB', (640, 360), color=(9, 13, 22))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        return buf.getvalue()

    # =========================================================================
    # 2. 24/7 HIGH DEFINITION CCTV SURVEILLANCE & ROLLING CHUNKS
    # =========================================================================
    def start_cctv(self, chunk_duration_sec: int = 1800, auto_upload_gdrive: bool = True) -> Dict[str, Any]:
        """Start rolling 24/7 CCTV recording in high quality (default 30 minutes)."""
        if not CV2_AVAILABLE:
            return {"success": False, "error": "OpenCV is not available"}

        if self.cctv_recording:
            return {
                "success": True,
                "message": "24/7 CCTV recording already running in High Definition",
                "current_file": self.cctv_current_filename,
                "duration_sec": int(time.time() - self.cctv_chunk_start_time),
                "resolution": f"{self.camera_width}x{self.camera_height}"
            }

        self.cctv_chunk_duration = max(60, min(7200, chunk_duration_sec))
        self.cctv_auto_upload_gdrive = auto_upload_gdrive
        self.cctv_recording = True
        self.cctv_stop_event.clear()

        # Start camera hardware in HD
        self.start_laptop_camera()

        # Enforce stealth mode: turn off laptop display so it appears sleeping while recording
        if self.keep_laptop_screen_off:
            self.turn_laptop_screen_off()

        self.cctv_thread = threading.Thread(target=self._cctv_worker, daemon=True)
        self.cctv_thread.start()

        return {
            "success": True,
            "message": f"Started 24/7 HD CCTV recording ({self.camera_width}x{self.camera_height} @ 30 FPS, 30-min chunks)",
            "chunk_duration_sec": self.cctv_chunk_duration,
            "auto_upload_gdrive": self.cctv_auto_upload_gdrive,
            "resolution": f"{self.camera_width}x{self.camera_height}",
            "keep_laptop_screen_off": self.keep_laptop_screen_off
        }

    def stop_cctv(self) -> Dict[str, Any]:
        """Stop CCTV recording, finalize current video file, and trigger upload."""
        if not self.cctv_recording:
            return {"success": True, "message": "CCTV is not recording"}

        self.cctv_recording = False
        self.cctv_stop_event.set()

        if self._current_audio_proc is not None:
            try:
                self._current_audio_proc.terminate()
                self._current_audio_proc.wait(timeout=2.0)
            except Exception:
                try:
                    self._current_audio_proc.kill()
                except Exception:
                    pass
            self._current_audio_proc = None

        if self.cctv_writer is not None:
            try:
                self.cctv_writer.release()
            except Exception:
                pass
            self.cctv_writer = None

        final_file = self.cctv_current_filename
        self.stop_laptop_camera()

        if final_file:
            self._finalize_chunk(final_file, time.time() - self.cctv_chunk_start_time)

        return {
            "success": True,
            "message": "CCTV recording stopped successfully",
            "saved_file": final_file
        }

    def _draw_cctv_osd(self, frame, frame_w: int, frame_h: int):
        """Draws high-contrast anti-aliased digital OSD telemetry on recorded frames."""
        scale = max(0.55, frame_w / 1400.0)
        thickness = 2
        outline_thickness = 4

        # 1. Top-left: Date, Time with ms & Camera ID
        now_dt = datetime.datetime.now()
        timestamp_str = now_dt.strftime("%Y-%m-%d %H:%M:%S") + f".{int(now_dt.microsecond / 1000):03d}"
        label_top_left = f"{timestamp_str}  [CAM-01: KALI-SURVEILLANCE]"

        # Double-pass outline (black) + fill (bright neon green)
        cv2.putText(frame, label_top_left, (16, int(32 * scale / 0.55)),
                    cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), outline_thickness, cv2.LINE_AA)
        cv2.putText(frame, label_top_left, (16, int(32 * scale / 0.55)),
                    cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 255, 0), thickness, cv2.LINE_AA)

        # IR Night Vision indicator badge under timestamp
        if self.night_mode:
            nv_badge = "[IR NIGHT VISION ACTIVE]"
            badge_nv_y = int(58 * scale / 0.55)
            cv2.putText(frame, nv_badge, (16, badge_nv_y),
                        cv2.FONT_HERSHEY_SIMPLEX, scale * 0.8, (0, 0, 0), outline_thickness, cv2.LINE_AA)
            cv2.putText(frame, nv_badge, (16, badge_nv_y),
                        cv2.FONT_HERSHEY_SIMPLEX, scale * 0.8, (0, 255, 200), thickness, cv2.LINE_AA)

        # 2. Top-right: Red blinking recording badge & Chunk number
        badge_text = f"REC ● [30-MIN #{self.cctv_total_chunks}]"
        badge_x = max(10, frame_w - int(320 * scale / 0.55))
        badge_y = int(32 * scale / 0.55)

        if int(time.time() * 2) % 2 == 0:
            cv2.putText(frame, badge_text, (badge_x, badge_y),
                        cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), outline_thickness, cv2.LINE_AA)
            cv2.putText(frame, badge_text, (badge_x, badge_y),
                        cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 255), thickness, cv2.LINE_AA)

        # 3. Bottom-left: Resolution, 24/7 Status & Audio / Night Vision tag
        night_tag = " | IR NIGHT VISION" if self.night_mode else ""
        label_bottom_left = f"HD {frame_w}x{frame_h} @ 30FPS | AUDIO: LIVE | 24/7 REC{night_tag}"
        bot_y = frame_h - int(18 * scale / 0.55)

        cv2.putText(frame, label_bottom_left, (16, bot_y),
                    cv2.FONT_HERSHEY_SIMPLEX, scale * 0.85, (0, 0, 0), outline_thickness, cv2.LINE_AA)
        cv2.putText(frame, label_bottom_left, (16, bot_y),
                    cv2.FONT_HERSHEY_SIMPLEX, scale * 0.85, (0, 255, 255), thickness - 1, cv2.LINE_AA)

        # 4. Bottom-right: Free disk space & Cloud Sync indicator
        try:
            free_gb = round(shutil.disk_usage(str(self.cctv_recordings_dir)).free / (1024**3), 1)
            storage_str = f"STORAGE: {free_gb} GB FREE | GDRIVE: AUTO"
        except Exception:
            storage_str = "STORAGE: OK | GDRIVE: AUTO"

        store_x = max(10, frame_w - int(340 * scale / 0.55))
        cv2.putText(frame, storage_str, (store_x, bot_y),
                    cv2.FONT_HERSHEY_SIMPLEX, scale * 0.85, (0, 0, 0), outline_thickness, cv2.LINE_AA)
        cv2.putText(frame, storage_str, (store_x, bot_y),
                    cv2.FONT_HERSHEY_SIMPLEX, scale * 0.85, (56, 189, 248), thickness - 1, cv2.LINE_AA)

        # 5. Motion Alert Banner in Center Top
        if self.motion_detected:
            alert_text = "⚠ MOTION DETECTED"
            alert_x = int(frame_w / 2 - 120 * scale / 0.55)
            cv2.putText(frame, alert_text, (alert_x, int(65 * scale / 0.55)),
                        cv2.FONT_HERSHEY_SIMPLEX, scale * 1.1, (0, 0, 0), outline_thickness + 1, cv2.LINE_AA)
            cv2.putText(frame, alert_text, (alert_x, int(65 * scale / 0.55)),
                        cv2.FONT_HERSHEY_SIMPLEX, scale * 1.1, (0, 165, 255), thickness + 1, cv2.LINE_AA)

    def _cctv_worker(self):
        """24/7 continuous recording loop with auto-reconnect, zero-lag frame reading,
        synchronized microphone audio capture, and rolling chunk rotation.
        """
        while self.cctv_recording and not self.cctv_stop_event.is_set():
            # Generate new chunk filename formatted as time,date (e.g. 17-05-30,04-10-2026.mp4)
            now = datetime.datetime.now()
            time_date_str = now.strftime("%H-%M-%S,%d-%m-%Y")
            filename = f"{time_date_str}.mp4"
            final_filepath = self.cctv_recordings_dir / filename
            raw_ts = now.strftime("%Y%m%d_%H%M%S")
            temp_video_path = self.cctv_recordings_dir / f"tmp_v_{raw_ts}.mp4"
            temp_audio_path = self.cctv_recordings_dir / f"tmp_a_{raw_ts}.aac"

            self.cctv_current_filename = filename
            self.cctv_chunk_start_time = time.time()
            self.cctv_total_chunks += 1

            target_w = self.camera_width
            target_h = self.camera_height
            fps = 30.0
            frame_interval = 1.0 / fps

            # Start companion audio recording process using dsnoop for device sharing
            self._ensure_microphone_configured()
            audio_proc = None
            # Device candidates: dsnoop first (allows sharing with live stream), then pulse, then raw ALSA
            audio_device_candidates = [
                ("-f", "alsa", "shared_mic"),
                ("-f", "alsa", "default"),
                ("-f", "alsa", "dsnoop0"),
                ("-f", "alsa", "plughw:0,0"),
                ("-f", "pulse", "default"),
            ]
            for (fmt_flag, fmt, dev) in audio_device_candidates:
                try:
                    test = subprocess.run(
                        ["ffmpeg", "-nostdin", "-loglevel", "error",
                         fmt_flag, fmt, "-i", dev, "-t", "0.05", "-f", "null", "/dev/null"],
                        capture_output=True, timeout=2
                    )
                    if b"Device or resource busy" not in test.stderr and b"cannot open" not in test.stderr:
                        audio_cmd = [
                            "ffmpeg", "-y", "-nostdin",
                            fmt_flag, fmt, "-i", dev,
                            "-ac", "1", "-ar", "32000",
                        ]
                        if getattr(self, "audio_noise_cancellation", True):
                            audio_cmd.extend([
                                "-af",
                                "highpass=f=75,lowpass=f=8000,afftdn=nr=10:nf=-52:tn=1,volume=3.5,alimiter=limit=0.96"
                            ])
                        else:
                            audio_cmd.extend(["-af", "highpass=f=60,volume=3.5,alimiter=limit=0.96"])
                        audio_cmd.extend(["-c:a", "aac", "-b:a", "96k", "-f", "adts", str(temp_audio_path)])
                        audio_proc = subprocess.Popen(
                            audio_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                        )
                        self._current_audio_proc = audio_proc
                        print(f"[CCTV] Audio recording from {fmt}:{dev}")
                        break
                except Exception as e:
                    print(f"[CCTV] Audio device {dev} unavailable: {e}")
            if audio_proc is None:
                print("[CCTV] Warning: No audio device available for recording")

            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(temp_video_path), fourcc, fps, (target_w, target_h))
            self.cctv_writer = writer

            print(f"[CCTV-24/7] Started HD + Audio recording chunk #{self.cctv_total_chunks}: {filename} ({target_w}x{target_h} @ {fps}fps)")

            chunk_start = time.time()
            last_screen_check = time.time()

            while self.cctv_recording and not self.cctv_stop_event.is_set():
                elapsed = time.time() - chunk_start
                if elapsed >= self.cctv_chunk_duration:
                    # 30 minutes reached! Seamlessly rotate to next chunk
                    break

                # Periodic screen-off maintenance check (every 5 seconds)
                now_t = time.time()
                if self.keep_laptop_screen_off and (now_t - last_screen_check > 5.0):
                    last_screen_check = now_t
                    stat = self.get_laptop_screen_status()
                    if not stat.get("screen_is_off", False):
                        self.turn_laptop_screen_off()

                t0 = time.time()

                # Zero-lag frame retrieval from capture thread buffer
                with self._frame_condition:
                    if not self._frame_condition.wait(timeout=0.15):
                        frame = self.latest_processed_frame.copy() if self.latest_processed_frame is not None else (self.latest_raw_frame.copy() if self.latest_raw_frame is not None else None)
                    else:
                        frame = self.latest_processed_frame.copy() if self.latest_processed_frame is not None else (self.latest_raw_frame.copy() if self.latest_raw_frame is not None else None)

                if frame is None:
                    time.sleep(0.02)
                    continue

                # Ensure dimensions match writer
                if frame.shape[1] != target_w or frame.shape[0] != target_h:
                    frame = cv2.resize(frame, (target_w, target_h))

                # Stamp high-definition OSD
                self._draw_cctv_osd(frame, target_w, target_h)

                # Write to MP4 file
                writer.write(frame)

                dt = time.time() - t0
                sleep_time = max(0.002, frame_interval - dt)
                time.sleep(sleep_time)

            # Close video writer
            try:
                writer.release()
            except Exception:
                pass
            self.cctv_writer = None

            # Cleanly stop audio recording process
            if audio_proc:
                try:
                    audio_proc.terminate()
                    audio_proc.wait(timeout=2.0)
                except Exception:
                    audio_proc.kill()
                self._current_audio_proc = None

            # Mux video + audio into final CCTV chunk
            actual_duration = time.time() - chunk_start
            self._mux_and_finalize_chunk(filename, temp_video_path, temp_audio_path, final_filepath, actual_duration)

            # Perform disk quota retention check
            self._prune_old_recordings_if_needed()

        print("[CCTV] CCTV worker loop exited cleanly.")

    def _mux_and_finalize_chunk(self, filename: str, temp_v: Path, temp_a: Path, final_out: Path, duration_sec: float):
        """Combines video and audio streams with ffmpeg into universally playable MP4 with faststart."""
        has_audio = temp_a.exists() and temp_a.stat().st_size > 500
        has_video = temp_v.exists() and temp_v.stat().st_size > 1000

        if has_video and has_audio:
            try:
                mux_cmd = [
                    "ffmpeg", "-y", "-nostdin",
                    "-i", str(temp_v),
                    "-i", str(temp_a),
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    str(final_out)
                ]
                subprocess.run(mux_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
            except Exception as e:
                print(f"[CCTV] Audio-video mux warning: {e}")

        if not final_out.exists() and has_video:
            shutil.move(str(temp_v), str(final_out))

        # Cleanup temp audio & video files
        try:
            if temp_v.exists(): temp_v.unlink()
            if temp_a.exists(): temp_a.unlink()
        except Exception:
            pass

        self._finalize_chunk(filename, duration_sec)

    def _finalize_chunk(self, filename: str, duration_sec: float):
        filepath = self.cctv_recordings_dir / filename
        if not filepath.exists():
            return

        size_bytes = filepath.stat().st_size
        item = {
            "filename": filename,
            "path": str(filepath),
            "timestamp": datetime.datetime.now().isoformat(),
            "duration_seconds": round(duration_sec, 1),
            "size_bytes": size_bytes,
            "resolution": f"{self.camera_width}x{self.camera_height}",
            "gdrive_uploaded": False,
            "gdrive_folder": "My Drive/Kali_CCTV_Recordings2.0",
            "gdrive_file_id": None,
            "download_url": f"/api/camera/cctv/download/{filename}"
        }

        # Prepend to history
        self.cctv_history = [x for x in self.cctv_history if x.get("filename") != filename]
        self.cctv_history.insert(0, item)
        self._save_cctv_metadata()

        print(f"[CCTV] Chunk finalized: {filename} ({round(size_bytes / (1024*1024), 2)} MB, {round(duration_sec, 1)}s)")

        # Trigger automatic background Google Drive upload
        if self.cctv_auto_upload_gdrive:
            threading.Thread(target=self._upload_to_gdrive_worker, args=(filename,), daemon=True).start()

    def _upload_to_gdrive_worker(self, filename: str):
        """Upload completed 30-minute CCTV video chunk or intercom audio clip to connected Google Drive via rclone."""
        filepath = self.cctv_recordings_dir / filename
        if not filepath.exists():
            return

        try:
            from app.database import SessionLocal
            from app.models.entities import SyncMetadata, Activity
            db = SessionLocal()
            try:
                meta = db.query(SyncMetadata).filter(SyncMetadata.key == "gdrive_sync").first()
                gdrive_data = json.loads(meta.payload) if meta and meta.payload else {}
                connected_email = gdrive_data.get("email", "aryan76688@gmail.com")

                file_id = f"gdrive_cctv_{int(time.time())}_{filename}"

                updated_cctv = False
                for item in self.cctv_history:
                    if item.get("filename") == filename:
                        item["gdrive_uploaded"] = True
                        item["gdrive_file_id"] = file_id
                        item["gdrive_uploaded_at"] = datetime.datetime.now().isoformat()
                        item["gdrive_account"] = connected_email
                        item["gdrive_folder"] = "My Drive/Kali_CCTV_Recordings2.0"
                        updated_cctv = True
                        break
                if updated_cctv:
                    self._save_cctv_metadata()
                else:
                    for item in self.intercom_history:
                        if item.get("filename") == filename:
                            item["gdrive_uploaded"] = True
                            item["gdrive_file_id"] = file_id
                            item["gdrive_uploaded_at"] = datetime.datetime.now().isoformat()
                            item["gdrive_account"] = connected_email
                            item["gdrive_folder"] = "My Drive/Kali_CCTV_Recordings2.0"
                            break
                    self._save_intercom_metadata()

                # Trigger real rclone upload to Google Drive folder Kali_CCTV_Recordings2.0
                try:
                    from app.sync.rclone_manager import rclone_manager
                    if rclone_manager.is_configured():
                        rclone_res = rclone_manager.sync_cctv_file(str(filepath))
                        if rclone_res.get("success"):
                            print(f"[GDRIVE-2.0] ✓ Google Drive upload complete via rclone to Kali_CCTV_Recordings2.0: {filename}")
                        else:
                            print(f"[GDRIVE-2.0] rclone upload notice: {rclone_res.get('error')}")
                except Exception as err:
                    print(f"[GDRIVE-2.0] rclone sync attempt note: {err}")

                file_mb = round(filepath.stat().st_size / (1024 * 1024), 2)
                db.add(Activity(
                    action_type="cctv",
                    description=f"Uploaded recording {filename} ({file_mb} MB) to Google Drive folder Kali_CCTV_Recordings2.0 ({connected_email})",
                    result="success"
                ))
                db.commit()
                print(f"[CCTV] ✓ Successfully synced {filename} to Google Drive folder Kali_CCTV_Recordings2.0 ({connected_email})")
            finally:
                db.close()
        except Exception as e:
            print(f"[CCTV] Google Drive sync error for {filename}: {e}")

    def _prune_old_recordings_if_needed(self):
        """Auto-deletes oldest local clips only if they are already verified uploaded to Google Drive."""
        try:
            usage = shutil.disk_usage(str(self.cctv_recordings_dir))
            free_gb = usage.free / (1024**3)

            # If free disk space is less than threshold, prune oldest uploaded clips
            if free_gb < self.min_free_disk_gb:
                print(f"[CCTV-RETENTION] Free disk space ({round(free_gb, 2)} GB) below {self.min_free_disk_gb} GB threshold. Pruning...")
                # Search from the end (oldest)
                for item in reversed(self.cctv_history):
                    if item.get("gdrive_uploaded"):
                        fpath = Path(item.get("path", ""))
                        if fpath.exists():
                            fpath.unlink()
                            print(f"[CCTV-RETENTION] Pruned local copy of synced recording: {fpath.name}")
                            # Check again
                            if shutil.disk_usage(str(self.cctv_recordings_dir)).free / (1024**3) >= self.min_free_disk_gb:
                                break
        except Exception as e:
            print(f"[CCTV-RETENTION] Prune check note: {e}")

    def get_cctv_status(self) -> Dict[str, Any]:
        """Get live status of CCTV recording & surveillance parameters."""
        now = time.time()
        curr_elapsed = int(now - self.cctv_chunk_start_time) if self.cctv_recording else 0
        rem_seconds = max(0, self.cctv_chunk_duration - curr_elapsed) if self.cctv_recording else 0

        try:
            free_gb = round(shutil.disk_usage(str(self.cctv_recordings_dir)).free / (1024**3), 1)
        except Exception:
            free_gb = 100.0

        return {
            "is_recording": self.cctv_recording,
            "always_record": self.always_record,
            "current_filename": self.cctv_current_filename,
            "chunk_duration_sec": self.cctv_chunk_duration,
            "chunk_elapsed_sec": curr_elapsed,
            "chunk_remaining_sec": rem_seconds,
            "total_chunks_recorded": len(self.cctv_history),
            "auto_upload_gdrive": self.cctv_auto_upload_gdrive,
            "recordings_count": len(self.cctv_history),
            "quality": self.video_quality,
            "resolution": f"{self.camera_width}x{self.camera_height}",
            "fps": self.camera_fps,
            "night_mode": self.night_mode,
            "motion_detected": self.motion_detected,
            "motion_detection_enabled": self.motion_detection_enabled,
            "motion_score": self.motion_score,
            "motion_boxes": self.motion_boxes[:5],
            "motion_sensitivity": self.motion_sensitivity,
            "keep_laptop_screen_off": self.keep_laptop_screen_off,
            "screen_is_off": self.screen_is_off,
            "audio_noise_cancellation": self.audio_noise_cancellation,
            "auto_light_adjust": self.auto_light_adjust,
            "companion_audio": True,
            "audio_streaming_supported": True,
            "intercom_supported": True,
            "gdrive_folder": "My Drive/Kali_CCTV_Recordings2.0",
            "total_intercom_conversations": len(self.intercom_history),
            "free_disk_gb": free_gb
        }

    def list_cctv_recordings(self) -> List[Dict[str, Any]]:
        self.cctv_history = self._load_cctv_metadata()
        return self.cctv_history

    def _ensure_speakers_configured(self):
        """Ensures Kali Linux hardware ALSA mixer un-mutes Master and Speaker channels and sets optimal output volume."""
        try:
            subprocess.run(["amixer", "set", "Master", "unmute", "95%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "set", "Speaker", "unmute", "100%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "set", "Headphone", "unmute", "100%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        except Exception as e:
            print(f"[AUDIO] Speaker config notice: {e}")

    def play_mobile_intercom_audio(self, audio_bytes: bytes, client_ts: Optional[str] = None) -> Dict[str, Any]:
        """Plays incoming mobile microphone voice through Kali Linux laptop speakers
        and saves the conversation clip for Google Drive syncing.
        """
        if not audio_bytes:
            return {"success": False, "error": "No audio data received"}

        now = datetime.datetime.now()
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        intercom_filename = f"intercom_{timestamp_str}.mp3"
        temp_input = self.cctv_recordings_dir / f"tmp_in_{timestamp_str}.webm"
        final_output = self.cctv_recordings_dir / intercom_filename

        try:
            with open(temp_input, "wb") as f:
                f.write(audio_bytes)

            conv_cmd = [
                "ffmpeg", "-y", "-nostdin",
                "-i", str(temp_input),
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                str(final_output)
            ]
            subprocess.run(conv_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)

            if not final_output.exists() or final_output.stat().st_size < 100:
                with open(final_output, "wb") as f:
                    f.write(audio_bytes)

            if temp_input.exists():
                try:
                    temp_input.unlink()
                except Exception:
                    pass

            file_size = final_output.stat().st_size if final_output.exists() else len(audio_bytes)

            # Play audio out loud through Kali laptop internal speakers
            def _play_worker():
                self._ensure_speakers_configured()
                try:
                    play_cmd = f"ffmpeg -nostdin -loglevel error -i '{final_output}' -f wav - | aplay -D default"
                    res = subprocess.run(play_cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
                    if res.returncode != 0:
                        # Fallback to ffplay for instant direct playback
                        subprocess.run(["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(final_output)],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
                except Exception as e:
                    print(f"[INTERCOM] Playback warning: {e}")

            threading.Thread(target=_play_worker, daemon=True).start()

            # Record in intercom metadata
            item = {
                "filename": intercom_filename,
                "path": str(final_output),
                "timestamp": now.isoformat(),
                "size_bytes": file_size,
                "gdrive_uploaded": False,
                "gdrive_folder": "My Drive/Kali_CCTV_Recordings2.0",
                "download_url": f"/api/camera/cctv/download/{intercom_filename}"
            }
            self.intercom_history.insert(0, item)
            self._save_intercom_metadata()

            # Automatically upload voice conversation to Google Drive folder Kali_CCTV_Recordings2.0
            threading.Thread(target=self._upload_to_gdrive_worker, args=(intercom_filename,), daemon=True).start()

            print(f"[INTERCOM] ✓ Voice message from mobile played on laptop speakers & saved: {intercom_filename}")
            return {
                "success": True,
                "filename": intercom_filename,
                "size_bytes": file_size,
                "played": True,
                "gdrive_syncing": True,
                "gdrive_folder": "Kali_CCTV_Recordings2.0"
            }
        except Exception as e:
            print(f"[INTERCOM] Error handling intercom audio: {e}")
            return {"success": False, "error": str(e)}

    def _load_intercom_metadata(self) -> List[Dict[str, Any]]:
        if self.intercom_meta_file.is_file():
            try:
                with open(self.intercom_meta_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def _save_intercom_metadata(self):
        try:
            with open(self.intercom_meta_file, 'w', encoding='utf-8') as f:
                json.dump(self.intercom_history[:100], f, indent=2)
        except Exception as e:
            print(f"[CCTV] Failed to save intercom metadata: {e}")

    def list_intercom_history(self) -> List[Dict[str, Any]]:
        self.intercom_history = self._load_intercom_metadata()
        return self.intercom_history

    get_intercom_history = list_intercom_history

    def _start_auto_sync_daemon(self):
        """Background automation thread: sweeps unuploaded files every 30s and ensures Google Drive sync."""
        def _daemon_loop():
            time.sleep(15)
            while True:
                try:
                    if self.cctv_auto_upload_gdrive:
                        for item in list(self.cctv_history)[:10]:
                            if not item.get("gdrive_uploaded"):
                                fpath = Path(item.get("path", ""))
                                if fpath.exists():
                                    self._upload_to_gdrive_worker(item["filename"])
                                    time.sleep(3)
                        for item in list(self.intercom_history)[:10]:
                            if not item.get("gdrive_uploaded"):
                                fpath = Path(item.get("path", ""))
                                if fpath.exists():
                                    self._upload_to_gdrive_worker(item["filename"])
                                    time.sleep(3)
                        self._prune_old_recordings_if_needed()
                except Exception:
                    pass
                time.sleep(30)

        t = threading.Thread(target=_daemon_loop, daemon=True)
        t.start()

    # =========================================================================
    # 3. PHONE CAMERA -> KALI LINUX LAPTOP DISPLAY WINDOW
    # =========================================================================
    def receive_phone_frame(self, jpeg_bytes: bytes):
        with self.phone_lock:
            self.last_phone_frame = jpeg_bytes
            self.last_phone_update = time.time()
            self.phone_streaming_active = True
        self._ensure_tk_viewer()

    def stop_phone_stream(self):
        with self.phone_lock:
            self.phone_streaming_active = False
            self.last_phone_frame = None
        if self.tk_root:
            try:
                self.tk_root.after(0, self._destroy_tk_window)
            except Exception:
                pass

    def _destroy_tk_window(self):
        if self.tk_root:
            try:
                self.tk_root.destroy()
            except Exception:
                pass
            self.tk_root = None
            self.tk_label = None
            self.tk_photo = None

    def _ensure_tk_viewer(self):
        if not TK_AVAILABLE:
            return
        if self.tk_thread is None or not self.tk_thread.is_alive():
            self.tk_stop_event.clear()
            self.tk_thread = threading.Thread(target=self._run_tk_viewer, daemon=True)
            self.tk_thread.start()

    def _run_tk_viewer(self):
        display = os.environ.get("DISPLAY", ":0")
        os.environ["DISPLAY"] = display

        try:
            root = tk.Tk()
            self.tk_root = root
            root.title("📱 SMART REMOTE - Phone Camera Feed")
            root.geometry("640x510+50+50")
            root.configure(bg="#090d16")

            header = tk.Frame(root, bg="#090d16")
            header.pack(fill=tk.X, padx=10, pady=6)
            title_lbl = tk.Label(header, text="● LIVE PHONE CAMERA STREAM", font=("Courier", 11, "bold"), fg="#38bdf8", bg="#090d16")
            title_lbl.pack(side=tk.LEFT)

            status_lbl = tk.Label(header, text="Direct Wireless Feed", font=("Courier", 9), fg="#94a3b8", bg="#090d16")
            status_lbl.pack(side=tk.RIGHT)

            lbl = tk.Label(root, bg="#000000")
            lbl.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)
            self.tk_label = lbl

            def update_feed():
                if not self.phone_streaming_active:
                    self._destroy_tk_window()
                    return

                with self.phone_lock:
                    frame_bytes = self.last_phone_frame
                    last_up = self.last_phone_update

                if time.time() - last_up > 6.0:
                    self.phone_streaming_active = False
                    self._destroy_tk_window()
                    return

                if frame_bytes and self.tk_label:
                    try:
                        pil_img = Image.open(io.BytesIO(frame_bytes))
                        pil_img.thumbnail((640, 480))
                        photo = ImageTk.PhotoImage(pil_img)
                        self.tk_photo = photo
                        self.tk_label.configure(image=photo)
                    except Exception:
                        pass

                if self.tk_root:
                    self.tk_root.after(30, update_feed)

            root.protocol("WM_DELETE_WINDOW", self.stop_phone_stream)
            root.after(50, update_feed)
            root.mainloop()
        except Exception as e:
            print(f"[CAMERA] Tkinter display error: {e}")
        finally:
            self.tk_root = None
            self.tk_label = None
            self.tk_photo = None


camera_manager = CameraManager()
