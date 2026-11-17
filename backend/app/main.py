import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .core.config import settings
from .api.system import router as system_router
from .api.remote import router as remote_router
from .api.cctv import router as cctv_router
from .api.maps import router as maps_router
from .api.ai import router as ai_router
from .api.files import router as files_router

app = FastAPI(
    title="pearOS Nexus Smart Remote",
    description="Next-Generation pearOS Remote Command Deck & Companion Service",
    version="3.0.0"
)

# Enable CORS for local & Cloudflare tunnel access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Modular Routers
app.include_router(system_router)
app.include_router(remote_router)
app.include_router(cctv_router)
app.include_router(maps_router)
app.include_router(ai_router)
app.include_router(files_router)

# Mount Static UI
static_dir = Path(__file__).resolve().parent / "static"
if not static_dir.exists():
    static_dir.mkdir(parents=True, exist_ok=True)

# Static assets (js, css, icons)
if (static_dir / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "pearOS Nexus 3.0",
        "tunnel_active": True
    }

# Fallback route for SPA
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    # If file exists in static_dir, serve it
    file_path = static_dir / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    # Otherwise fallback to index.html
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "pearOS Nexus 3.0 API Running. Build frontend to view UI."}
