import unittest
import os
import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database import init_db
from app.system.monitor import system_monitor
from app.files.file_manager import file_manager
from app.terminal.pty_manager import pty_manager
from app.input.controller import input_controller
from app.assistant.assistant_service import assistant_service
from app.voice.voice_service import voice_service

class TestSmartRemoteBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_system_info_and_stats(self):
        info = system_monitor.get_info()
        self.assertTrue(bool(info.hostname))
        self.assertTrue(bool(info.os_name))
        
        stats = system_monitor.get_stats()
        self.assertGreaterEqual(stats.cpu_percent, 0.0)
        self.assertGreater(stats.memory_total_bytes, 0)
        self.assertGreater(stats.disk_total_bytes, 0)

    def test_file_manager_safety_and_listing(self):
        listing = file_manager.list_dir()
        self.assertTrue(os.path.exists(listing.current_path))
        self.assertTrue(len(listing.items) >= 0)

        # Test path traversal block
        with self.assertRaises(Exception):
            file_manager.list_dir("/etc/shadow")
        
        with self.assertRaises(Exception):
            file_manager.list_dir("../../../../../etc")

    def test_terminal_pty_session(self):
        sess = pty_manager.get_or_create("unit_test_session", rows=24, cols=80)
        self.assertTrue(sess.active)
        sess.write("echo UNIT_TEST_OK\n")
        import time
        time.sleep(0.1)
        output = sess.read()
        self.assertIn(b"UNIT_TEST_OK", output)
        pty_manager.remove("unit_test_session")
        self.assertFalse(sess.active)

    def test_assistant_safety(self):
        self.assertTrue(assistant_service.is_command_destructive("rm -rf /"))
        self.assertTrue(assistant_service.is_command_destructive("reboot"))
        self.assertTrue(assistant_service.is_command_destructive("shutdown -h now"))
        self.assertFalse(assistant_service.is_command_destructive("uptime"))
        self.assertFalse(assistant_service.is_command_destructive("ls -la"))

        # Blocked dangerous execution
        res = assistant_service.execute_command("rm -rf /tmp/fake", confirmed=False)
        self.assertEqual(res.exit_code, 126)
        self.assertIn("blocked", res.stderr.lower())

        # Allowed safe execution
        res_safe = assistant_service.execute_command("echo HELLO_SAFE", confirmed=False)
        self.assertEqual(res_safe.exit_code, 0)
        self.assertIn("HELLO_SAFE", res_safe.stdout)

    def test_voice_service_intents(self):
        v1 = voice_service.process_voice_transcript("open terminal")
        self.assertIn("/terminal", v1.action_executed)

        v2 = voice_service.process_voice_transcript("restart system")
        self.assertTrue(v2.requires_confirmation)
        self.assertIn("reboot", v2.pending_command)

        # Spoken output has zero markdown (no *, #, `, [])
        v3 = voice_service.process_voice_transcript("system status")
        self.assertNotIn("*", v3.spoken_reply)
        self.assertNotIn("#", v3.spoken_reply)
        self.assertNotIn("`", v3.spoken_reply)

        # Voice search
        v4 = voice_service.process_voice_transcript("search files config")
        self.assertEqual(v4.action_executed, "search:files:config")

        # Voice button action
        v5 = voice_service.process_voice_transcript("scroll down")
        self.assertIn("scroll_down", v5.action_executed)

    def test_ott_and_window_switching(self):
        # Test OTT switch / launch controller method
        res = input_controller.launch_ott("youtube")
        self.assertIsInstance(res, bool)

    def test_face_authentication_flow(self):
        from fastapi import HTTPException
        from app.database import get_db
        from app.api.auth import register_face, verify_face, FaceRegisterRequest, FaceVerifyRequest

        db = next(get_db())
        # Test invalid credentials reject
        bad_req = FaceRegisterRequest(
            username="WrongUser",
            password="WrongPassword",
            face_descriptor=[0.1] * 128
        )
        with self.assertRaises(HTTPException) as cm:
            register_face(bad_req, db)
        self.assertEqual(cm.exception.status_code, 401)

        # Test valid master credentials registration
        good_req = FaceRegisterRequest(
            username="Aryan007",
            password="Aryan@2007",
            face_descriptor=[0.25] * 128
        )
        res_reg = register_face(good_req, db)
        self.assertTrue(res_reg["success"])

        # Test valid face verify
        verify_req = FaceVerifyRequest(
            face_descriptor=[0.25] * 128
        )
        res_verify = verify_face(verify_req, db)
        self.assertTrue(res_verify["authenticated"])

        # Test password fallback verify
        pwd_req = FaceVerifyRequest(
            username="Aryan007",
            password="Aryan@2007"
        )
        res_pwd = verify_face(pwd_req, db)
        self.assertTrue(res_pwd["authenticated"])

    def test_camera_manager_and_audio_status(self):
        from app.camera.camera_manager import camera_manager
        status = camera_manager.get_cctv_status()
        self.assertIn("is_recording", status)
        self.assertIn("always_record", status)
        self.assertIn("companion_audio", status)
        self.assertTrue(status["companion_audio"])
        self.assertIn("audio_noise_cancellation", status)
        self.assertIn("auto_light_adjust", status)

        settings = camera_manager.cctv_settings
        self.assertIn("always_record", settings)
        self.assertIn("motion_detection", settings)
        self.assertIn("audio_noise_cancellation", settings)
        self.assertIn("auto_light_adjust", settings)

        # Test toggle_motion_detection
        camera_manager.toggle_motion_detection(False)
        self.assertFalse(camera_manager.motion_detection_enabled)
        camera_manager.toggle_motion_detection(True)
        self.assertTrue(camera_manager.motion_detection_enabled)

        # Test toggle_audio_noise_cancellation
        camera_manager.toggle_audio_noise_cancellation(False)
        self.assertFalse(camera_manager.audio_noise_cancellation)
        camera_manager.toggle_audio_noise_cancellation(True)
        self.assertTrue(camera_manager.audio_noise_cancellation)

        # Test toggle_auto_light_adjust
        camera_manager.toggle_auto_light_adjust(False)
        self.assertFalse(camera_manager.auto_light_adjust)
        camera_manager.toggle_auto_light_adjust(True)
        self.assertTrue(camera_manager.auto_light_adjust)

        # Test intercom history
        history = camera_manager.get_intercom_history()
        self.assertIsInstance(history, list)

        # Test rclone destination folder is Kali_CCTV_Recordings2.0
        from app.sync.rclone_manager import rclone_manager
        self.assertEqual(rclone_manager.cctv_folder_name, "Kali_CCTV_Recordings2.0")

if __name__ == "__main__":
    unittest.main()

