import os
import re
import subprocess
import shlex
from typing import Dict, Any, Tuple, Optional
from app.schemas.common import AssistantMessageResponse, CommandExecuteResponse

class AssistantService:
    DANGEROUS_PATTERNS = [
        r"\brm\b",
        r"\bdd\b",
        r"\bmkfs\b",
        r"\bshutdown\b",
        r"\breboot\b",
        r"\bpoweroff\b",
        r"\bkill\b",
        r"\bpkill\b",
        r"\bkillall\b",
        r"\bchmod\s+(-R\s+)?777\b",
        r"\bchown\b",
        r"\bapt\s+(remove|purge|autoremove)\b",
        r"\biptables\s+-F\b",
        r"\bufw\s+reset\b",
        r">\s*/dev/sd[a-z]",
        r":\(\)\s*\{\s*:\|:&\s*\};:",
    ]

    def is_command_destructive(self, command: str) -> bool:
        cmd_clean = command.strip()
        for pat in self.DANGEROUS_PATTERNS:
            if re.search(pat, cmd_clean, re.IGNORECASE):
                return True
        return False

    def process_message(self, message: str, context: Optional[Dict[str, Any]] = None) -> AssistantMessageResponse:
        text = message.strip().lower()

        # Navigation intents
        nav_routes = {
            "terminal": ("/terminal", "Opening the Linux terminal for you."),
            "screen": ("/mirror", "Opening the live screen mirror."),
            "mirror": ("/mirror", "Opening the live screen mirror."),
            "remote": ("/remote", "Switching to the Remote Control Center."),
            "mouse": ("/remote", "Switching to mouse controls."),
            "touchpad": ("/remote", "Opening touchpad mode."),
            "keyboard": ("/remote", "Opening the virtual keyboard."),
            "file": ("/files", "Opening the file manager."),
            "files": ("/files", "Opening the file manager."),
            "system": ("/system", "Opening system monitor & controls."),
            "process": ("/system", "Opening running processes in the system control center."),
            "media": ("/media", "Opening the media and OTT remote."),
            "device": ("/devices", "Navigating to device management."),
            "history": ("/history", "Opening activity and command history."),
            "setting": ("/settings", "Opening settings."),
        }

        for keyword, (route, reply) in nav_routes.items():
            if f"open {keyword}" in text or f"go to {keyword}" in text or f"show {keyword}" in text or text == keyword:
                return AssistantMessageResponse(
                    reply=reply,
                    action_type="navigate",
                    navigation_route=route
                )

        # Pre-programmed intelligent Linux command assistance
        common_queries = [
            (r"(cpu|processor)\s+usage", "top -b -n 1 | head -n 20", "Check current CPU usage and top active processes.", False),
            (r"(ram|memory)\s+usage", "free -h", "Display total, used, and free RAM and swap memory.", False),
            (r"(disk|storage|hard drive)\s+(space|usage)", "df -h /", "Check disk space utilization for root filesystem.", False),
            (r"large files", "find /home/aryan -type f -size +100M -exec ls -lh {} + 2>/dev/null | head -n 20", "Search for files larger than 100MB in your home folder.", False),
            (r"(ip|network)\s+(address|interfaces|config)", "ip -br a", "List brief network interface addresses and status.", False),
            (r"(listening|open)\s+(ports|sockets)", "ss -tuln", "List listening TCP/UDP network sockets.", False),
            (r"system\s+(uptime|boot)", "uptime", "Display how long the Linux system has been active.", False),
            (r"(running|active)\s+services", "systemctl list-units --type=service --state=running", "List active systemd services currently running.", False),
            (r"restart\s+(web\s*server|nginx|apache)", "systemctl restart nginx", "Restart Nginx web server service.", True),
            (r"restart\s+system", "systemctl reboot", "Reboot the Kali Linux workstation.", True),
            (r"shutdown\s+system", "systemctl poweroff", "Shut down the workstation immediately.", True),
        ]

        for pat, cmd, explanation, destructive in common_queries:
            if re.search(pat, text):
                is_dest = destructive or self.is_command_destructive(cmd)
                return AssistantMessageResponse(
                    reply=f"{explanation}\n\nSuggested command: `{cmd}`",
                    suggested_command=cmd,
                    is_destructive=is_dest,
                    requires_confirmation=is_dest,
                    action_type="execute"
                )

        # General inquiry / assistance
        if "why is my network slow" in text or "network slow" in text:
            cmd = "ping -c 4 8.8.8.8 && ip -s link"
            return AssistantMessageResponse(
                reply="To diagnose network latency and packet loss, test basic connectivity and check network interface error counters.",
                suggested_command=cmd,
                is_destructive=False,
                requires_confirmation=False,
                action_type="execute"
            )

        if "find" in text and "file" in text:
            cmd = "find /home/aryan -name '*.log' -mtime -1 2>/dev/null | head -n 20"
            return AssistantMessageResponse(
                reply="You can search for recently modified files using the `find` utility.",
                suggested_command=cmd,
                is_destructive=False,
                requires_confirmation=False,
                action_type="execute"
            )

        # Default helpful response
        return AssistantMessageResponse(
            reply=f"I can help inspect your Kali Linux machine, generate commands, or navigate Smart Remote. Try asking 'Show CPU usage', 'Find large files', 'Show listening ports', or 'Open Terminal'.",
            suggested_command="uname -a && uptime",
            is_destructive=False,
            requires_confirmation=False,
            action_type="execute"
        )

    def execute_command(self, command: str, confirmed: bool = False) -> CommandExecuteResponse:
        cmd_clean = command.strip()
        if not cmd_clean:
            return CommandExecuteResponse(command=command, stdout="", stderr="Empty command", exit_code=1)

        is_dest = self.is_command_destructive(cmd_clean)
        if is_dest and not confirmed:
            return CommandExecuteResponse(
                command=command,
                stdout="",
                stderr="Execution blocked: This command is classified as dangerous and requires explicit user confirmation.",
                exit_code=126
            )

        try:
            env = os.environ.copy()
            res = subprocess.run(
                cmd_clean,
                shell=True,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=15
            )
            return CommandExecuteResponse(
                command=command,
                stdout=res.stdout,
                stderr=res.stderr,
                exit_code=res.returncode
            )
        except subprocess.TimeoutExpired:
            return CommandExecuteResponse(
                command=command,
                stdout="",
                stderr="Command execution timed out after 15 seconds.",
                exit_code=124
            )
        except Exception as e:
            return CommandExecuteResponse(
                command=command,
                stdout="",
                stderr=str(e),
                exit_code=1
            )

assistant_service = AssistantService()
