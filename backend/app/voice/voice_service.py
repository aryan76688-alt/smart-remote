import re
import html
from typing import Dict, Any, Optional
from app.input.controller import input_controller
from app.screen.streamer import screen_streamer
from app.system.monitor import system_monitor
from app.schemas.common import VoiceCommandResponse

class VoiceService:
    def _phonetic_cleanse(self, text: str) -> str:
        """Converts text into natural spoken English with zero visual markup and phonetic expansions."""
        # Strip HTML, Markdown asterisks, backticks, hashes, bullets, brackets
        t = re.sub(r"<[^>]+>", "", text)
        t = re.sub(r"[`*#_~]", "", t)
        t = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", t)
        t = re.sub(r"[\r\n]+", " ", t)

        # Phonetic expansions
        t = re.sub(r"(\d+)\s*%", r"\1 percent", t)
        t = re.sub(r"(\d+(\.\d+)?)\s*GB", r"\1 gigabytes", t, flags=re.IGNORECASE)
        t = re.sub(r"(\d+(\.\d+)?)\s*MB", r"\1 megabytes", t, flags=re.IGNORECASE)
        t = re.sub(r"(\d+(\.\d+)?)\s*KB", r"\1 kilobytes", t, flags=re.IGNORECASE)
        t = re.sub(r"\bCPU\b", "C P U", t)
        t = re.sub(r"\bRAM\b", "ram", t)
        t = re.sub(r"\bPID\b", "P I D", t)
        t = re.sub(r"\bIP\b", "I P", t)
        t = re.sub(r"\bkbps\b", "kilobits per second", t, flags=re.IGNORECASE)

        # Remove extra whitespace
        t = " ".join(t.split())
        return t

    def process_voice_transcript(self, transcript: str) -> VoiceCommandResponse:
        raw_text = transcript.strip()
        t = raw_text.lower()

        # 1. MOUSE / TOUCHPAD CLICKS & ACTIONS
        if re.search(r"\b(left\s*click|primary\s*click|click\s*left)\b", t) or t == "click":
            input_controller.click(1)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Left click executed.",
                action_executed="mouse:click_1"
            )

        if re.search(r"\b(right\s*click|secondary\s*click|context\s*menu)\b", t):
            input_controller.click(3)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Right click executed.",
                action_executed="mouse:click_3"
            )

        if re.search(r"\b(double\s*click)\b", t):
            input_controller.double_click(1)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Double click executed.",
                action_executed="mouse:double_click"
            )

        if re.search(r"\b(middle\s*click|scroll\s*click)\b", t):
            input_controller.click(2)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Middle click executed.",
                action_executed="mouse:click_2"
            )

        # SCROLLING
        if re.search(r"\b(scroll\s*up|page\s*up)\b", t):
            input_controller.scroll(delta_y=3)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Scrolled up.",
                action_executed="mouse:scroll_up"
            )

        if re.search(r"\b(scroll\s*down|page\s*down)\b", t):
            input_controller.scroll(delta_y=-3)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Scrolled down.",
                action_executed="mouse:scroll_down"
            )

        # 2. D-PAD & ARROW NAVIGATION
        if re.search(r"\b(move\s*up|press\s*up|go\s*up)\b", t):
            input_controller.dpad_move("up", 25)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Moved up.",
                action_executed="dpad:up"
            )

        if re.search(r"\b(move\s*down|press\s*down|go\s*down)\b", t):
            input_controller.dpad_move("down", 25)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Moved down.",
                action_executed="dpad:down"
            )

        if re.search(r"\b(move\s*left|press\s*left|go\s*left)\b", t):
            input_controller.dpad_move("left", 25)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Moved left.",
                action_executed="dpad:left"
            )

        if re.search(r"\b(move\s*right|press\s*right|go\s*right)\b", t):
            input_controller.dpad_move("right", 25)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Moved right.",
                action_executed="dpad:right"
            )

        if re.search(r"\b(press\s*enter|press\s*ok|confirm)\b", t):
            input_controller.key_press("Return")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Enter pressed.",
                action_executed="key:enter"
            )

        # 3. MEDIA CONTROLS
        if re.search(r"\b(volume\s*up|increase\s*volume|louder)\b", t):
            input_controller.media_action("vol_up")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Volume increased.",
                action_executed="media:vol_up"
            )

        if re.search(r"\b(volume\s*down|decrease\s*volume|lower\s*volume|softer)\b", t):
            input_controller.media_action("vol_down")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Volume decreased.",
                action_executed="media:vol_down"
            )

        if re.search(r"\b(mute|unmute|toggle\s*sound)\b", t):
            input_controller.media_action("mute")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Mute toggled.",
                action_executed="media:mute"
            )

        # 3.5. UNLOCK / WAKE SCREEN
        if re.search(r"\b(unlock\s*screen|wake\s*screen|wake\s*up\s*screen|turn\s*on\s*screen|wake\s*up|unlock\s*kali|unlock\s*display)\b", t):
            input_controller.unlock_screen()
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Workstation screen awakened and unlocked.",
                action_executed="remote:unlock_screen"
            )

        # 4. OTT APPS (WITH SMART WINDOW SWITCHING & YOUTUBE MUSIC)
        ott_triggers = {
            "youtube music": "youtube_music",
            "youtube": "youtube",
            "netflix": "netflix",
            "prime video": "prime",
            "prime": "prime",
            "spotify": "spotify",
            "disney plus": "disney",
            "disney": "disney",
            "hotstar": "hotstar",
            "jiocinema": "jiocinema",
            "sonyliv": "sonyliv",
            "zee5": "zee5",
            "twitch": "twitch",
            "apple tv": "apple_tv",
            "hulu": "hulu",
            "crunchyroll": "crunchyroll",
            "plex": "plex",
            "soundcloud": "soundcloud",
            "max": "max",
            "peacock": "peacock",
            "paramount": "paramount",
            "espn": "espn",
            "vlc": "vlc",
            "chrome": "chrome",
            "firefox": "firefox"
        }
        for kw, app_key in ott_triggers.items():
            if f"open {kw}" in t or f"switch to {kw}" in t or f"play {kw}" in t or f"launch {kw}" in t:
                input_controller.launch_ott(app_key)
                display_name = kw.title()
                return VoiceCommandResponse(
                    transcript=raw_text,
                    spoken_reply=f"Switched to {display_name}.",
                    action_executed=f"ott:{app_key}"
                )

        if re.search(r"\b(play|pause|resume|toggle\s*playback)\b", t):
            input_controller.media_action("play_pause")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Playback toggled.",
                action_executed="media:play_pause"
            )

        if re.search(r"\b(next\s*track|next\s*song|skip)\b", t):
            input_controller.media_action("next")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Skipping to next track.",
                action_executed="media:next"
            )

        if re.search(r"\b(previous\s*track|previous\s*song|go\s*back)\b", t):
            input_controller.media_action("prev")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Playing previous track.",
                action_executed="media:prev"
            )

        # 4.5. WINDOW & SYSTEM SHORTCUTS
        if re.search(r"\b(minimize\s*window|minimize)\b", t):
            input_controller.key_press("Down", ["Alt"])
            return VoiceCommandResponse(transcript=raw_text, spoken_reply="Window minimized.", action_executed="window:minimize")

        if re.search(r"\b(maximize\s*window|maximize|fullscreen)\b", t):
            input_controller.key_press("F11")
            return VoiceCommandResponse(transcript=raw_text, spoken_reply="Window maximized.", action_executed="window:maximize")

        if re.search(r"\b(close\s*window)\b", t):
            input_controller.key_press("q", ["Control"])
            return VoiceCommandResponse(transcript=raw_text, spoken_reply="Window closed.", action_executed="window:close")

        if re.search(r"\b(switch\s*window|alt\s*tab)\b", t):
            input_controller.key_press("Tab", ["Alt"])
            return VoiceCommandResponse(transcript=raw_text, spoken_reply="Switched window.", action_executed="window:switch")

        # 5. VOICE SEARCH
        if re.search(r"\b(search files?|find files?)\b", t):
            query = re.sub(r"^(search files? for|search files?|find files? for|find files?)\s*", "", t, flags=re.IGNORECASE).strip()
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=f"Searching files for {query}.",
                action_executed=f"search:files:{query}"
            )

        if re.search(r"\b(search process(es)?|find process(es)?)\b", t):
            query = re.sub(r"^(search process(es)? for|search process(es)?|find process(es)? for|find process(es)?)\s*", "", t, flags=re.IGNORECASE).strip()
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=f"Filtering processes for {query}.",
                action_executed=f"search:process:{query}"
            )

        # 6. SYSTEM STATUS QUERIES (PHONETIC OPTIMIZATION)
        if re.search(r"\b(cpu|processor)\b", t):
            stats = system_monitor.get_stats()
            reply = f"Current C P U utilization is {int(round(stats.cpu_percent))} percent across {stats.cpu_cores} cores."
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=self._phonetic_cleanse(reply),
                action_executed="system:cpu"
            )

        if re.search(r"\b(ram|memory)\b", t):
            stats = system_monitor.get_stats()
            used_gb = round(stats.memory_used_bytes / (1024**3), 1)
            total_gb = round(stats.memory_total_bytes / (1024**3), 1)
            reply = f"Memory usage is {int(round(stats.memory_percent))} percent. Using {used_gb} gigabytes of {total_gb} gigabytes total."
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=self._phonetic_cleanse(reply),
                action_executed="system:ram"
            )

        if re.search(r"\b(disk|storage|hard drive)\b", t):
            stats = system_monitor.get_stats()
            reply = f"Root disk is at {int(round(stats.disk_percent))} percent capacity."
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=self._phonetic_cleanse(reply),
                action_executed="system:disk"
            )

        if re.search(r"\b(network|bandwidth|speed)\b", t):
            stats = system_monitor.get_stats()
            reply = f"Network traffic is transmitting at {int(stats.net_rate_tx_kbps)} kilobits per second and receiving at {int(stats.net_rate_rx_kbps)} kilobits per second."
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=self._phonetic_cleanse(reply),
                action_executed="system:net"
            )

        if re.search(r"\b(screenshot|screen capture)\b", t):
            screen_streamer.capture_screenshot()
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Screenshot captured and saved.",
                action_executed="screen:screenshot"
            )

        # 7. THEME SWITCHING (LIGHT & DARK THEMES)
        theme_match = re.search(r"\b(change\s*theme|switch\s*theme|set\s*theme)\s*(to)?\s*(cyberpunk|kali|matrix|dracula|nord|oled|light|cyber-light|solarized-light|nord-light)\b", t)
        if theme_match:
            target_theme = theme_match.group(3)
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply=f"Switched theme to {target_theme}.",
                action_executed=f"theme:{target_theme}"
            )
        if re.search(r"\b(light\s*theme|enable\s*light\s*theme|set\s*light\s*theme)\b", t):
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Switched to light theme.",
                action_executed="theme:light"
            )
        if re.search(r"\b(dark\s*theme|enable\s*dark\s*theme|set\s*dark\s*theme)\b", t):
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Switched to cyber dark theme.",
                action_executed="theme:cyberpunk"
            )

        # 8. APP NAVIGATION & DEVICE SWITCHING
        if re.search(r"\b(switch\s*device|select\s*device|change\s*device|device\s*select)\b", t):
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Opening device selector.",
                action_executed="navigate:device_select"
            )

        nav_map = {
            "terminal": ("/terminal", "Terminal opened."),
            "screen": ("/mirror", "Screen mirror opened."),
            "mirror": ("/mirror", "Screen mirror opened."),
            "remote": ("/remote", "Remote controls opened."),
            "touchpad": ("/remote", "Touchpad opened."),
            "mouse": ("/remote", "Mouse controls opened."),
            "keyboard": ("/remote", "Virtual keyboard opened."),
            "files": ("/files", "File manager opened."),
            "system": ("/system", "System monitor opened."),
            "assistant": ("/assistant", "AI assistant opened."),
            "media": ("/media", "Media remote opened."),
            "devices": ("/devices", "Devices view opened."),
            "history": ("/history", "Activity history opened."),
            "settings": ("/settings", "Settings opened."),
        }
        for kw, (route, spoken) in nav_map.items():
            if f"open {kw}" in t or f"go to {kw}" in t or f"switch to {kw}" in t:
                return VoiceCommandResponse(
                    transcript=raw_text,
                    spoken_reply=spoken,
                    action_executed=f"navigate:{route}"
                )

        # 9. DESTRUCTIVE ACTIONS (GATED BY CONFIRMATION)
        if re.search(r"\b(restart|reboot)\b", t):
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Are you sure you want to restart the system?",
                requires_confirmation=True,
                pending_command="systemctl reboot"
            )

        if re.search(r"\b(shutdown|power off)\b", t):
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Are you sure you want to shut down the machine?",
                requires_confirmation=True,
                pending_command="systemctl poweroff"
            )

        if re.search(r"\b(lock screen|lock machine|lock)\b", t):
            input_controller.media_action("power")
            return VoiceCommandResponse(
                transcript=raw_text,
                spoken_reply="Workstation display locked.",
                action_executed="system:lock"
            )

        # DEFAULT CONCISE AUTONOMOUS RESPONSE
        clean_prompt = self._phonetic_cleanse(raw_text)
        return VoiceCommandResponse(
            transcript=raw_text,
            spoken_reply=f"Ready for command. You said: {clean_prompt}.",
            action_executed=None
        )

voice_service = VoiceService()
