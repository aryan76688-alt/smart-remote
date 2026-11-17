import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
from ..core.config import settings

router = APIRouter(prefix="/api/files", tags=["Files & pearDrop"])

class FileItem(BaseModel):
    name: str
    is_dir: bool
    size_bytes: int
    modified_time: float
    path: str

@router.get("/list")
def list_files(path: str = "/home/aryan"):
    # Security check: must be inside ALLOWED_FILE_ROOT
    clean_path = os.path.abspath(path)
    allowed_root = os.path.abspath(settings.ALLOWED_FILE_ROOT)
    if not clean_path.startswith(allowed_root):
        clean_path = allowed_root

    if not os.path.exists(clean_path):
        raise HTTPException(status_code=404, detail="Directory not found")

    items = []
    try:
        with os.scandir(clean_path) as it:
            for entry in it:
                if entry.name.startswith("."):
                    continue
                try:
                    stat = entry.stat()
                    items.append({
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size_bytes": stat.st_size if not entry.is_dir() else 0,
                        "modified_time": stat.st_mtime,
                        "path": entry.path
                    })
                except Exception:
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Directories first, then alphabetical
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {
        "success": True,
        "current_path": clean_path,
        "parent_path": os.path.dirname(clean_path) if clean_path != allowed_root else allowed_root,
        "items": items[:100]
    }

@router.get("/download")
def download_file(path: str):
    clean_path = os.path.abspath(path)
    allowed_root = os.path.abspath(settings.ALLOWED_FILE_ROOT)
    if not clean_path.startswith(allowed_root) or not os.path.isfile(clean_path):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(clean_path, filename=os.path.basename(clean_path))
