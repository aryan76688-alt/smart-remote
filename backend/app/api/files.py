from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Query
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List
from pathlib import Path
import mimetypes
import shutil
import io
import os
import time
import zipfile
from sqlalchemy.orm import Session
from app.schemas.common import (
    FileListResponse, FileReadResponse, FileWriteRequest,
    FileCreateRequest, FileRenameRequest, FileDeleteRequest,
    BulkDownloadRequest, BulkDeleteRequest
)
from app.files.file_manager import file_manager
from app.database import get_db
from app.models.entities import Activity

router = APIRouter(prefix="/files", tags=["files"])

@router.get("/list", response_model=FileListResponse)
def list_files(path: str = ""):
    return file_manager.list_dir(path)

@router.get("/read", response_model=FileReadResponse)
def read_file(path: str):
    return file_manager.read_file(path)

@router.post("/write")
def write_file(req: FileWriteRequest, db: Session = Depends(get_db)):
    file_manager.write_file(req.path, req.content)
    db.add(Activity(action_type="file", description=f"Modified file: {req.path}", result="success"))
    db.commit()
    return {"success": True, "path": req.path}

@router.post("/create")
def create_item(req: FileCreateRequest, db: Session = Depends(get_db)):
    res = file_manager.create_item(req.path, is_directory=req.is_directory)
    db.add(Activity(action_type="file", description=f"Created {'folder' if req.is_directory else 'file'}: {req.path}", result="success"))
    db.commit()
    return {"success": True, "path": res}

@router.post("/rename")
def rename_item(req: FileRenameRequest, db: Session = Depends(get_db)):
    res = file_manager.rename_item(req.old_path, req.new_path)
    db.add(Activity(action_type="file", description=f"Renamed: {req.old_path} -> {req.new_path}", result="success"))
    db.commit()
    return {"success": True, "path": res}

@router.post("/delete")
def delete_item(req: FileDeleteRequest, db: Session = Depends(get_db)):
    file_manager.delete_item(req.path, confirmed=req.confirmed)
    db.add(Activity(action_type="file", description=f"Deleted: {req.path}", result="success"))
    db.commit()
    return {"success": True, "path": req.path}

@router.post("/upload")
async def upload_file(
    path: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    target_dir = file_manager._resolve_safe_path(path)
    if not target_dir.is_dir():
        target_dir = target_dir.parent

    dest = target_dir / file.filename
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        db.add(Activity(action_type="file", description=f"Uploaded file: {dest.name}", result="success"))
        db.commit()
        return {"success": True, "path": str(dest)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

def _create_zip_for_paths(paths: List[str]) -> io.BytesIO:
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for p in paths:
            if not p:
                continue
            try:
                target = file_manager._resolve_safe_path(p)
            except Exception:
                continue
            if not target.exists():
                continue
            if target.is_file():
                try:
                    zip_file.write(target, arcname=target.name)
                except Exception:
                    pass
            elif target.is_dir():
                folder_name = target.name if target.name else "folder"
                base_dir = target.parent if (target.parent != target and target.name) else target
                try:
                    zip_file.writestr(zipfile.ZipInfo(f"{folder_name}/"), "")
                except Exception:
                    pass
                for root, dirs, filenames in os.walk(target):
                    for d in dirs:
                        abs_dir = Path(root) / d
                        try:
                            rel_dir = abs_dir.relative_to(base_dir).as_posix()
                            zip_file.writestr(zipfile.ZipInfo(f"{rel_dir}/"), "")
                        except Exception:
                            pass
                    for filename in filenames:
                        abs_file = Path(root) / filename
                        try:
                            rel_path = abs_file.relative_to(base_dir).as_posix()
                            zip_file.write(abs_file, arcname=rel_path)
                        except Exception:
                            pass
    zip_buffer.seek(0)
    return zip_buffer

@router.get("/download")
def download_file(path: str, request: Request, inline: bool = False):
    target = file_manager._resolve_safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if target.is_dir():
        folder_name = target.name if target.name else "folder"
        zip_buffer = _create_zip_for_paths([path])
        headers = {
            "Content-Disposition": f'attachment; filename="{folder_name}.zip"',
            "Cache-Control": "no-cache"
        }
        return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

    mime_type, _ = mimetypes.guess_type(target.name)
    mime_type = mime_type or "application/octet-stream"

    is_media = any(mime_type.startswith(p) for p in ("video/", "audio/", "image/", "application/pdf"))
    if inline or is_media:
        file_size = target.stat().st_size
        range_header = request.headers.get("range")
        if range_header and range_header.strip().lower().startswith("bytes="):
            try:
                parts = range_header.strip().lower()[6:].split("-")
                start = int(parts[0]) if parts[0] else 0
                end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
                start = max(0, min(start, file_size - 1))
                end = max(start, min(end, file_size - 1))
                chunk_len = end - start + 1

                def iter_file():
                    with open(target, "rb") as f:
                        f.seek(start)
                        rem = chunk_len
                        while rem > 0:
                            buf = f.read(min(rem, 64 * 1024))
                            if not buf:
                                break
                            rem -= len(buf)
                            yield buf

                headers = {
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(chunk_len),
                    "Content-Type": mime_type,
                    "Content-Disposition": f'inline; filename="{target.name}"'
                }
                return StreamingResponse(iter_file(), status_code=206, headers=headers)
            except Exception:
                pass
        return FileResponse(path=str(target), media_type=mime_type, content_disposition_type="inline", filename=target.name)

    return FileResponse(path=str(target), filename=target.name)

@router.post("/bulk-download")
def bulk_download(req: BulkDownloadRequest):
    if not req.paths:
        raise HTTPException(status_code=400, detail="No files selected for download")

    zip_buffer = _create_zip_for_paths(req.paths)
    filename = f"smart_remote_export_{int(time.time())}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-cache"
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@router.get("/bulk-download-zip")
def bulk_download_zip_get(
    paths: Optional[str] = None,
    path: Optional[List[str]] = Query(None)
):
    target_paths: List[str] = []
    if path:
        target_paths.extend(path)
    if paths:
        clean = paths.strip()
        if clean.startswith("[") and clean.endswith("]"):
            try:
                import json
                parsed = json.loads(clean)
                if isinstance(parsed, list):
                    target_paths.extend([str(p) for p in parsed if p])
            except Exception:
                target_paths.extend([p.strip() for p in clean.split(",") if p.strip()])
        else:
            target_paths.extend([p.strip() for p in clean.split(",") if p.strip()])

    if not target_paths:
        raise HTTPException(status_code=400, detail="No files or folders selected for download")

    zip_buffer = _create_zip_for_paths(target_paths)
    filename = f"smart_remote_export_{int(time.time())}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-cache"
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@router.post("/bulk-upload")
async def bulk_upload(
    path: str = Form(""),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    target_dir = file_manager._resolve_safe_path(path)
    if not target_dir.is_dir():
        target_dir = target_dir.parent

    uploaded = []
    for file in files:
        if not file.filename:
            continue
        dest = target_dir / file.filename
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        uploaded.append(dest.name)

    db.add(Activity(action_type="file", description=f"Bulk uploaded {len(uploaded)} files to {target_dir.name}", result="success"))
    db.commit()
    return {"success": True, "uploaded": uploaded, "count": len(uploaded)}

@router.post("/bulk-delete")
def bulk_delete(req: BulkDeleteRequest, db: Session = Depends(get_db)):
    deleted = []
    for p in req.paths:
        try:
            file_manager.delete_item(p, confirmed=req.confirmed)
            deleted.append(p)
        except Exception:
            pass

    db.add(Activity(action_type="file", description=f"Bulk deleted {len(deleted)} files/folders", result="success"))
    db.commit()
    return {"success": True, "deleted": deleted, "count": len(deleted)}

