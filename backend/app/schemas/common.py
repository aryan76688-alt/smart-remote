from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime

# --- System Schemas ---
class SystemStats(BaseModel):
    cpu_percent: float
    cpu_cores: int
    cpu_freq_mhz: Optional[float] = None
    cpu_per_core: List[float] = []
    memory_total_bytes: int
    memory_used_bytes: int
    memory_free_bytes: int
    memory_cached_bytes: int
    memory_percent: float
    swap_total_bytes: int
    swap_used_bytes: int
    swap_percent: float
    disk_total_bytes: int
    disk_used_bytes: int
    disk_free_bytes: int
    disk_percent: float
    net_bytes_sent: int
    net_bytes_recv: int
    net_rate_tx_kbps: float = 0.0
    net_rate_rx_kbps: float = 0.0
    uptime_seconds: float
    temperature_celsius: Optional[float] = None
    battery_percent: Optional[float] = None
    battery_plugged: Optional[bool] = None

class SystemInfo(BaseModel):
    hostname: str
    username: str
    os_name: str
    os_release: str
    kernel_version: str
    architecture: str
    tailscale_ip: str
    local_ip: str
    uptime_human: str
    server_time: str
    allowed_file_root: str
    tunnel_url: Optional[str] = None
    tunnel_status: Optional[str] = None

class QuickActionRequest(BaseModel):
    action: str = Field(..., description="sleep_display, wake_display, clear_cache, screenshot, mute_audio, lock_session")

class ProcessItem(BaseModel):
    pid: int
    name: str
    username: str
    cpu_percent: float
    memory_percent: float
    status: str
    create_time: str

class KillProcessRequest(BaseModel):
    pid: int
    signal: int = 15  # 15 = SIGTERM, 9 = SIGKILL

class PowerRequest(BaseModel):
    action: str = Field(..., description="lock, logout, suspend, reboot, shutdown")
    confirmed: bool = False

# --- File Schemas ---
class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    size_bytes: int
    modified_time: str
    permissions: str
    mime_type: Optional[str] = None
    extension: str

class FileListResponse(BaseModel):
    current_path: str
    parent_path: Optional[str]
    allowed_root: str
    items: List[FileItem]

class FileReadResponse(BaseModel):
    path: str
    name: str
    size_bytes: int
    content: Optional[str] = None
    is_text: bool
    mime_type: str

class FileWriteRequest(BaseModel):
    path: str
    content: str

class FileCreateRequest(BaseModel):
    path: str
    is_directory: bool = False

class FileRenameRequest(BaseModel):
    old_path: str
    new_path: str

class FileDeleteRequest(BaseModel):
    path: str
    confirmed: bool = False

class BulkDownloadRequest(BaseModel):
    paths: List[str]

class BulkDeleteRequest(BaseModel):
    paths: List[str]
    confirmed: bool = False

# --- Device Schemas ---
class DeviceRead(BaseModel):
    id: int
    name: str
    hostname: str
    ip_address: str
    tailscale_ip: str
    os_info: str
    kernel: str
    is_favorite: bool
    last_seen: datetime.datetime

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    is_favorite: Optional[bool] = None

# --- Assistant & Voice ---
class AssistantMessageRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class AssistantMessageResponse(BaseModel):
    role: str = "assistant"
    reply: str
    suggested_command: Optional[str] = None
    is_destructive: bool = False
    requires_confirmation: bool = False
    action_type: Optional[str] = None # navigate, execute, info
    navigation_route: Optional[str] = None

class CommandExecuteRequest(BaseModel):
    command: str
    confirmed: bool = False

class CommandExecuteResponse(BaseModel):
    command: str
    stdout: str
    stderr: str
    exit_code: int

class VoiceCommandRequest(BaseModel):
    transcript: str

class VoiceCommandResponse(BaseModel):
    transcript: str
    spoken_reply: str
    action_executed: Optional[str] = None
    requires_confirmation: bool = False
    pending_command: Optional[str] = None

# --- Remote & Input ---
class InputPointerEvent(BaseModel):
    type: str # move_rel, move_abs, click, mousedown, mouseup, doubleclick, scroll
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    button: Optional[int] = 1 # 1=left, 2=middle, 3=right
    scroll_delta_y: Optional[float] = 0.0
    scroll_delta_x: Optional[float] = 0.0

class InputKeyEvent(BaseModel):
    type: str # key, keydown, keyup, combination
    key: str
    modifiers: List[str] = [] # ctrl, alt, shift, super

class InputDPadEvent(BaseModel):
    direction: str # up, down, left, right, up-left, up-right, down-left, down-right
    step: int = 20
    precision: bool = False

class MediaCommandRequest(BaseModel):
    action: str # play_pause, next, prev, vol_up, vol_down, mute, seek_fwd, seek_rew, power, launch_ott
    ott_app: Optional[str] = None
    volume_level: Optional[int] = None

# --- Shortcuts & Activity ---
class ShortcutCreate(BaseModel):
    name: str
    icon: str = "Zap"
    command: Optional[str] = None
    sequence: Optional[str] = None
    confirmation_required: bool = False
    category: str = "custom"

class ActivityRead(BaseModel):
    id: int
    timestamp: datetime.datetime
    action_type: str
    description: str
    result: str
    device_id: str

class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    level: str
    is_read: bool
    created_at: datetime.datetime
