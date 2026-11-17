import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent

class Settings(BaseModel):
    HOST: str = os.getenv("SMART_REMOTE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("SMART_REMOTE_PORT", "7070"))
    TAILSCALE_IP: str = os.getenv("SMART_REMOTE_TAILSCALE_IP", "100.69.194.11")
    ALLOWED_FILE_ROOT: str = os.getenv("ALLOWED_FILE_ROOT", "/home/aryan")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-remote-super-secret-key-2026")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "da2ddb95fbea2434c8ac0a1a65b7f721")
    CLOUDFLARE_API_TOKEN: str = os.getenv("CLOUDFLARE_API_TOKEN", "")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # Directory paths
    BASE_DIR: Path = BASE_DIR
    STATIC_DIR: Path = BASE_DIR / "static"
    MODELS_DIR: Path = ROOT_DIR / "models"
    BIN_DIR: Path = ROOT_DIR / "bin"

settings = Settings()
