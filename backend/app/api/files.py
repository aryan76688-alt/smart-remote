from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List
from pathlib import Path
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

@router.get("/download")
def download_file(path: str):
    target = file_manager._resolve_safe_path(path)
    if not target.exists() or target.is_dir():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(target), filename=target.name)

@router.post("/bulk-download")
def bulk_download(req: BulkDownloadRequest):
    if not req.paths:
        raise HTTPException(status_code=400, detail="No files selected for download")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for p in req.paths:
            target = file_manager._resolve_safe_path(p)
            if not target.exists():
                continue
            if target.is_file():
                zip_file.write(target, arcname=target.name)
            elif target.is_dir():
                for root, _, filenames in os.walk(target):
                    for filename in filenames:
                        abs_file = Path(root) / filename
                        rel_path = abs_file.relative_to(target.parent)
                        zip_file.write(abs_file, arcname=str(rel_path))

    zip_buffer.seek(0)
    headers = {
        "Content-Disposition": f"attachment; filename=smart_remote_export_{int(time.time())}.zip"
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

