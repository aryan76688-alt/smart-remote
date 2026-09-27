import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from app.database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), default="Kali Machine")
    hostname = Column(String(128), default="kali")
    ip_address = Column(String(64), default="127.0.0.1")
    tailscale_ip = Column(String(64), default="100.69.194.11")
    os_info = Column(String(128), default="Kali Linux Rolling")
    kernel = Column(String(128), default="Linux")
    is_favorite = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(128), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(64), default="general")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class CommandHistory(Base):
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    command = Column(Text, nullable=False)
    output = Column(Text, nullable=True)
    exit_code = Column(Integer, default=0)
    source = Column(String(64), default="terminal")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AssistantHistory(Base):
    __tablename__ = "assistant_history"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(32), nullable=False)
    content = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class VoiceHistory(Base):
    __tablename__ = "voice_history"

    id = Column(Integer, primary_key=True, index=True)
    transcript = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    intent = Column(String(64), default="general")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class VoiceMemory(Base):
    __tablename__ = "voice_memory"

    id = Column(Integer, primary_key=True, index=True)
    entity_key = Column(String(128), index=True, nullable=False)
    entity_value = Column(Text, nullable=False)
    context_category = Column(String(64), default="general")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class FaceAuthRecord(Base):
    __tablename__ = "face_auth_records"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    face_descriptor = Column(Text, nullable=False) # JSON array of normalized biometric landmarks/hash
    registered_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Shortcut(Base):
    __tablename__ = "shortcuts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    icon = Column(String(64), default="Zap")
    sequence = Column(Text, nullable=True)
    command = Column(Text, nullable=True)
    confirmation_required = Column(Boolean, default=False)
    category = Column(String(64), default="custom")

class RemoteProfile(Base):
    __tablename__ = "remote_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    layout_config = Column(Text, default="{}")
    is_default = Column(Boolean, default=False)

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action_type = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    result = Column(String(32), default="success")
    device_id = Column(String(64), default="local")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(128), nullable=False)
    message = Column(Text, nullable=False)
    level = Column(String(32), default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SyncMetadata(Base):
    __tablename__ = "sync_metadata"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, nullable=False)
    last_synced_at = Column(DateTime, default=datetime.datetime.utcnow)
    etag = Column(String(128), nullable=True)
    payload = Column(Text, nullable=True)

class CctvRecordingEntity(Base):
    __tablename__ = "cctv_recordings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(256), unique=True, index=True, nullable=False)
    duration_sec = Column(Integer, default=1800)
    file_size_bytes = Column(Integer, default=0)
    resolution = Column(String(64), default="1280x720")
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    local_path = Column(Text, nullable=True)
    is_synced_gdrive = Column(Boolean, default=False, index=True)
    gdrive_file_id = Column(String(256), nullable=True, index=True)
    gdrive_web_content_link = Column(Text, nullable=True)
    gdrive_preview_link = Column(Text, nullable=True)
    thumbnail_b64 = Column(Text, nullable=True)

class VideoCallSessionEntity(Base):
    __tablename__ = "video_call_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    caller_role = Column(String(32), default="mobile")  # "mobile" or "laptop"
    receiver_role = Column(String(32), default="laptop")
    status = Column(String(32), default="ringing")      # "ringing", "connected", "ended", "declined", "missed"
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_sec = Column(Integer, default=0)

class DevicePresenceEntity(Base):
    __tablename__ = "device_presence"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(64), unique=True, index=True, nullable=False)
    device_name = Column(String(128), default="Kali Linux Workstation")
    status = Column(String(32), default="online")       # "online", "offline"
    last_heartbeat = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    ip_address = Column(String(64), nullable=True)
    tailscale_ip = Column(String(64), nullable=True)

