import os
import shutil
import stat
import mimetypes
import datetime
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import HTTPException
from app.config import settings
from app.schemas.common import FileItem, FileListResponse, FileReadResponse

class FileManager:
    def __init__(self):
        self.root = settings.canonical_allowed_root

    def _resolve_safe_path(self, target_path: str) -> Path:
        if not target_path or target_path.strip() in ("", "/"):
            return self.root
        
        # If relative, resolve relative to root
        p = Path(target_path)
        if not p.is_absolute():
            resolved = (self.root / p).resolve()
        else:
            resolved = p.resolve()

        # Strict path traversal check
        try:
            if not resolved.is_relative_to(self.root):
                raise HTTPException(status_code=403, detail=f"Access denied: Path '{target_path}' is outside permitted directory '{self.root}'")
        except AttributeError:
            # Python < 3.9 fallback
            if os.path.commonpath([str(self.root), str(resolved)]) != str(self.root):
                raise HTTPException(status_code=403, detail=f"Access denied: Path '{target_path}' is outside permitted directory '{self.root}'")

        return resolved

    def _format_permissions(self, mode: int) -> str:
        return stat.filemode(mode)

    def list_dir(self, dir_path: str = "") -> FileListResponse:
        target = self._resolve_safe_path(dir_path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        if not target.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        items: List[FileItem] = []
        try:
            with os.scandir(target) as entries:
                for entry in entries:
                    try:
                        st = entry.stat(follow_symlinks=False)
                        is_directory = entry.is_dir(follow_symlinks=False)
                        mime, _ = mimetypes.guess_type(entry.path)
                        ext = Path(entry.name).suffix.lower()
                        mtime_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                        
                        items.append(FileItem(
                            name=entry.name,
                            path=str(Path(entry.path).resolve()),
                            is_dir=is_directory,
                            size_bytes=0 if is_directory else st.st_size,
                            modified_time=mtime_str,
                            permissions=self._format_permissions(st.st_mode),
                            mime_type=mime or ("folder" if is_directory else "application/octet-stream"),
                            extension=ext,
                        ))
                    except (PermissionError, FileNotFoundError):
                        pass
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied reading directory")

        # Sort: directories first, then alphabetical
        items.sort(key=lambda x: (not x.is_dir, x.name.lower()))

        parent_path = str(target.parent) if target != self.root and target.parent.is_relative_to(self.root) else None

        return FileListResponse(
            current_path=str(target),
            parent_path=parent_path,
            allowed_root=str(self.root),
            items=items
        )

    def read_file(self, file_path: str) -> FileReadResponse:
        target = self._resolve_safe_path(file_path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="File not found")
        if target.is_dir():
            raise HTTPException(status_code=400, detail="Target is a directory")

        size = target.stat().st_size
        mime, _ = mimetypes.guess_type(str(target))
        mime = mime or "application/octet-stream"

        # Check if text
        is_text = mime.startswith("text/") or mime in (
            "application/json", "application/javascript", "application/xml",
            "application/x-sh", "application/x-python", "application/x-yaml",
            "application/toml"
        ) or target.suffix in (
            ".txt", ".md", ".py", ".sh", ".json", ".js", ".ts", ".tsx",
            ".jsx", ".html", ".css", ".yaml", ".yml", ".conf", ".cfg",
            ".ini", ".env", ".log", ".service", ".rules"
        )

        content = None
        if is_text:
            if size > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Text file exceeds 5MB limit for inline preview")
            try:
                content = target.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

        return FileReadResponse(
            path=str(target),
            name=target.name,
            size_bytes=size,
            content=content,
            is_text=is_text,
            mime_type=mime,
        )

    def write_file(self, file_path: str, content: str) -> bool:
        target = self._resolve_safe_path(file_path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    def create_item(self, path: str, is_directory: bool = False) -> str:
        target = self._resolve_safe_path(path)
        if target.exists():
            raise HTTPException(status_code=400, detail="Target already exists")
        try:
            if is_directory:
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.touch()
            return str(target)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create: {e}")

    def rename_item(self, old_path: str, new_path: str) -> str:
        old_target = self._resolve_safe_path(old_path)
        new_target = self._resolve_safe_path(new_path)
        if not old_target.exists():
            raise HTTPException(status_code=404, detail="Source item not found")
        if new_target.exists():
            raise HTTPException(status_code=400, detail="Destination item already exists")
        try:
            shutil.move(str(old_target), str(new_target))
            return str(new_target)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to rename/move: {e}")

    def delete_item(self, path: str, confirmed: bool = False) -> bool:
        target = self._resolve_safe_path(path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="Item not found")
        if target == self.root:
            raise HTTPException(status_code=403, detail="Cannot delete root directory")
        if not confirmed:
            raise HTTPException(status_code=400, detail="Deletion requires explicit confirmation")
        try:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete: {e}")

file_manager = FileManager()
