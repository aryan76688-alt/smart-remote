import os
import sys
import site
user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.insert(0, user_site)

for extra_path in [
    "/home/aryan/.gemini/antigravity/scratch/gesture-detetction/.venv/lib/python3.14/site-packages",
    "/home/aryan/.gemini/antigravity/scratch/gesture-detetction/.venv/lib/python3.13/site-packages",
    "/home/aryan/Desktop/NEW/.freebuff/smart-remote/backend/venv/lib/python3.14/site-packages",
]:
    if os.path.isdir(extra_path) and extra_path not in sys.path:
        sys.path.insert(0, extra_path)
import json
import time
import asyncio
import subprocess
import base64
from typing import Optional, Tuple
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.database import init_db
from app.api import api_router
from app.terminal.pty_manager import pty_manager
from app.input.controller import input_controller
from app.screen.streamer import screen_streamer
from app.system.monitor import system_monitor
from app.services.tunnel_manager import tunnel_manager
from app.camera.camera_manager import camera_manager

# Initialize DB
init_db()

app = FastAPI(
    title="SMART REMOTE",
    description="Kali Linux Mobile & Web Remote Controller - Global Access Anywhere",
    version="2.0.0"
)

# Compression Middleware (bandwidth saving on slow/mobile internet)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)

@app.get("/current_server.json")
def get_current_server_json():
    """Provides active server routing information for client apps and APK auto-switching."""
    import time
    from app.system.monitor import system_monitor
    info = system_monitor.get_info()
    tunnel_status = tunnel_manager.get_status()
    public_url = tunnel_status.get("public_url") or ""
    return {
        "cloudflare_url": public_url,
        "tailscale_url": f"http://{settings.TAILSCALE_IP}:{settings.PORT}",
        "local_wifi_url": f"http://{info.local_ip}:{settings.PORT}",
        "tunnel_status": tunnel_status.get("status", "stopped"),
        "active_provider": tunnel_status.get("active_provider", "none"),
        "timestamp": int(time.time())
    }

@app.on_event("startup")
def on_startup():
    # Auto-start global access tunnel in background so URL is immediately ready
    try:
        tunnel_manager.start(provider="auto")
    except Exception as e:
        print(f"[TUNNEL] Startup warning: {e}")

    # Auto-start 24/7 CCTV Always Recording if enabled
    try:
        if camera_manager.always_record:
            print("[CCTV] Auto-starting 24/7 High-Definition CCTV recording...")
            camera_manager.start_cctv(
                chunk_duration_sec=camera_manager.cctv_chunk_duration,
                auto_upload_gdrive=camera_manager.cctv_auto_upload_gdrive
            )
    except Exception as e:
        print(f"[CCTV] Startup autostart warning: {e}")



@app.on_event("shutdown")
def on_shutdown():

    try:
        tunnel_manager.stop()
    except Exception:
        pass

# --- WebSocket: Terminal ---
@app.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket, session_id: str = "default", rows: int = 24, cols: int = 80):
    await websocket.accept()
    session = pty_manager.get_or_create(session_id, rows=rows, cols=cols)

    async def read_from_pty():
        try:
            while session.active:
                chunk = session.read(4096)
                if chunk:
                    await websocket.send_bytes(chunk)
                else:
                    await asyncio.sleep(0.015)
        except Exception:
            pass

    read_task = asyncio.create_task(read_from_pty())

    try:
        while True:
            message = await websocket.receive()
            if "text" in message and message["text"]:
                txt = message["text"]
                # Check if JSON control message
                if txt.startswith("{") and txt.endswith("}"):
                    try:
                        data = json.loads(txt)
                        if data.get("type") == "resize":
                            session.resize(int(data.get("rows", 24)), int(data.get("cols", 80)))
                            continue
                        elif data.get("type") == "input":
                            session.write(data.get("data", ""))
                            continue
                    except json.JSONDecodeError:
                        pass
                session.write(txt)
            elif "bytes" in message and message["bytes"]:
                session.write(message["bytes"])
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        read_task.cancel()

# --- WebSocket: Input (Touchpad / Mouse / D-Pad / Keyboard) ---
@app.websocket("/ws/input")
async def ws_input(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            evt_type = data.get("type")
            if evt_type == "move_rel":
                input_controller.move_relative(data.get("x", 0.0), data.get("y", 0.0))
            elif evt_type == "move_abs":
                input_controller.move_absolute(data.get("x", 0.0), data.get("y", 0.0))
            elif evt_type == "click":
                input_controller.click(data.get("button", 1))
            elif evt_type == "doubleclick":
                input_controller.double_click(data.get("button", 1))
            elif evt_type == "mousedown":
                input_controller.mouse_down(data.get("button", 1))
            elif evt_type == "mouseup":
                input_controller.mouse_up(data.get("button", 1))
            elif evt_type == "scroll":
                input_controller.scroll(data.get("delta_y", 0.0), data.get("delta_x", 0.0))
            elif evt_type == "dpad":
                input_controller.dpad_move(data.get("direction", "up"), data.get("step", 20), data.get("precision", False))
            elif evt_type == "key":
                input_controller.key_press(data.get("key", ""), data.get("modifiers"))
            elif evt_type == "keydown":
                input_controller.key_down(data.get("key", ""))
            elif evt_type == "keyup":
                input_controller.key_up(data.get("key", ""))
            elif evt_type == "gamepad_button":
                key = data.get("key", "")
                is_down = data.get("down", True)
                if key:
                    if is_down:
                        input_controller.key_down(key)
                    else:
                        input_controller.key_up(key)
            elif evt_type == "type":
                input_controller.type_text(data.get("text", ""))
            elif evt_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "client_ts": data.get("client_ts"),
                    "server_ts": time.time() * 1000
                })
    except (WebSocketDisconnect, Exception):
        pass

def get_host_mouse_cursor() -> Optional[Tuple[int, int]]:
    # 1. Ultra-fast in-memory XQueryPointer via input_controller (0.5ms vs 15ms subprocess)
    coords = input_controller.get_mouse_position()
    if coords is not None:
        return coords

    # 2. Fallback to xdotool if X11 pointer query was uninitialized
    env = os.environ.copy()
    if "DISPLAY" not in env or not env["DISPLAY"]:
        env["DISPLAY"] = ":0"
    try:
        res = subprocess.run(
            ["xdotool", "getmouselocation", "--shell"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=0.15
        )
        if res.returncode == 0:
            x_val, y_val = None, None
            for line in res.stdout.splitlines():
                if line.startswith("X="):
                    x_val = int(line[2:])
                elif line.startswith("Y="):
                    y_val = int(line[2:])
            if x_val is not None and y_val is not None:
                return (x_val, y_val)
    except Exception:
        pass
    return None

# --- WebSocket: Real-time Screen Streaming ---
@app.websocket("/ws/screen")
async def ws_screen(websocket: WebSocket):
    await websocket.accept()
    
    # Send resolution and initial setup
    w, h = screen_streamer.get_resolution()
    init_cursor = get_host_mouse_cursor() or (w // 2, h // 2)
    
    # Low-internet default: scale=0.5, quality=35, fps=20 (only ~15-20KB/frame, ~300KB/s)
    quality = 35
    target_fps = 20
    scale: Optional[float] = 0.5
    is_paused = False
    last_sent_cursor: Optional[Tuple[int, int]] = None
    frame_counter = 0

    await websocket.send_json({
        "type": "init",
        "width": w,
        "height": h,
        "fps": target_fps,
        "quality": quality,
        "scale": scale,
        "cursor": {"x": init_cursor[0], "y": init_cursor[1]}
    })

    async def client_listener():
        nonlocal quality, target_fps, scale, is_paused
        try:
            while True:
                msg = await websocket.receive_json()
                mtype = msg.get("type")
                if mtype == "pause":
                    is_paused = True
                elif mtype == "resume":
                    is_paused = False
                elif mtype == "fps":
                    target_fps = max(5, min(60, int(msg.get("val", 20))))
                elif mtype == "quality":
                    quality = max(10, min(95, int(msg.get("val", 35))))
                elif mtype == "scale":
                    try:
                        s_val = float(msg.get("val", 0.5))
                        scale = max(0.2, min(1.0, s_val))
                    except Exception:
                        pass
                elif mtype == "preset":
                    preset = msg.get("preset", "low")
                    if preset == "low":
                        scale = 0.45
                        quality = 28
                        target_fps = 15
                    elif preset == "balanced":
                        scale = 0.65
                        quality = 45
                        target_fps = 22
                    elif preset == "high":
                        scale = 1.0
                        quality = 70
                        target_fps = 30
                    await websocket.send_json({
                        "type": "preset_applied",
                        "preset": preset,
                        "scale": scale,
                        "quality": quality,
                        "fps": target_fps
                    })
                elif mtype == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "client_ts": msg.get("client_ts"),
                        "server_ts": time.time() * 1000
                    })
        except Exception:
            pass

    listen_task = asyncio.create_task(client_listener())

    try:
        while True:
            if is_paused:
                await asyncio.sleep(0.2)
                continue

            start_t = time.time()
            frame_bytes = screen_streamer.capture_frame_jpeg(quality=quality, scale=scale)
            if frame_bytes:
                await websocket.send_bytes(frame_bytes)

            # Send host mouse cursor position every 2 frames or when position changes
            frame_counter += 1
            if frame_counter % 2 == 0:
                coords = get_host_mouse_cursor()
                if coords and coords != last_sent_cursor:
                    last_sent_cursor = coords
                    await websocket.send_json({"type": "cursor", "x": coords[0], "y": coords[1]})

            elapsed = time.time() - start_t
            desired_interval = 1.0 / target_fps
            sleep_time = max(0.005, desired_interval - elapsed)
            await asyncio.sleep(sleep_time)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        listen_task.cancel()

# --- WebSocket: Laptop Camera Streaming ---
@app.websocket("/ws/camera/laptop")
async def ws_camera_laptop(websocket: WebSocket):
    await websocket.accept()
    camera_manager.start_laptop_camera()
    try:
        while True:
            jpeg = camera_manager.read_laptop_jpeg(quality=55)
            if jpeg:
                await websocket.send_bytes(jpeg)
            await asyncio.sleep(0.04)  # ~25 FPS
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        camera_manager.stop_laptop_camera()

# --- WebSocket: Phone Camera to Kali Laptop Display ---
@app.websocket("/ws/camera/phone")
async def ws_camera_phone(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg and msg["bytes"]:
                camera_manager.receive_phone_frame(msg["bytes"])
            elif "text" in msg and msg["text"]:
                txt = msg["text"]
                if txt.startswith("{"):
                    try:
                        data = json.loads(txt)
                        if data.get("type") == "stop":
                            camera_manager.stop_phone_stream()
                            break
                        elif data.get("image"):
                            b64_str = data["image"]
                            if "," in b64_str:
                                b64_str = b64_str.split(",", 1)[1]
                            camera_manager.receive_phone_frame(base64.b64decode(b64_str))
                    except Exception:
                        pass
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        camera_manager.stop_phone_stream()

# --- WebSocket: System Metrics Telemetry ---
@app.websocket("/ws/system")
async def ws_system(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            stats = system_monitor.get_stats()
            await websocket.send_text(stats.model_dump_json())
            await asyncio.sleep(1.5)
    except (WebSocketDisconnect, Exception):
        pass

# Frontend static serving with automatic legacy hash fallback & anti-cache headers
dist_candidates = [
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent / "dist",
    Path("/app/frontend/dist"),
    Path("/app/dist"),
]
dist_dir = next((p for p in dist_candidates if p.exists() and (p / "index.html").exists()), dist_candidates[0])
if dist_dir.exists():
    @app.api_route("/assets/{file_path:path}", methods=["GET", "HEAD"])
    async def serve_asset(file_path: str):
        target_file = dist_dir / "assets" / file_path
        if target_file.is_file():
            # Immutable cache for versioned assets
            return FileResponse(target_file)

        # Smart fallback for old cached index.html files requesting older JS or CSS bundle hashes
        if file_path.endswith(".js"):
            js_files = list((dist_dir / "assets").glob("*.js"))
            if js_files:
                target_js = next((f for f in js_files if f.name == "index.js"), sorted(js_files, key=os.path.getmtime, reverse=True)[0])
                return FileResponse(
                    target_js,
                    media_type="application/javascript",
                    headers={"Cache-Control": "no-cache"}
                )
        elif file_path.endswith(".css"):
            css_files = list((dist_dir / "assets").glob("*.css"))
            if css_files:
                target_css = next((f for f in css_files if f.name == "index.css"), sorted(css_files, key=os.path.getmtime, reverse=True)[0])
                return FileResponse(
                    target_css,
                    media_type="text/css",
                    headers={"Cache-Control": "no-cache"}
                )
        elif file_path.endswith(".map"):
            return JSONResponse(status_code=204, content={})

        return JSONResponse(status_code=404, content={"detail": f"Asset {file_path} not found"})

    @app.api_route("/sw.js", methods=["GET", "HEAD"])
    async def serve_sw():
        sw_file = dist_dir / "sw.js"
        if not sw_file.is_file():
            sw_file = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "sw.js"
        return FileResponse(
            sw_file,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    @app.api_route("/SmartRemote.apk", methods=["GET", "HEAD"])
    @app.api_route("/api/download/app.apk", methods=["GET", "HEAD"])
    async def serve_apk():
        candidates = [
            dist_dir / "SmartRemote.apk",
            Path(__file__).resolve().parent.parent / "static" / "SmartRemote.apk",
            Path("/home/aryan/.gemini/antigravity/scratch/smart-remote/android-app/app/build/outputs/apk/debug/app-debug.apk")
        ]
        for c in candidates:
            if c.is_file():
                return FileResponse(
                    c,
                    media_type="application/vnd.android.package-archive",
                    filename="SmartRemote.apk",
                    headers={"Content-Disposition": 'attachment; filename="SmartRemote.apk"'}
                )
        return JSONResponse(status_code=404, content={"detail": "SmartRemote APK file not found"})

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(request: Request, full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": f"API route /{full_path} not found"})

        file_candidate = dist_dir / full_path
        if file_candidate.is_file() and full_path:
            if full_path in ("sw.js", "manifest.json"):
                return FileResponse(
                    file_candidate,
                    headers={
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    }
                )
            return FileResponse(file_candidate)

        # Always serve index.html with NO CACHE headers so clients never get stuck with stale HTML
        return FileResponse(
            dist_dir / "index.html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
else:
    @app.get("/")
    def index():
        return {
            "app": "SMART REMOTE",
            "status": "online",
            "tailscale_ip": settings.TAILSCALE_IP,
            "port": settings.PORT,
            "message": "Frontend build not yet generated. Run 'scripts/install.sh' to build React frontend."
        }

