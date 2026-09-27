import os
import sys
import time
import platform
import subprocess
import socket
import datetime
from typing import List, Dict, Any, Optional
import psutil
from app.config import settings
from app.schemas.common import SystemStats, SystemInfo, ProcessItem

class SystemMonitor:
    def __init__(self):
        self._last_net_time = time.time()
        net = psutil.net_io_counters()
        self._last_net_bytes_sent = net.bytes_sent
        self._last_net_bytes_recv = net.bytes_recv

    def get_stats(self) -> SystemStats:
        now = time.time()
        time_delta = max(0.1, now - self._last_net_time)

        # CPU
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_per_core = psutil.cpu_percent(interval=None, percpu=True)
        cpu_cores = psutil.cpu_count(logical=True) or 1
        cpu_freq = psutil.cpu_freq()
        cpu_freq_mhz = cpu_freq.current if cpu_freq else None

        # Memory
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        cached = getattr(mem, "cached", 0)

        # Disk
        disk = psutil.disk_usage("/")

        # Network
        net = psutil.net_io_counters()
        tx_rate_kbps = ((net.bytes_sent - self._last_net_bytes_sent) * 8) / (time_delta * 1000)
        rx_rate_kbps = ((net.bytes_recv - self._last_net_bytes_recv) * 8) / (time_delta * 1000)
        
        self._last_net_time = now
        self._last_net_bytes_sent = net.bytes_sent
        self._last_net_bytes_recv = net.bytes_recv

        # Uptime
        boot_time = psutil.boot_time()
        uptime_seconds = now - boot_time

        # Temperature
        temp_c = None
        try:
            temps = psutil.sensors_temperatures()
            for key in ("coretemp", "k10temp", "acpitz", "cpu_thermal"):
                if key in temps and temps[key]:
                    temp_c = temps[key][0].current
                    break
        except Exception:
            pass

        # Battery
        battery_pct = None
        battery_plugged = None
        try:
            bat = psutil.sensors_battery()
            if bat:
                battery_pct = bat.percent
                battery_plugged = bat.power_plugged
        except Exception:
            pass

        return SystemStats(
            cpu_percent=cpu_percent,
            cpu_cores=cpu_cores,
            cpu_freq_mhz=cpu_freq_mhz,
            cpu_per_core=cpu_per_core,
            memory_total_bytes=mem.total,
            memory_used_bytes=mem.used,
            memory_free_bytes=mem.free,
            memory_cached_bytes=cached,
            memory_percent=mem.percent,
            swap_total_bytes=swap.total,
            swap_used_bytes=swap.used,
            swap_percent=swap.percent,
            disk_total_bytes=disk.total,
            disk_used_bytes=disk.used,
            disk_free_bytes=disk.free,
            disk_percent=disk.percent,
            net_bytes_sent=net.bytes_sent,
            net_bytes_recv=net.bytes_recv,
            net_rate_tx_kbps=max(0.0, round(tx_rate_kbps, 2)),
            net_rate_rx_kbps=max(0.0, round(rx_rate_kbps, 2)),
            uptime_seconds=uptime_seconds,
            temperature_celsius=temp_c,
            battery_percent=battery_pct,
            battery_plugged=battery_plugged,
        )

    def get_info(self) -> SystemInfo:
        hostname = socket.gethostname()
        username = os.environ.get("USER", os.environ.get("LOGNAME", "kali"))
        
        # OS distribution
        os_name = "Kali Linux"
        os_release = platform.release()
        try:
            if os.path.exists("/etc/os-release"):
                with open("/etc/os-release", "r") as f:
                    for line in f:
                        if line.startswith("PRETTY_NAME="):
                            os_name = line.split("=", 1)[1].strip().strip('"')
                            break
        except Exception:
            pass

        # Tailscale IP
        tailscale_ip = settings.TAILSCALE_IP
        try:
            ts_res = subprocess.run(["tailscale", "ip", "-4"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=1)
            if ts_res.returncode == 0 and ts_res.stdout.strip():
                tailscale_ip = ts_res.stdout.strip()
        except Exception:
            pass

        # Local LAN IP
        local_ip = "127.0.0.1"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            pass

        # Uptime human string
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        hours, remainder = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_human = f"{hours}h {minutes}m {seconds}s"

        return SystemInfo(
            hostname=hostname,
            username=username,
            os_name=os_name,
            os_release=os_release,
            kernel_version=platform.uname().release,
            architecture=platform.machine(),
            tailscale_ip=tailscale_ip,
            local_ip=local_ip,
            uptime_human=uptime_human,
            server_time=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            allowed_file_root=str(settings.canonical_allowed_root),
        )

    def list_processes(self, limit: int = 40, sort_by: str = "cpu") -> List[ProcessItem]:
        procs = []
        for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'status', 'create_time']):
            try:
                info = p.info
                ctime = datetime.datetime.fromtimestamp(info['create_time']).strftime('%H:%M:%S') if info.get('create_time') else ""
                procs.append(ProcessItem(
                    pid=info['pid'],
                    name=info['name'] or "",
                    username=info.get('username') or "",
                    cpu_percent=round(info.get('cpu_percent') or 0.0, 1),
                    memory_percent=round(info.get('memory_percent') or 0.0, 1),
                    status=info.get('status') or "running",
                    create_time=ctime,
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass

        if sort_by == "memory":
            procs.sort(key=lambda x: x.memory_percent, reverse=True)
        else:
            procs.sort(key=lambda x: x.cpu_percent, reverse=True)
        return procs[:limit]

    def kill_process(self, pid: int, sig: int = 15) -> bool:
        try:
            p = psutil.Process(pid)
            if sig == 9:
                p.kill()
            else:
                p.terminate()
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def power_action(self, action: str) -> Dict[str, Any]:
        act = action.lower().strip()
        cmd = None
        if act == "lock":
            cmd = ["xdotool", "key", "Super_L+l"]
        elif act == "logout":
            cmd = ["pkill", "-KILL", "-u", os.environ.get("USER", "kali")]
        elif act == "suspend":
            cmd = ["systemctl", "suspend"]
        elif act == "reboot":
            cmd = ["systemctl", "reboot"]
        elif act == "shutdown":
            cmd = ["systemctl", "poweroff"]
        else:
            return {"success": False, "error": f"Unknown power action '{action}'"}

        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"success": True, "action": act}
        except Exception as e:
            return {"success": False, "error": str(e)}

system_monitor = SystemMonitor()
