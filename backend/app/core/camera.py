import io
import time
import threading
import cv2
import numpy as np

class CameraCore:
    """Manages Laptop Webcam & Mobile Phone CCTV in-memory streams with zero disk bloat."""

    def __init__(self):
        self.laptop_cap = None
        self.laptop_active = False
        self.laptop_lock = threading.Lock()
        self.last_laptop_frame = None

        # Mobile Phone CCTV state
        self.mobile_cctv_requested = False
        self.mobile_last_active_time = 0
        self.mobile_frame_jpeg = None
        self.mobile_lock = threading.Lock()

        # Thermal mode & Tripwire
        self.thermal_mode = False
        self.tripwire_enabled = False
        self.tripwire_line_y = 0.5  # middle of screen
        self.tripwire_triggered = False

        # Background thread for laptop camera
        self._thread = None
        self._running = False

    def start_laptop_cam(self):
        with self.laptop_lock:
            if not self.laptop_active:
                try:
                    self.laptop_cap = cv2.VideoCapture(0)
                    if self.laptop_cap.isOpened():
                        self.laptop_active = True
                        self._running = True
                        self._thread = threading.Thread(target=self._laptop_loop, daemon=True)
                        self._thread.start()
                except Exception as e:
                    print(f"[CameraCore] Error starting laptop cam: {e}")

    def stop_laptop_cam(self):
        with self.laptop_lock:
            self._running = False
            self.laptop_active = False
            if self.laptop_cap:
                try:
                    self.laptop_cap.release()
                except Exception:
                    pass
                self.laptop_cap = None

    def _laptop_loop(self):
        while self._running:
            if self.laptop_cap and self.laptop_cap.isOpened():
                ret, frame = self.laptop_cap.read()
                if ret and frame is not None:
                    # Apply thermal colormap if enabled
                    if self.thermal_mode:
                        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                        frame = cv2.applyColorMap(gray, cv2.COLORMAP_INFERNO)

                    # Encode to JPEG in RAM
                    ret2, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                    if ret2:
                        with self.laptop_lock:
                            self.last_laptop_frame = buffer.tobytes()
            time.sleep(0.04)  # ~25 FPS

    def get_laptop_frame(self) -> bytes:
        with self.laptop_lock:
            if self.last_laptop_frame:
                return self.last_laptop_frame
        # Return fallback placeholder frame if camera unavailable
        blank = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(blank, "pearOS Laptop Cam Offline", (140, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 120, 120), 2)
        _, buf = cv2.imencode('.jpg', blank)
        return buf.tobytes()

    # Mobile CCTV management
    def set_mobile_cctv_requested(self, requested: bool):
        self.mobile_cctv_requested = requested
        if requested:
            self.mobile_last_active_time = time.time()

    def update_mobile_frame(self, jpeg_bytes: bytes):
        with self.mobile_lock:
            self.mobile_frame_jpeg = jpeg_bytes
            self.mobile_last_active_time = time.time()

    def get_mobile_frame(self) -> bytes:
        with self.mobile_lock:
            # If no fresh frame in past 10 seconds or not receiving
            if self.mobile_frame_jpeg and (time.time() - self.mobile_last_active_time < 10.0):
                return self.mobile_frame_jpeg

        blank = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(blank, "Mobile CCTV Waiting for Feed...", (120, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 180, 180), 2)
        _, buf = cv2.imencode('.jpg', blank)
        return buf.tobytes()

camera_core = CameraCore()
