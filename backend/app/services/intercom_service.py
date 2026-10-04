import os
import time
import shutil
import signal
import logging
import threading
import subprocess
from typing import Optional, Dict, Any

logger = logging.getLogger("smart_remote.intercom")

class IntercomService:
    def __init__(self):
        self._siren_process: Optional[subprocess.Popen] = None
        self._siren_lock = threading.Lock()
        self._is_siren_active = False

    def is_siren_active(self) -> bool:
        with self._siren_lock:
            if self._siren_process and self._siren_process.poll() is None:
                return True
            self._is_siren_active = False
            return False

    def start_emergency_siren(self, duration_sec: int = 30) -> Dict[str, Any]:
        """Unmutes speaker, boosts volume to 100%, and plays a loud pulsing emergency alarm on laptop speakers."""
        with self._siren_lock:
            if self._siren_process and self._siren_process.poll() is None:
                return {"active": True, "message": "Emergency siren is already active."}

            try:
                # Unmute and boost hardware speakers
                subprocess.run(["amixer", "set", "Master", "unmute", "100%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
                subprocess.run(["amixer", "set", "Speaker", "unmute", "100%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            except Exception as e:
                logger.warning(f"Failed to boost audio volume: {e}")

            # Synthesize loud oscillating emergency siren tone using ffmpeg/ffplay
            # Frequencies oscillate between 650Hz and 1200Hz in high-tempo wave
            siren_cmd = (
                f"ffplay -nodisp -autoexit -loglevel quiet -f lavfi "
                f"-i 'sine=frequency=800:duration={duration_sec},volume=3.0,asetrate=44100*1.15' "
                f"-af 'volume=3.5,alimiter=limit=0.98' 2>/dev/null"
            )

            try:
                proc = subprocess.Popen(
                    siren_cmd,
                    shell=True,
                    preexec_fn=os.setsid,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                self._siren_process = proc
                self._is_siren_active = True

                # Auto-stop timer
                def auto_stop():
                    time.sleep(duration_sec)
                    self.stop_emergency_siren()

                threading.Thread(target=auto_stop, daemon=True).start()
                return {"active": True, "duration_sec": duration_sec, "message": "🚨 Emergency siren activated at MAXIMUM volume!"}
            except Exception as e:
                logger.error(f"Failed to start emergency siren: {e}")
                return {"active": False, "error": str(e)}

    def stop_emergency_siren(self) -> Dict[str, Any]:
        """Immediately stops the emergency siren and restores normal speaker levels."""
        with self._siren_lock:
            if self._siren_process:
                try:
                    os.killpg(os.getpgid(self._siren_process.pid), signal.SIGTERM)
                    self._siren_process.wait(timeout=1.0)
                except Exception:
                    try:
                        os.killpg(os.getpgid(self._siren_process.pid), signal.SIGKILL)
                    except Exception:
                        pass
                self._siren_process = None
            self._is_siren_active = False

        # Reset volume to 75%
        try:
            subprocess.run(["amixer", "set", "Master", "75%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        except Exception:
            pass

        return {"active": False, "message": "Emergency siren silenced."}

    def play_intercom_audio(self, audio_data: bytes, audio_format: str = "webm") -> Dict[str, Any]:
        """Broadcasts incoming voice from mobile mic directly out of laptop speakers in real-time."""
        try:
            # Unmute speaker
            subprocess.run(["amixer", "set", "Speaker", "unmute", "85%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            subprocess.run(["amixer", "set", "Master", "unmute", "85%"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        except Exception:
            pass

        # Write to temporary file and stream through ffplay with fast start
        temp_audio = f"/tmp/smart_remote_intercom_{int(time.time()*1000)}.{audio_format}"
        try:
            with open(temp_audio, "wb") as f:
                f.write(audio_data)

            # Play asynchronously
            def player():
                try:
                    subprocess.run(
                        ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", temp_audio],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=15
                    )
                except Exception as ex:
                    logger.warning(f"Intercom playback exception: {ex}")
                finally:
                    if os.path.exists(temp_audio):
                        try:
                            os.remove(temp_audio)
                        except Exception:
                            pass

            threading.Thread(target=player, daemon=True).start()
            return {"success": True, "message": "Voice audio broadcasted to laptop speakers."}
        except Exception as e:
            logger.error(f"Intercom audio error: {e}")
            return {"success": False, "error": str(e)}

intercom_service = IntercomService()
