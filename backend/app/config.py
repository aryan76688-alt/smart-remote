import os
from pathlib import Path

class Settings:
    HOST: str = os.getenv("SMART_REMOTE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", os.getenv("SMART_REMOTE_PORT", "7070")))
    TAILSCALE_IP: str = os.getenv("SMART_REMOTE_TAILSCALE_IP", "100.69.194.11")
    ALLOWED_FILE_ROOT: str = os.getenv("ALLOWED_FILE_ROOT", os.path.expanduser("~"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smart_remote.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-remote-kali-secret-key-production")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    SCREEN_STREAM_FPS: int = int(os.getenv("SCREEN_STREAM_FPS", "25"))
    SCREEN_STREAM_QUALITY: int = int(os.getenv("SCREEN_STREAM_QUALITY", "50"))
    
    @property
    def canonical_allowed_root(self) -> Path:
        p = Path(self.ALLOWED_FILE_ROOT).resolve()
        return p if p.exists() else Path.home()

settings = Settings()
