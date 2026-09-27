import os
import json
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from app.database import SessionLocal
from app.models.entities import CctvRecordingEntity
from app.sync.rclone_manager import rclone_manager

class GDriveService:
    """Manages cloud CCTV playback, listing, and streaming from Google Drive."""

    def __init__(self):
        self.folder_name = "Kali_CCTV_Recordings2.0"

    def list_cloud_recordings(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Lists all CCTV video recordings currently stored in Google Drive.
        Syncs metadata to the database for persistence.
        """
        cloud_items = []
        raw_files = rclone_manager.list_cctv_files()

        db = SessionLocal()
        try:
            for item in raw_files:
                name = item.get("Name", "")
                if not name.endswith(".mp4") and not name.endswith(".mkv"):
                    continue

                file_id = item.get("ID", "")
                size_bytes = item.get("Size", 0)
                mod_time_str = item.get("ModTime", "")

                try:
                    created_at = datetime.fromisoformat(mod_time_str.replace("Z", "+00:00")) if mod_time_str else datetime.utcnow()
                except Exception:
                    created_at = datetime.utcnow()

                # Upsert into DB
                existing = db.query(CctvRecordingEntity).filter(CctvRecordingEntity.filename == name).first()
                if not existing:
                    existing = CctvRecordingEntity(
                        filename=name,
                        duration_sec=1800,
                        file_size_bytes=size_bytes,
                        created_at=created_at,
                        is_synced_gdrive=True,
                        gdrive_file_id=file_id,
                        gdrive_preview_link=f"https://drive.google.com/file/d/{file_id}/preview" if file_id else None,
                        gdrive_web_content_link=f"https://drive.google.com/uc?export=download&id={file_id}" if file_id else None
                    )
                    db.add(existing)
                    db.commit()
                elif not existing.is_synced_gdrive or not existing.gdrive_file_id:
                    existing.is_synced_gdrive = True
                    existing.gdrive_file_id = file_id
                    existing.gdrive_preview_link = f"https://drive.google.com/file/d/{file_id}/preview" if file_id else None
                    existing.gdrive_web_content_link = f"https://drive.google.com/uc?export=download&id={file_id}" if file_id else None
                    db.commit()

                cloud_items.append({
                    "id": file_id or name,
                    "filename": name,
                    "size_bytes": size_bytes,
                    "created_at": created_at.isoformat(),
                    "duration_sec": 1800,
                    "gdrive_file_id": file_id,
                    "stream_url": f"/api/camera/cctv/cloud-stream/{file_id or name}",
                    "download_url": f"/api/camera/cctv/cloud-download/{file_id or name}",
                    "preview_url": f"https://drive.google.com/file/d/{file_id}/preview" if file_id else None,
                    "is_cloud": True
                })

            # If rclone returned no files (e.g. laptop off in cloud environment), load from DB
            if not cloud_items:
                db_recs = db.query(CctvRecordingEntity).order_by(CctvRecordingEntity.created_at.desc()).limit(100).all()
                for rec in db_recs:
                    cloud_items.append({
                        "id": rec.gdrive_file_id or rec.filename,
                        "filename": rec.filename,
                        "size_bytes": rec.file_size_bytes,
                        "created_at": rec.created_at.isoformat() if rec.created_at else None,
                        "duration_sec": rec.duration_sec,
                        "gdrive_file_id": rec.gdrive_file_id,
                        "stream_url": f"/api/camera/cctv/cloud-stream/{rec.gdrive_file_id or rec.filename}",
                        "download_url": f"/api/camera/cctv/cloud-download/{rec.gdrive_file_id or rec.filename}",
                        "preview_url": rec.gdrive_preview_link,
                        "is_cloud": True
                    })
        except Exception as e:
            print(f"[GDRIVE-SERVICE] Error listing cloud recordings: {e}")
        finally:
            db.close()

        # Sort newest first
        cloud_items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return cloud_items

    def get_stream_command(self, identifier: str) -> Optional[List[str]]:
        """Returns rclone cat command to stream the file."""
        filename = identifier
        if not identifier.endswith(".mp4") and not identifier.endswith(".mkv"):
            # Identifier might be Google Drive ID, look up filename in DB
            db = SessionLocal()
            try:
                rec = db.query(CctvRecordingEntity).filter(CctvRecordingEntity.gdrive_file_id == identifier).first()
                if rec:
                    filename = rec.filename
            finally:
                db.close()

        return [rclone_manager.rclone_bin, "cat", f"gdrive:{self.folder_name}/{filename}"]

gdrive_service = GDriveService()
