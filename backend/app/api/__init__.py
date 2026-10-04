from fastapi import APIRouter
from app.api.system import router as system_router
from app.api.files import router as files_router
from app.api.devices import router as devices_router
from app.api.history import router as history_router
from app.api.assistant import router as assistant_router
from app.api.voice import router as voice_router
from app.api.sync import router as sync_router
from app.api.remote import router as remote_router
from app.api.settings import router as settings_router
from app.api.auth import router as auth_router
from app.api.tunnel import router as tunnel_router
from app.api.camera import router as camera_router
from app.api.videocall import router as videocall_router
from app.api.productivity import router as productivity_router
from app.api.n8n import router as n8n_router

api_router = APIRouter(prefix="/api")
api_router.include_router(system_router)
api_router.include_router(files_router)
api_router.include_router(devices_router)
api_router.include_router(history_router)
api_router.include_router(assistant_router)
api_router.include_router(voice_router)
api_router.include_router(sync_router)
api_router.include_router(remote_router)
api_router.include_router(settings_router)
api_router.include_router(auth_router)
api_router.include_router(tunnel_router)
api_router.include_router(camera_router)
api_router.include_router(videocall_router)
api_router.include_router(productivity_router)
api_router.include_router(n8n_router)

