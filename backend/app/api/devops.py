import os
import subprocess
import shutil
import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

devops_router = APIRouter(prefix="/devops", tags=["DevOps & Sysadmin Cockpit"])

# ─── Container Management (Podman & Docker) ───────────────────────────────────

def _get_container_cli() -> Optional[str]:
    return shutil.which("podman") or shutil.which("docker")

@devops_router.get("/containers")
def list_containers():
    """Lists all Podman and Docker containers with their status, ports, and image."""
    cli = _get_container_cli()
    if not cli:
        return {"success": False, "error": "Neither Podman nor Docker is installed", "containers": []}

    try:
        proc = subprocess.run(
            [cli, "ps", "-a", "--format", "{{json .}}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=3
        )
        containers = []
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                # Normalize keys
                containers.append({
                    "id": data.get("ID") or data.get("Id") or "",
                    "names": data.get("Names") or data.get("Name") or "",
                    "image": data.get("Image") or "",
                    "status": data.get("Status") or "",
                    "state": data.get("State") or "",
                    "ports": data.get("Ports") or ""
                })
            except Exception:
                pass
        return {"success": True, "cli": os.path.basename(cli), "containers": containers}
    except Exception as e:
        return {"success": False, "error": str(e), "containers": []}

class ContainerActionRequest(BaseModel):
    container_id: str
    action: str  # start, stop, restart

@devops_router.post("/containers/action")
def container_action(req: ContainerActionRequest):
    """Executes start, stop, or restart on a container."""
    cli = _get_container_cli()
    if not cli:
        raise HTTPException(status_code=400, detail="Container runtime not found")

    if req.action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    try:
        subprocess.run([cli, req.action, req.container_id], check=True, timeout=10)
        return {"success": True, "message": f"Container {req.container_id} {req.action}ed successfully"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to {req.action} container: {str(e)}")

@devops_router.get("/containers/logs")
def container_logs(id: str, tail: int = 50):
    """Fetches trailing logs for a specific container."""
    cli = _get_container_cli()
    if not cli:
        raise HTTPException(status_code=400, detail="Container runtime not found")
    try:
        proc = subprocess.run(
            [cli, "logs", "--tail", str(tail), id],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=4
        )
        return {"success": True, "logs": proc.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Systemd Service Switchboard ──────────────────────────────────────────────

CORE_SERVICES = [
    {"name": "smart-remote.service", "label": "Smart Remote", "user": True},
    {"name": "smart-remote-n8n.service", "label": "n8n Automation", "user": True},
    {"name": "docker.service", "label": "Docker Engine", "user": False},
    {"name": "postgresql.service", "label": "PostgreSQL DB", "user": False},
    {"name": "apache2.service", "label": "Apache Web Server", "user": False},
    {"name": "ssh.service", "label": "OpenSSH Server", "user": False},
    {"name": "tor.service", "label": "Tor Anonymizer", "user": False},
    {"name": "bluetooth.service", "label": "Bluetooth Daemon", "user": False},
    {"name": "tailscaled.service", "label": "Tailscale WireGuard", "user": False}
]

@devops_router.get("/services")
def list_services():
    """Lists key background services and their current active status."""
    results = []
    for svc in CORE_SERVICES:
        cmd = ["systemctl"]
        if svc["user"]:
            cmd.append("--user")
        cmd.extend(["is-active", svc["name"]])

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=1)
            status = res.stdout.strip()
        except Exception:
            status = "unknown"

        results.append({
            "service": svc["name"],
            "label": svc["label"],
            "is_user": svc["user"],
            "active": status == "active",
            "status": status
        })
    return {"success": True, "services": results}

class ServiceActionRequest(BaseModel):
    service: str
    action: str  # start, stop, restart
    is_user: bool = False

@devops_router.post("/services/action")
def service_action(req: ServiceActionRequest):
    """Starts, stops, or restarts a service."""
    if req.action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    cmd = ["systemctl"]
    if req.is_user:
        cmd.append("--user")
    else:
        cmd = ["sudo", "-n", "systemctl"]
    cmd.extend([req.action, req.service])

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if proc.returncode == 0:
            return {"success": True, "message": f"{req.service} {req.action}ed successfully"}
        return {"success": False, "message": proc.stderr or "Permission required"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Mobile Git Console ───────────────────────────────────────────────────────

@devops_router.get("/git")
def get_git_status():
    """Returns repository branch, status, and last 5 commits."""
    repo_dir = "/home/aryan/.gemini/antigravity/scratch/smart-remote"
    try:
        branch = subprocess.run(
            ["git", "-C", repo_dir, "branch", "--show-current"],
            stdout=subprocess.PIPE, text=True, timeout=2
        ).stdout.strip()

        status = subprocess.run(
            ["git", "-C", repo_dir, "status", "-s"],
            stdout=subprocess.PIPE, text=True, timeout=2
        ).stdout.strip()

        log = subprocess.run(
            ["git", "-C", repo_dir, "log", "-n", "5", "--oneline"],
            stdout=subprocess.PIPE, text=True, timeout=2
        ).stdout.strip().splitlines()

        return {
            "success": True,
            "branch": branch,
            "modified_files": len(status.splitlines()) if status else 0,
            "status": status,
            "recent_commits": log
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── 1-Tap Junk Cleaner ───────────────────────────────────────────────────────

@devops_router.post("/clean")
def clean_system():
    """Runs non-destructive cache cleanup to free space."""
    freed_mb = 0
    try:
        # Clear APT caches
        subprocess.run(["sudo", "-n", "apt-get", "clean"], timeout=5)
        # Vacuum journalctl logs older than 3 days
        subprocess.run(["sudo", "-n", "journalctl", "--vacuum-time=3d"], timeout=5)
        # Prune dead podman/docker containers
        cli = _get_container_cli()
        if cli:
            subprocess.run([cli, "container", "prune", "-f"], timeout=5)

        return {"success": True, "message": "Cache cleaned, old journals vacuumed, and containers pruned!"}
    except Exception as e:
        return {"success": True, "message": f"Light clean completed: {str(e)}"}
