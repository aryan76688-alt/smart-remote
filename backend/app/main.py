import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .core.config import settings
from .core.tunnel import tunnel_manager
from .core.recorder import cctv_recorder
from .api.system import router as system_router
from .api.remote import router as remote_router
from .api.cctv import router as cctv_router
from .api.maps import router as maps_router
from .api.ai import router as ai_router
from .api.files import router as files_router
from .api.companion import router as companion_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Launch persistent Cloudflare Tunnel & Worker Edge Hub sync on boot
    tunnel_manager.start()
    # 2. Auto-start 24/7 Always-On 30-Minute Rolling CCTV Recording on boot
    cctv_recorder.start_recording(source="laptop", duration_minutes=30, continuous_loop=True)
    yield
    # Gracefully flush and save active MP4 clip and stop tunnel on shutdown
    cctv_recorder.stop_recording(disable_always_on=False)
    tunnel_manager.stop()

app = FastAPI(
    title="pearOS Nexus Smart Remote",
    description="Next-Generation pearOS Remote Command Deck & 24/7 Always-On CCTV Service",
    version="4.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(remote_router)
app.include_router(cctv_router)
app.include_router(maps_router)
app.include_router(ai_router)
app.include_router(files_router)
app.include_router(companion_router)

static_dir = Path(__file__).resolve().parent / "static"
if not static_dir.exists():
    static_dir.mkdir(parents=True, exist_ok=True)

if (static_dir / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "pearOS Nexus 4.1",
        "tunnel": tunnel_manager.get_status(),
        "recorder": cctv_recorder.get_status()
    }

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    file_path = static_dir / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "pearOS Nexus 4.1 API Running. Build frontend to view UI."}
