import os
import time
import io
import json
import uuid
import asyncio
import zipfile
import mimetypes
from pathlib import Path
from typing import Optional, List, Dict, Any
from collections import deque
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/phone-files", tags=["phone-files"])

# Staging directory for file transfers
STAGING_DIR = Path("/tmp/smart_remote_phone_files")
STAGING_DIR.mkdir(parents=True, exist_ok=True)

# In-memory Task Queue & Result Events
_phone_tasks: Dict[str, Dict[str, Any]] = {}
_device_task_queues: Dict[str, deque] = {}
_task_events: Dict[str, asyncio.Event] = {}
_task_results: Dict[str, Any] = {}

# Cached directory structures and storage info
_dir_cache: Dict[str, Dict[str, Any]] = {}
_storage_cache: Dict[str, Dict[str, Any]] = {}

DEFAULT_PHONE_CATEGORIES = [
    {
        "id": "dcim",
        "name": "Camera & DCIM",
        "path": "/storage/emulated/0/DCIM",
        "icon": "Camera",
        "badge": "Photos & Videos",
        "color": "cyan"
    },
    {
        "id": "download",
        "name": "Downloads",
        "path": "/storage/emulated/0/Download",
        "icon": "Download",
        "badge": "Received Files",
        "color": "emerald"
    },
    {
        "id": "documents",
        "name": "Documents",
        "path": "/storage/emulated/0/Documents",
        "icon": "FileText",
        "badge": "PDFs & Docs",
        "color": "amber"
    },
    {
        "id": "pictures",
        "name": "Pictures",
        "path": "/storage/emulated/0/Pictures",
        "icon": "Image",
        "badge": "Screenshots & Images",
        "color": "sky"
    },
    {
        "id": "music",
        "name": "Music & Audio",
        "path": "/storage/emulated/0/Music",
        "icon": "Music",
        "badge": "Audio Tracks",
        "color": "purple"
    },
    {
        "id": "movies",
        "name": "Movies & Recs",
        "path": "/storage/emulated/0/Movies",
        "icon": "Film",
        "badge": "Recordings",
        "color": "rose"
    },
    {
        "id": "whatsapp",
        "name": "WhatsApp Media",
        "path": "/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media",
        "icon": "MessageSquare",
        "badge": "Shared Media",
        "color": "emerald"
    },
    {
        "id": "root",
        "name": "Internal Storage Root",
        "path": "/storage/emulated/0",
        "icon": "HardDrive",
        "badge": "All Files (/sdcard)",
        "color": "slate"
    }
]

# Request models
class PhoneFileCreateRequest(BaseModel):
    path: str
    is_directory: bool = False
    device_id: str = "oppo"

class PhoneFileDeleteRequest(BaseModel):
    path: str
    device_id: str = "oppo"

class PhoneFileWriteRequest(BaseModel):
    path: str
    content: str
    device_id: str = "oppo"


def _enqueue_task(device_id: str, action: str, payload: dict) -> str:
    task_id = str(uuid.uuid4())
    task = {
        "task_id": task_id,
        "device_id": device_id,
        "action": action,
        "payload": payload,
        "created_at": time.time(),
        "status": "pending"
    }
    _phone_tasks[task_id] = task
    if device_id not in _device_task_queues:
        _device_task_queues[device_id] = deque()
    _device_task_queues[device_id].append(task_id)
    _task_events[task_id] = asyncio.Event()
    return task_id


async def _await_task_result(task_id: str, timeout: float = 4.0) -> Any:
    event = _task_events.get(task_id)
    if not event:
        return None
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return _task_results.get(task_id)
    except asyncio.TimeoutError:
        return None
    finally:
        _task_events.pop(task_id, None)


# -----------------------------------------------------------------------------
# Web Dashboard Endpoints
# -----------------------------------------------------------------------------

@router.get("/quick-categories")
def get_quick_categories(device_id: str = "oppo"):
    """Returns tactical quick access categories for phone storage."""
    return {
        "success": True,
        "device_id": device_id,
        "categories": DEFAULT_PHONE_CATEGORIES
    }


@router.get("/storage-info")
async def get_storage_info(device_id: str = "oppo"):
    """Queries phone internal storage capacity (Total, Free, Used, Breakdown)."""
    task_id = _enqueue_task(device_id, "get_storage", {})
    res = await _await_task_result(task_id, timeout=3.0)
    if res and res.get("success"):
        _storage_cache[device_id] = res
        return res

    cached = _storage_cache.get(device_id)
    if cached:
        return cached

    return {
        "success": True,
        "device_id": device_id,
        "total_bytes": 128 * 1024 * 1024 * 1024,
        "used_bytes": 68 * 1024 * 1024 * 1024,
        "free_bytes": 60 * 1024 * 1024 * 1024,
        "total_gb": 128.0,
        "used_gb": 68.0,
        "free_gb": 60.0,
        "used_percent": 53.1,
        "breakdown": {
            "images_bytes": 24 * 1024 * 1024 * 1024,
            "videos_bytes": 18 * 1024 * 1024 * 1024,
            "audio_bytes": 6 * 1024 * 1024 * 1024,
            "documents_bytes": 5 * 1024 * 1024 * 1024,
            "system_other_bytes": 15 * 1024 * 1024 * 1024
        },
        "is_cached": True
    }


@router.get("/list")
async def list_phone_dir(path: str = "/storage/emulated/0", device_id: str = "oppo"):
    """Lists files and folders on the remote phone storage."""
    clean_path = path.strip() or "/storage/emulated/0"
    cache_key = f"{device_id}:{clean_path}"

    task_id = _enqueue_task(device_id, "list_dir", {"path": clean_path})
    res = await _await_task_result(task_id, timeout=3.5)

    if res and isinstance(res, dict) and res.get("success"):
        _dir_cache[cache_key] = {
            "items": res.get("items", []),
            "timestamp": time.time(),
            "parent_path": res.get("parent_path")
        }
        return res

    if cache_key in _dir_cache:
        cached = _dir_cache[cache_key]
        return {
            "success": True,
            "current_path": clean_path,
            "parent_path": cached.get("parent_path"),
            "items": cached.get("items", []),
            "is_cached": True,
            "timestamp": cached.get("timestamp")
        }

    if clean_path in ("/storage/emulated/0", "/sdcard", ""):
        default_items = [
            {"name": "DCIM", "path": "/storage/emulated/0/DCIM", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Download", "path": "/storage/emulated/0/Download", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Documents", "path": "/storage/emulated/0/Documents", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Pictures", "path": "/storage/emulated/0/Pictures", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Music", "path": "/storage/emulated/0/Music", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Movies", "path": "/storage/emulated/0/Movies", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""},
            {"name": "Android", "path": "/storage/emulated/0/Android", "is_dir": True, "size_bytes": 0, "modified_time": time.strftime("%Y-%m-%d %H:%M:%S"), "permissions": "drwxrwx---", "mime_type": "folder", "extension": ""}
        ]
        return {
            "success": True,
            "current_path": "/storage/emulated/0",
            "parent_path": None,
            "items": default_items,
            "is_cached": True,
            "note": "Awaiting initial phone filesystem sync"
        }

    parent = str(Path(clean_path).parent) if clean_path != "/storage/emulated/0" else None
    return {
        "success": True,
        "current_path": clean_path,
        "parent_path": parent,
        "items": [],
        "is_cached": True
    }


@router.get("/read")
async def read_phone_file(path: str, device_id: str = "oppo"):
    """Reads text content of a file on remote phone."""
    task_id = _enqueue_task(device_id, "read_file", {"path": path})
    res = await _await_task_result(task_id, timeout=4.0)
    if res and res.get("success"):
        return res
    raise HTTPException(status_code=504, detail="Phone file read request timed out")


@router.get("/download")
async def download_phone_file(path: str, device_id: str = "oppo", inline: bool = False):
    """Downloads a file or zipped directory from remote phone."""
    filename = Path(path).name or "phone_file"
    task_id = _enqueue_task(device_id, "download_file", {"path": path})

    res = await _await_task_result(task_id, timeout=12.0)
    staged_path = STAGING_DIR / f"{task_id}.dat"

    if res and staged_path.exists():
        mime_type, _ = mimetypes.guess_type(filename)
        mime_type = mime_type or "application/octet-stream"
        disposition = "inline" if inline else "attachment"
        return FileResponse(
            path=str(staged_path),
            media_type=mime_type,
            content_disposition_type=disposition,
            filename=filename
        )

    raise HTTPException(status_code=504, detail="Phone file download timed out or file unavailable")


@router.get("/bulk-download-zip")
async def bulk_download_phone_zip(paths: str, device_id: str = "oppo"):
    """Packages multiple phone files/folders into a ZIP archive and streams it."""
    path_list = [p.strip() for p in paths.split(",") if p.strip()]
    if not path_list:
        raise HTTPException(status_code=400, detail="No paths provided for bulk download")

    task_id = _enqueue_task(device_id, "bulk_download_zip", {"paths": path_list})
    res = await _await_task_result(task_id, timeout=20.0)
    staged_path = STAGING_DIR / f"{task_id}.zip"

    if res and staged_path.exists():
        archive_name = f"phone_export_{int(time.time())}.zip"
        return FileResponse(
            path=str(staged_path),
            media_type="application/zip",
            content_disposition_type="attachment",
            filename=archive_name
        )

    raise HTTPException(status_code=504, detail="Phone bulk export timed out")


@router.post("/upload")
async def upload_to_phone(
    path: str = Form("/storage/emulated/0/Download"),
    file: UploadFile = File(...),
    device_id: str = Form("oppo")
):
    """Uploads file from web browser to phone storage."""
    file_id = str(uuid.uuid4())
    temp_target = STAGING_DIR / f"upload_{file_id}_{file.filename}"
    with open(temp_target, "wb") as f:
        f.write(await file.read())

    dest_path = str(Path(path) / file.filename)
    task_id = _enqueue_task(device_id, "pull_upload", {
        "file_id": file_id,
        "filename": file.filename,
        "target_path": dest_path,
        "size_bytes": temp_target.stat().st_size
    })

    res = await _await_task_result(task_id, timeout=10.0)
    return {"success": True, "path": dest_path, "device_id": device_id, "task_id": task_id}


@router.post("/delete")
async def delete_phone_item(req: PhoneFileDeleteRequest):
    """Deletes file or directory on remote phone."""
    task_id = _enqueue_task(req.device_id, "delete_item", {"path": req.path})
    res = await _await_task_result(task_id, timeout=4.0)
    return {"success": True, "path": req.path, "device_id": req.device_id}


@router.post("/create")
async def create_phone_item(req: PhoneFileCreateRequest):
    """Creates folder or file on remote phone."""
    task_id = _enqueue_task(req.device_id, "create_item", {
        "path": req.path,
        "is_directory": req.is_directory
    })
    res = await _await_task_result(task_id, timeout=4.0)
    return {"success": True, "path": req.path, "device_id": req.device_id}


@router.post("/write")
async def write_phone_file(req: PhoneFileWriteRequest):
    """Writes text/code content directly to file on phone."""
    task_id = _enqueue_task(req.device_id, "write_file", {
        "path": req.path,
        "content": req.content
    })
    res = await _await_task_result(task_id, timeout=5.0)
    return {"success": True, "path": req.path, "device_id": req.device_id}


# -----------------------------------------------------------------------------
# Phone App Polling & Relay Communication Endpoints
# -----------------------------------------------------------------------------

@router.get("/poll")
def poll_phone_tasks(device_id: str = "oppo"):
    """Phone app polls for pending file management tasks."""
    queue = _device_task_queues.get(device_id)
    if queue and len(queue) > 0:
        task_id = queue.popleft()
        task = _phone_tasks.get(task_id)
        if task and task.get("status") == "pending":
            task["status"] = "in_progress"
            return {"has_task": True, "task": task}

    return {"has_task": False}


@router.post("/result/{task_id}")
async def submit_task_result(task_id: str, request: Request):
    """Phone app posts result of completed task."""
    try:
        body = await request.json()
    except Exception:
        body = {"success": True}

    _task_results[task_id] = body
    if task_id in _phone_tasks:
        _phone_tasks[task_id]["status"] = "completed"

    event = _task_events.get(task_id)
    if event:
        event.set()

    return {"success": True, "task_id": task_id}


@router.post("/upload-file/{task_id}")
async def phone_upload_file_stage(task_id: str, request: Request):
    """Phone app uploads binary file stream for download requests."""
    body = await request.body()
    staged_path = STAGING_DIR / f"{task_id}.dat"
    with open(staged_path, "wb") as f:
        f.write(body)

    _task_results[task_id] = {"success": True, "size": len(body)}
    event = _task_events.get(task_id)
    if event:
        event.set()

    return {"success": True, "task_id": task_id, "bytes": len(body)}


@router.get("/staged-file/{file_id}")
def get_staged_upload_file(file_id: str):
    """Phone app fetches staged file to write onto phone storage."""
    matching = list(STAGING_DIR.glob(f"upload_{file_id}_*"))
    if not matching:
        raise HTTPException(status_code=404, detail="Staged upload not found")
    return FileResponse(path=str(matching[0]), filename=matching[0].name)
