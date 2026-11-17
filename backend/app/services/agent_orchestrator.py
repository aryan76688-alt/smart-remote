"""
Agent Orchestrator Service
Multi-Agent, Multi-Subagent, and Multi-Provider LLM Engine for Smart Remote.
Supports:
- Master Orchestrator (Nova)
- Specialized Subagents (Sentinel, ShadowNet, Nexus, Argus, Synapse, OppoLink)
- Multi-Provider LLM Gateway:
  1. Google Gemini (gemini-2.5-flash, gemini-1.5-pro)
  2. OpenAI (gpt-4o, gpt-4o-mini)
  3. Anthropic / Claude (claude-3-5-sonnet, via FreeLLMAPI or Anthropic API)
  4. Local Ollama (llama3.3, qwen2.5, deepseek-r1)
- Extensible Plugin Tool Registry with safe execution
"""

import os
import re
import json
import time
import base64
import asyncio
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import httpx
import psutil

from app.config import settings
from app.database import SessionLocal
from app.models.entities import Setting, Activity

logger = logging.getLogger("smart_remote.agents")

# ─────────────────────────────────────────────────────────────────────────────
# 1. SUBAGENT DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

SUBAGENTS = {
    "nova": {
        "id": "nova",
        "name": "Nova Prime",
        "role": "Master Orchestrator",
        "avatar": "brain",
        "color": "cyan",
        "description": "Decomposes complex requests, plans execution graphs, and delegates to specialized subagents.",
        "system_prompt": (
            "You are Nova Prime, the Master AI Orchestrator of the Smart Remote Agent OS. "
            "Your job is to analyze user goals, coordinate specialized subagents (Sentinel for system/hardware, "
            "ShadowNet for cyber/network, Nexus for files, Argus for vision, Synapse for workflows, OppoLink for mobile), "
            "and synthesize clear, actionable responses. Call available plugins when necessary to gather live state or take actions."
        )
    },
    "sentinel": {
        "id": "sentinel",
        "name": "Sentinel-OS",
        "role": "System & Hardware Subagent",
        "avatar": "shield",
        "color": "emerald",
        "description": "Monitors CPU, RAM, disks, batteries, controls system volume, media, power, and process health.",
        "system_prompt": (
            "You are Sentinel-OS, the System Administration & Hardware subagent on pearOS. "
            "You manage processes, CPU/RAM diagnostics, power states (lock, sleep, reboot), and master audio volume. "
            "Provide precise diagnostics and execute system plugins safely."
        )
    },
    "shadownet": {
        "id": "shadownet",
        "name": "ShadowNet",
        "role": "CyberOps & Security Subagent",
        "avatar": "zap",
        "color": "purple",
        "description": "Scans local networks (Nmap/ARP), monitors open listening ports, and audits network security.",
        "system_prompt": (
            "You are ShadowNet, the CyberOps & Network Security subagent. "
            "You perform network discovery, port scanning, active connection auditing, and security checks on pearOS. "
            "Always report IP addresses, open ports, and potential vulnerabilities clearly."
        )
    },
    "nexus": {
        "id": "nexus",
        "name": "Nexus-Files",
        "role": "Data & Files Subagent",
        "avatar": "folder",
        "color": "amber",
        "description": "Manages host filesystem and Oppo phone storage, searches files, reads contents, and prepares ZIP archives.",
        "system_prompt": (
            "You are Nexus-Files, the Data & Storage subagent. "
            "You browse, search, inspect, read, and manage files on both the pearOS host and remote Oppo phone storage. "
            "Format file paths, sizes, and summaries neatly."
        )
    },
    "argus": {
        "id": "argus",
        "name": "Argus-Vision",
        "role": "Vision & Surveillance Subagent",
        "avatar": "eye",
        "color": "rose",
        "description": "Captures webcam snapshots, monitors live CCTV frames, takes desktop screenshots, and inspects visual scenes.",
        "system_prompt": (
            "You are Argus-Vision, the Surveillance & Vision subagent. "
            "You capture images from the laptop webcam or desktop screen, inspect CCTV activity, and describe visual feeds accurately."
        )
    },
    "synapse": {
        "id": "synapse",
        "name": "Synapse-Flow",
        "role": "Automation & Workflows Subagent",
        "avatar": "layers",
        "color": "sky",
        "description": "Triggers n8n workflows, manages automated routines, schedules cron jobs, and broadcasts alerts.",
        "system_prompt": (
            "You are Synapse-Flow, the Automation subagent. "
            "You trigger and inspect n8n workflows, manage background automations, and broadcast operational notifications."
        )
    },
    "oppolink": {
        "id": "oppolink",
        "name": "Oppo-Link",
        "role": "Mobile Fleet Subagent",
        "avatar": "smartphone",
        "color": "teal",
        "description": "Controls remote Oppo phone (GPS tracking, 110dB siren alarm, flashlight strobe, battery status).",
        "system_prompt": (
            "You are Oppo-Link, the Mobile Fleet subagent connected to the user's Oppo phone. "
            "You report phone battery/GPS location and trigger remote hardware actions like the emergency siren or flashlight strobe."
        )
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. PLUGIN REGISTRY
# ─────────────────────────────────────────────────────────────────────────────

class PluginRegistry:
    def __init__(self):
        self.plugins: Dict[str, Dict[str, Any]] = {}
        self._register_default_plugins()

    def register(self, name: str, description: str, category: str, parameters: Dict[str, Any], handler):
        self.plugins[name] = {
            "name": name,
            "description": description,
            "category": category,
            "parameters": parameters,
            "handler": handler,
            "enabled": True
        }

    def _register_default_plugins(self):
        # 1. System stats
        self.register(
            name="system_stats",
            description="Returns live CPU%, RAM%, disk usage, battery, and host uptime.",
            category="system",
            parameters={"type": "object", "properties": {}},
            handler=self._tool_system_stats
        )

        # 2. System volume
        self.register(
            name="system_volume",
            description="Gets or sets master audio volume (0-100) or toggles mute.",
            category="system",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["get", "set", "mute", "unmute"], "description": "Action to perform"},
                    "level": {"type": "integer", "description": "Volume level from 0 to 100"}
                },
                "required": ["action"]
            },
            handler=self._tool_system_volume
        )

        # 3. System power
        self.register(
            name="system_power",
            description="Locks workstation screen, puts system to sleep, or schedules a reboot.",
            category="system",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["lock", "sleep", "reboot"], "description": "Power action to execute"}
                },
                "required": ["action"]
            },
            handler=self._tool_system_power
        )

        # 4. Terminal command
        self.register(
            name="terminal_exec",
            description="Executes a safe shell command on pearOS and returns standard output and exit code.",
            category="system",
            parameters={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute"}
                },
                "required": ["command"]
            },
            handler=self._tool_terminal_exec
        )

        # 5. Network scan (Nmap)
        self.register(
            name="network_scan",
            description="Runs a quick Nmap ping sweep or port scan on the local subnet or target host.",
            category="security",
            parameters={
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "IP or subnet (e.g. 192.168.31.0/24 or 127.0.0.1)"},
                    "quick": {"type": "boolean", "description": "Whether to do a fast host discovery scan"}
                }
            },
            handler=self._tool_network_scan
        )

        # 6. Active network connections
        self.register(
            name="network_connections",
            description="Lists open listening TCP/UDP ports and active sockets.",
            category="security",
            parameters={"type": "object", "properties": {}},
            handler=self._tool_network_connections
        )

        # 7. List files
        self.register(
            name="files_list",
            description="Lists files and directories at the specified path on the pearOS host.",
            category="files",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (defaults to user home)"}
                }
            },
            handler=self._tool_files_list
        )

        # 8. Read file
        self.register(
            name="files_read",
            description="Reads the text content of a file on the pearOS host.",
            category="files",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file"}
                },
                "required": ["path"]
            },
            handler=self._tool_files_read
        )

        # 9. Search files
        self.register(
            name="files_search",
            description="Searches for files matching a keyword or extension in user directories.",
            category="files",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Filename keyword or pattern to find"},
                    "directory": {"type": "string", "description": "Directory to search within"}
                },
                "required": ["query"]
            },
            handler=self._tool_files_search
        )

        # 10. Camera snapshot
        self.register(
            name="camera_snapshot",
            description="Captures a live snapshot from the laptop webcam and returns image base64 metadata.",
            category="vision",
            parameters={"type": "object", "properties": {}},
            handler=self._tool_camera_snapshot
        )

        # 11. Screen snapshot
        self.register(
            name="screen_snapshot",
            description="Takes an instantaneous screenshot of the laptop display.",
            category="vision",
            parameters={"type": "object", "properties": {}},
            handler=self._tool_screen_snapshot
        )

        # 12. Oppo phone control
        self.register(
            name="oppo_phone_action",
            description="Sends hardware control commands to the connected Oppo phone (siren alarm, torch flashlight, GPS location).",
            category="mobile",
            parameters={
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["siren_on", "siren_off", "torch_on", "torch_off", "get_gps"], "description": "Action to trigger on Oppo phone"}
                },
                "required": ["action"]
            },
            handler=self._tool_oppo_phone_action
        )

    # Tool Implementations
    async def _tool_system_stats(self, **kwargs) -> Dict[str, Any]:
        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage(str(settings.canonical_allowed_root))
        battery = psutil.sensors_battery()

        return {
            "cpu_percent": cpu,
            "memory": {
                "total_gb": round(mem.total / (1024**3), 1),
                "used_gb": round(mem.used / (1024**3), 1),
                "percent": mem.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 1),
                "free_gb": round(disk.free / (1024**3), 1),
                "percent": disk.percent
            },
            "battery": {
                "percent": battery.percent if battery else None,
                "power_plugged": battery.power_plugged if battery else None
            } if battery else "AC Powered / Desktop",
            "uptime_seconds": int(time.time() - psutil.boot_time())
        }

    async def _tool_system_volume(self, action: str, level: Optional[int] = None, **kwargs) -> Dict[str, Any]:
        try:
            if action == "set" and level is not None:
                lvl = max(0, min(100, int(level)))
                subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{lvl}%"], check=False)
                return {"success": True, "action": "set", "level": lvl}
            elif action == "mute":
                subprocess.run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "1"], check=False)
                return {"success": True, "action": "mute", "muted": True}
            elif action == "unmute":
                subprocess.run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "0"], check=False)
                return {"success": True, "action": "unmute", "muted": False}
            else:
                out = subprocess.check_output(["pactl", "get-sink-volume", "@DEFAULT_SINK@"], text=True)
                match = re.search(r"(\d+)%", out)
                vol = int(match.group(1)) if match else 50
                return {"success": True, "current_volume": vol}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_system_power(self, action: str, **kwargs) -> Dict[str, Any]:
        if action == "lock":
            # Attempt xdg-screensaver, loginctl, or xflock4
            for cmd in [["loginctl", "lock-session"], ["xdg-screensaver", "lock"], ["xflock4"]]:
                res = subprocess.run(cmd, check=False)
                if res.returncode == 0:
                    return {"success": True, "action": "lock", "message": "Workstation locked"}
            return {"success": True, "action": "lock", "message": "Lock signal sent"}
        elif action == "sleep":
            subprocess.run(["systemctl", "suspend"], check=False)
            return {"success": True, "action": "sleep", "message": "Entering sleep state"}
        elif action == "reboot":
            return {"success": True, "action": "reboot", "message": "Reboot command received (safety mode: manual confirmation required in UI)"}
        return {"success": False, "error": "Unknown power action"}

    async def _tool_terminal_exec(self, command: str, **kwargs) -> Dict[str, Any]:
        # Block ultra-destructive commands
        blocked = [r"\brm\s+-rf\s+/\b", r"\bdd\b", r"\bmkfs\b"]
        for b in blocked:
            if re.search(b, command):
                return {"success": False, "error": f"Command rejected: dangerous pattern '{b}' detected."}

        try:
            res = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=12,
                cwd=str(settings.canonical_allowed_root)
            )
            stdout = res.stdout[-2000:] if len(res.stdout) > 2000 else res.stdout
            stderr = res.stderr[-1000:] if len(res.stderr) > 1000 else res.stderr
            return {
                "success": res.returncode == 0,
                "exit_code": res.returncode,
                "stdout": stdout.strip(),
                "stderr": stderr.strip()
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command execution timed out after 12 seconds"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_network_scan(self, target: Optional[str] = None, quick: bool = True, **kwargs) -> Dict[str, Any]:
        try:
            tgt = target or "192.168.31.0/24"
            cmd = ["nmap", "-sn", tgt] if quick else ["nmap", "-F", tgt]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            lines = [l for l in res.stdout.splitlines() if "Nmap scan report" in l or "Host is up" in l or "open" in l]
            return {
                "success": True,
                "target": tgt,
                "summary": lines[:20],
                "raw_output": res.stdout[:1500]
            }
        except Exception as e:
            # Fallback to ip neigh
            try:
                out = subprocess.check_output(["ip", "neigh"], text=True)
                return {"success": True, "fallback": "ip neigh", "neighbors": out.splitlines()[:15]}
            except Exception as e2:
                return {"success": False, "error": str(e)}

    async def _tool_network_connections(self, **kwargs) -> Dict[str, Any]:
        try:
            out = subprocess.check_output(["ss", "-tuln"], text=True)
            lines = out.splitlines()[:15]
            return {"success": True, "open_ports": lines}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_files_list(self, path: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        p = Path(path) if path else settings.canonical_allowed_root
        if not p.exists() or not p.is_dir():
            p = settings.canonical_allowed_root

        items = []
        try:
            for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))[:30]:
                items.append({
                    "name": child.name,
                    "is_dir": child.is_dir(),
                    "size_bytes": child.stat().st_size if child.is_file() else 0,
                    "path": str(child)
                })
            return {"success": True, "path": str(p), "items": items}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_files_read(self, path: str, **kwargs) -> Dict[str, Any]:
        p = Path(path)
        if not p.exists() or not p.is_file():
            return {"success": False, "error": f"File '{path}' does not exist"}
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            preview = content[:3000]
            return {"success": True, "name": p.name, "path": str(p), "size": p.stat().st_size, "content": preview}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_files_search(self, query: str, directory: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        base_dir = Path(directory) if directory else settings.canonical_allowed_root
        matches = []
        clean_q = query.lower()

        try:
            for root, dirs, files in os.walk(base_dir):
                # Don't recurse into hidden or heavy dirs
                dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", ".git", "venv", ".venv")]
                for f in files:
                    if clean_q in f.lower():
                        full_p = Path(root) / f
                        matches.append({
                            "name": f,
                            "path": str(full_p),
                            "size_bytes": full_p.stat().st_size
                        })
                        if len(matches) >= 20:
                            break
                if len(matches) >= 20:
                    break
            return {"success": True, "query": query, "count": len(matches), "matches": matches}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _tool_camera_snapshot(self, **kwargs) -> Dict[str, Any]:
        # Capture a webcam snapshot via fswebcam or ffmpeg or camera service
        img_path = Path("/tmp/agent_webcam_snap.jpg")
        try:
            subprocess.run(["fswebcam", "-r", "1280x720", "--no-banner", str(img_path)], capture_output=True, timeout=5, check=False)
            if img_path.exists() and img_path.stat().st_size > 1000:
                data = base64.b64encode(img_path.read_bytes()).decode("utf-8")
                return {
                    "success": True,
                    "image_b64": f"data:image/jpeg;base64,{data}",
                    "size_bytes": img_path.stat().st_size,
                    "message": "Webcam snapshot captured successfully"
                }
        except Exception:
            pass
        return {"success": True, "message": "Laptop webcam triggered (stream active on /cctv or /camera)"}

    async def _tool_screen_snapshot(self, **kwargs) -> Dict[str, Any]:
        img_path = Path("/tmp/agent_screen_snap.jpg")
        try:
            # Use import or scrot or maim
            subprocess.run(["scrot", str(img_path)], capture_output=True, timeout=4, check=False)
            if not img_path.exists():
                subprocess.run(["import", "-window", "root", str(img_path)], capture_output=True, timeout=4, check=False)
            if img_path.exists() and img_path.stat().st_size > 1000:
                data = base64.b64encode(img_path.read_bytes()).decode("utf-8")
                return {
                    "success": True,
                    "image_b64": f"data:image/jpeg;base64,{data}",
                    "size_bytes": img_path.stat().st_size,
                    "message": "Desktop screenshot captured"
                }
        except Exception:
            pass
        return {"success": True, "message": "Screen snapshot requested"}

    async def _tool_oppo_phone_action(self, action: str, **kwargs) -> Dict[str, Any]:
        from app.api.tracking import oppo_state, oppo_pending_actions
        if action == "siren_on":
            oppo_pending_actions["siren"] = True
            oppo_state["siren_active"] = True
            return {"success": True, "action": "siren_on", "status": "110dB Siren Alarm triggered on Oppo phone"}
        elif action == "siren_off":
            oppo_pending_actions["siren"] = False
            oppo_state["siren_active"] = False
            return {"success": True, "action": "siren_off", "status": "Siren Alarm stopped"}
        elif action == "torch_on":
            oppo_pending_actions["strobe"] = True
            oppo_state["strobe_active"] = True
            return {"success": True, "action": "torch_on", "status": "Flashlight Strobe enabled on Oppo phone"}
        elif action == "torch_off":
            oppo_pending_actions["strobe"] = False
            oppo_state["strobe_active"] = False
            return {"success": True, "action": "torch_off", "status": "Flashlight Strobe disabled"}
        elif action == "get_gps":
            return {
                "success": True,
                "lat": oppo_state.get("lat"),
                "lng": oppo_state.get("lng"),
                "accuracy": oppo_state.get("accuracy"),
                "battery": oppo_state.get("battery"),
                "last_seen": oppo_state.get("last_seen")
            }
        return {"success": False, "error": f"Unknown action '{action}'"}


# ─────────────────────────────────────────────────────────────────────────────
# 3. MULTI-PROVIDER LLM CALLER
# ─────────────────────────────────────────────────────────────────────────────

class AgentOrchestrator:
    def __init__(self):
        self.registry = PluginRegistry()

    def get_api_key(self, provider: str) -> Optional[str]:
        # Check database settings, then env, then fallback config
        db = SessionLocal()
        try:
            row = db.query(Setting).filter(Setting.key == f"{provider}_api_key").first()
            if row and row.value and len(row.value.strip()) > 5:
                return row.value.strip()
        finally:
            db.close()

        if provider == "gemini":
            env_val = os.getenv("GEMINI_API_KEY")
            if env_val: return env_val.strip()
            # Check key file
            kf = Path(__file__).resolve().parent.parent.parent / "config" / "gemini_key.txt"
            if kf.is_file():
                try: return kf.read_text().strip()
                except Exception: pass

        elif provider == "openai":
            env_val = os.getenv("OPENAI_API_KEY")
            if env_val: return env_val.strip()

        elif provider == "claude" or provider == "anthropic":
            env_val = os.getenv("ANTHROPIC_API_KEY")
            if env_val: return env_val.strip()

        return None

    def get_anthropic_base_url(self) -> str:
        return os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

    def get_ollama_base_url(self) -> str:
        db = SessionLocal()
        try:
            row = db.query(Setting).filter(Setting.key == "ollama_base_url").first()
            if row and row.value: return row.value.strip()
        finally:
            db.close()
        return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    async def execute_plugin(self, plugin_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        plugin = self.registry.plugins.get(plugin_name)
        if not plugin:
            return {"success": False, "error": f"Plugin '{plugin_name}' not found."}
        if not plugin.get("enabled", True):
            return {"success": False, "error": f"Plugin '{plugin_name}' is disabled."}

        try:
            return await plugin["handler"](**parameters)
        except Exception as e:
            logger.error(f"Error executing plugin {plugin_name}: {e}")
            return {"success": False, "error": str(e)}

    # Multi-Provider Prompt Dispatcher
    async def call_llm(
        self,
        provider: str,
        system_prompt: str,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        model: Optional[str] = None
    ) -> str:
        prov = provider.lower()

        if prov == "gemini":
            return await self._call_gemini(system_prompt, user_message, conversation_history, model)
        elif prov == "openai":
            return await self._call_openai(system_prompt, user_message, conversation_history, model)
        elif prov in ("claude", "anthropic"):
            return await self._call_claude(system_prompt, user_message, conversation_history, model)
        elif prov == "ollama":
            return await self._call_ollama(system_prompt, user_message, conversation_history, model)
        else:
            # Fallback to available provider
            for candidate in ["gemini", "openai", "claude", "ollama"]:
                key = self.get_api_key(candidate)
                if key or candidate == "ollama":
                    try:
                        return await self.call_llm(candidate, system_prompt, user_message, conversation_history)
                    except Exception:
                        continue
            raise RuntimeError(f"No active LLM provider configured. Please provide an API key for Gemini, OpenAI, Claude, or run Ollama.")

    async def _call_gemini(self, system_prompt: str, user_message: str, history: List[Dict[str, str]] = None, model: Optional[str] = None) -> str:
        api_key = self.get_api_key("gemini")
        if not api_key:
            raise RuntimeError("Gemini API key is not configured. Add it in Agent OS Settings.")

        mod = model or "gemini-2.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{mod}:generateContent?key={api_key}"

        contents = []
        if history:
            for item in history[-6:]:
                role = "user" if item.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": item.get("content", "")}]})

        contents.append({"role": "user", "parts": [{"text": user_message}]})

        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048}
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                return "".join([p.get("text", "") for p in parts])
            return "No response generated by Gemini."

    async def _call_openai(self, system_prompt: str, user_message: str, history: List[Dict[str, str]] = None, model: Optional[str] = None) -> str:
        api_key = self.get_api_key("openai")
        if not api_key:
            raise RuntimeError("OpenAI API key is not configured. Add it in Agent OS Settings.")

        mod = model or "gpt-4o-mini"
        url = "https://api.openai.com/v1/chat/completions"

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for item in history[-6:]:
                messages.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": mod,
            "messages": messages,
            "temperature": 0.4
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}"})
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_claude(self, system_prompt: str, user_message: str, history: List[Dict[str, str]] = None, model: Optional[str] = None) -> str:
        api_key = self.get_api_key("claude") or self.get_api_key("anthropic")
        if not api_key:
            raise RuntimeError("Claude / Anthropic API key is not configured.")

        base_url = self.get_anthropic_base_url().rstrip("/")
        url = f"{base_url}/v1/messages"
        mod = model or "claude-3-5-sonnet-20241022"

        messages = []
        if history:
            for item in history[-6:]:
                messages.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": mod,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.4
        }

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Claude API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            content_blocks = data.get("content", [])
            return "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])

    async def _call_ollama(self, system_prompt: str, user_message: str, history: List[Dict[str, str]] = None, model: Optional[str] = None) -> str:
        base_url = self.get_ollama_base_url().rstrip("/")
        url = f"{base_url}/api/chat"
        mod = model or "llama3.3"

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for item in history[-6:]:
                messages.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": mod,
            "messages": messages,
            "stream": False
        }

        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: Make sure Ollama is running.")
            data = resp.json()
            return data.get("message", {}).get("content", "No output from Ollama")

    # ─────────────────────────────────────────────────────────────────────────
    # 4. MULTI-AGENT GOAL ORCHESTRATION LOOP
    # ─────────────────────────────────────────────────────────────────────────
    async def process_agent_goal(
        self,
        goal: str,
        provider: str = "gemini",
        model: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Full autonomous reasoning loop:
        1. Nova Prime decomposes goal and decides which subagents and plugins to invoke.
        2. Executes tools in parallel or sequence.
        3. Invokes subagent for domain-specific answer.
        4. Synthesizes rich response with visual artifacts.
        """
        thought_chain = []
        visual_artifacts = []
        subagents_invoked = []

        start_time = time.time()

        # Step 1: Detect intent and needed plugins
        tools_summary = "\n".join([
            f"- {p['name']}: {p['description']} (parameters: {json.dumps(p['parameters'].get('properties', {}))})"
            for p in self.registry.plugins.values() if p['enabled']
        ])

        subagent_summary = "\n".join([
            f"- {s['id']} ({s['name']}): {s['description']}"
            for s in SUBAGENTS.values()
        ])

        planning_prompt = (
            "You are Nova Prime, Master Orchestrator of Smart Remote Agent OS.\n"
            "Analyze the user's request and output a STRICT JSON plan:\n"
            "{\n"
            "  \"target_subagents\": [\"sentinel\", \"nexus\", ...],\n"
            "  \"thought\": \"brief reasoning about what to do\",\n"
            "  \"tool_calls\": [\n"
            "    {\"plugin\": \"plugin_name\", \"parameters\": { ... }}\n"
            "  ]\n"
            "}\n"
            "Available Subagents:\n" + subagent_summary + "\n\n"
            "Available Plugins:\n" + tools_summary + "\n\n"
            "DO NOT include markdown fences in the plan, output ONLY raw JSON."
        )

        plan = {}
        try:
            raw_plan = await self.call_llm(provider, planning_prompt, f"User Goal: {goal}", model=model)
            # Clean JSON fences if present
            cleaned_plan = re.sub(r"^```(json)?|```$", "", raw_plan.strip(), flags=re.MULTILINE).strip()
            plan = json.loads(cleaned_plan)
        except Exception as e:
            logger.warning(f"Failed to parse LLM plan as JSON, using rule-based fallback: {e}")
            plan = self._rule_based_fallback_plan(goal)

        target_subagents = plan.get("target_subagents", ["sentinel"])
        subagents_invoked.extend(target_subagents)
        thought = plan.get("thought", "Analyzing and routing goal across subagents...")
        thought_chain.append({
            "agent": "nova",
            "type": "thought",
            "content": thought,
            "timestamp": time.time()
        })

        # Step 2: Execute requested tool calls
        tool_results = []
        tool_calls = plan.get("tool_calls", [])
        for tc in tool_calls:
            p_name = tc.get("plugin")
            p_params = tc.get("parameters", {})
            if not p_name: continue

            # Determine responsible subagent
            responsible = "sentinel"
            if "network" in p_name: responsible = "shadownet"
            elif "file" in p_name: responsible = "nexus"
            elif "camera" in p_name or "screen" in p_name: responsible = "argus"
            elif "oppo" in p_name: responsible = "oppolink"
            elif "n8n" in p_name: responsible = "synapse"

            thought_chain.append({
                "agent": responsible,
                "type": "tool_call",
                "tool": p_name,
                "params": p_params,
                "timestamp": time.time()
            })

            res = await self.execute_plugin(p_name, p_params)
            tool_results.append({"plugin": p_name, "params": p_params, "result": res})

            thought_chain.append({
                "agent": responsible,
                "type": "tool_result",
                "tool": p_name,
                "result": res,
                "timestamp": time.time()
            })

            # Check if visual artifacts generated
            if p_name in ("camera_snapshot", "screen_snapshot") and res.get("image_b64"):
                visual_artifacts.append({
                    "type": "image",
                    "title": "Camera Snapshot" if p_name == "camera_snapshot" else "Screen Capture",
                    "url": res["image_b64"]
                })
            elif p_name == "system_stats":
                visual_artifacts.append({
                    "type": "system_stats",
                    "title": "Live System Telemetry",
                    "data": res
                })
            elif p_name == "files_search" and res.get("matches"):
                visual_artifacts.append({
                    "type": "files_list",
                    "title": f"Files Found ({res.get('count', 0)})",
                    "items": res["matches"]
                })
            elif p_name == "oppo_phone_action" and "siren" in tc.get("parameters", {}).get("action", ""):
                visual_artifacts.append({
                    "type": "siren_alert",
                    "title": "110dB Phone Siren",
                    "active": "on" in tc["parameters"]["action"]
                })

        # Step 3: Synthesize final answer using primary subagent or Nova
        primary_subagent_id = target_subagents[0] if target_subagents else "nova"
        subagent_info = SUBAGENTS.get(primary_subagent_id, SUBAGENTS["nova"])

        synthesis_prompt = (
            f"{subagent_info['system_prompt']}\n\n"
            f"User Goal: {goal}\n\n"
            f"Tool Execution Results:\n{json.dumps(tool_results, indent=2)}\n\n"
            "Please provide a concise, expert synthesis of the findings and actions taken. "
            "Highlight key numbers, metrics, or status clearly. Be direct and helpful."
        )

        try:
            final_reply = await self.call_llm(provider, synthesis_prompt, f"Synthesize response for: {goal}", model=model)
        except Exception as e:
            final_reply = f"Completed operations. Tool findings: {json.dumps(tool_results)}"

        # Save activity
        try:
            db = SessionLocal()
            db.add(Activity(
                action_type="agent",
                description=f"[{subagent_info['name']}] {goal[:70]}",
                result="success"
            ))
            db.commit()
            db.close()
        except Exception:
            pass

        return {
            "success": True,
            "goal": goal,
            "provider_used": provider,
            "model_used": model or "default",
            "duration_seconds": round(time.time() - start_time, 2),
            "primary_subagent": subagent_info,
            "subagents_invoked": list(set(subagents_invoked)),
            "thought_chain": thought_chain,
            "tool_results": tool_results,
            "visual_artifacts": visual_artifacts,
            "reply": final_reply
        }

    def _rule_based_fallback_plan(self, goal: str) -> Dict[str, Any]:
        g = goal.lower()
        plan = {"target_subagents": ["nova"], "thought": "Executing direct system inspection", "tool_calls": []}

        if any(w in g for w in ("cpu", "ram", "memory", "battery", "disk", "stats", "health", "system")):
            plan["target_subagents"] = ["sentinel"]
            plan["tool_calls"].append({"plugin": "system_stats", "parameters": {}})

        if any(w in g for w in ("volume", "mute", "sound")):
            plan["target_subagents"] = ["sentinel"]
            if "mute" in g:
                plan["tool_calls"].append({"plugin": "system_volume", "parameters": {"action": "mute"}})
            else:
                m = re.search(r"(\d+)", g)
                lvl = int(m.group(1)) if m else 50
                plan["tool_calls"].append({"plugin": "system_volume", "parameters": {"action": "set", "level": lvl}})

        if any(w in g for w in ("lock", "sleep", "screen off")):
            plan["target_subagents"] = ["sentinel"]
            plan["tool_calls"].append({"plugin": "system_power", "parameters": {"action": "lock"}})

        if any(w in g for w in ("scan", "nmap", "network", "port", "ip", "wifi")):
            plan["target_subagents"] = ["shadownet"]
            plan["tool_calls"].append({"plugin": "network_scan", "parameters": {"quick": True}})

        if any(w in g for w in ("file", "search", "find", "document", "download")):
            plan["target_subagents"] = ["nexus"]
            words = [w for w in g.split() if len(w) > 3 and w not in ("file", "find", "search", "show")]
            q = words[0] if words else "pdf"
            plan["tool_calls"].append({"plugin": "files_search", "parameters": {"query": q}})

        if any(w in g for w in ("camera", "photo", "webcam", "snap")):
            plan["target_subagents"] = ["argus"]
            plan["tool_calls"].append({"plugin": "camera_snapshot", "parameters": {}})

        if any(w in g for w in ("screen", "screenshot")):
            plan["target_subagents"] = ["argus"]
            plan["tool_calls"].append({"plugin": "screen_snapshot", "parameters": {}})

        if any(w in g for w in ("siren", "alarm", "oppo", "phone", "torch", "flashlight")):
            plan["target_subagents"] = ["oppolink"]
            if "siren" in g:
                act = "siren_off" if "off" in g or "stop" in g else "siren_on"
                plan["tool_calls"].append({"plugin": "oppo_phone_action", "parameters": {"action": act}})
            elif "torch" in g or "flash" in g:
                act = "torch_off" if "off" in g or "stop" in g else "torch_on"
                plan["tool_calls"].append({"plugin": "oppo_phone_action", "parameters": {"action": act}})
            else:
                plan["tool_calls"].append({"plugin": "oppo_phone_action", "parameters": {"action": "get_gps"}})

        return plan


agent_orchestrator = AgentOrchestrator()
