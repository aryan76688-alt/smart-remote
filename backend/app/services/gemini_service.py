import os
import json
import base64
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger("smart_remote.gemini")

class GeminiService:
    def __init__(self):
        self.key_file = Path(__file__).resolve().parent.parent.parent / "config" / "gemini_key.txt"
        self._api_key: Optional[str] = None
        self._load_key()

    def _load_key(self):
        # 1. Environment variable
        env_key = os.getenv("GEMINI_API_KEY")
        if env_key and env_key.strip():
            self._api_key = env_key.strip()
            return

        # 2. Local config file
        if self.key_file.is_file():
            try:
                with open(self.key_file, "r", encoding="utf-8") as f:
                    k = f.read().strip()
                    if k:
                        self._api_key = k
            except Exception:
                pass

    def get_api_key(self) -> Optional[str]:
        return self._api_key

    def set_api_key(self, key: str):
        cleaned = key.strip()
        self._api_key = cleaned if cleaned else None
        try:
            self.key_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.key_file, "w", encoding="utf-8") as f:
                f.write(cleaned)
        except Exception as e:
            logger.warning(f"Failed to persist Gemini API key: {e}")

    def is_configured(self) -> bool:
        return bool(self._api_key and len(self._api_key) > 10)

    def analyze_security_frame(self, image_bytes: bytes) -> Dict[str, Any]:
        """Analyzes a CCTV motion capture frame using Gemini Vision to provide human-like security summaries."""
        if not self.is_configured():
            return {
                "success": False,
                "summary": "Gemini API key not configured in Settings.",
                "configured": False
            }

        try:
            b64_image = base64.b64encode(image_bytes).decode("utf-8")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self._api_key}"

            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": (
                                    "You are an AI Security Guard analyzing a live CCTV motion capture from a laptop/workstation. "
                                    "In 1 crisp, natural sentence (max 20 words), summarize what you see: "
                                    "Is there a person? What are they doing? (e.g. 'A person in a black jacket walked past the camera', "
                                    "'No person visible, light/shadow change detected', 'Pet on desk'). Be direct and factual."
                                )
                            },
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": b64_image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 60
                }
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                candidates = res_body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        summary = parts[0].get("text", "").strip()
                        return {
                            "success": True,
                            "summary": summary,
                            "configured": True
                        }

            return {"success": False, "summary": "No AI description generated.", "configured": True}

        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            logger.warning(f"Gemini API HTTP Error {e.code}: {err_msg}")
            return {"success": False, "summary": f"Gemini API Error ({e.code})", "configured": True}
        except Exception as e:
            logger.error(f"Gemini Vision analysis failed: {e}")
            return {"success": False, "summary": f"AI analysis error: {str(e)}", "configured": True}

    def ask_jarvis(self, prompt: str, system_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Translates voice/text commands into helpful responses and Linux actions."""
        if not self.is_configured():
            return {
                "reply": "Gemini AI Brain is not configured. Please paste your Gemini API key in Settings!",
                "command": None,
                "configured": False
            }

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self._api_key}"

            sys_prompt = (
                "You are Jarvis, the intelligent voice assistant built into Smart Remote for Kali Linux. "
                "The user controls their laptop remotely from Android. "
                "Respond helpfully and concisely (under 40 words). "
                "If the user is asking to execute an action (e.g. check disk, lock screen, open browser, play music), "
                "provide a safe Linux bash command in your response formatted as JSON: "
                "{\"reply\": \"...\", \"command\": \"...\"}. Otherwise format as {\"reply\": \"...\", \"command\": null}."
            )

            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"System Prompt: {sys_prompt}\nUser request: {prompt}\nContext: {json.dumps(system_context or {})}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 150
                }
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )

            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                candidates = res_body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        # Clean json block if present
                        if text.startswith("```"):
                            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                        try:
                            parsed = json.loads(text)
                            return {
                                "reply": parsed.get("reply", text),
                                "command": parsed.get("command"),
                                "configured": True
                            }
                        except Exception:
                            return {"reply": text, "command": None, "configured": True}

            return {"reply": "Jarvis could not process the request.", "command": None, "configured": True}
        except Exception as e:
            return {"reply": f"Jarvis AI error: {e}", "command": None, "configured": True}

gemini_service = GeminiService()
