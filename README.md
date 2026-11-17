# SMART REMOTE — AI AGENT OS
### Kali Linux Mobile & Web Remote Controller & Autonomous Multi-Agent Command Center

SMART REMOTE is a production-grade, real-time remote-control and autonomous AI Agent platform designed specifically for Kali Linux workstations over a secure private Tailscale network (`http://100.69.194.11:7070`) and global Cloudflare Edge Hub (`https://smart-remote.aryan76688.workers.dev`).

---

## 🌟 Core Architecture & Highlight Features

### 🧠 1. AI Agent OS & Multi-Agent Fleet (Primary Interface)
Instead of static remote buttons, Smart Remote features a full **Autonomous Multi-Agent Operating System**:
- **Nova Prime (Master Orchestrator)**: Decomposes natural language goals, plans execution graphs, delegates to specialized subagents, and synthesizes rich human-like answers.
- **Sentinel-OS (SysAdmin & Hardware)**: Monitors per-core CPU, RAM, disk usage, battery, master audio/volume, power states (Lock, Sleep, Reboot), and process health.
- **ShadowNet (CyberOps & Security)**: Runs Nmap network scans on local subnets (`192.168.31.0/24`), inspects open listening ports (`ss -tuln`), audits firewall rules, and alerts on anomalies.
- **Nexus-Files (Data & Storage)**: Manages files across Kali Linux and remote Oppo phone storage, searches documents, reads text content, and packages ZIP downloads.
- **Argus-Vision (Vision & Surveillance)**: Captures live webcam snapshots, desktop screenshots, and monitors CCTV recording status.
- **Synapse-Flow (Automations & Workflows)**: Triggers n8n workflows, manages automated background routines, and broadcasts operational notifications.
- **Oppo-Link (Mobile Fleet P2P)**: Interfaces with connected Oppo phones, tracks real-time GPS coordinates, triggers 110dB loud emergency siren alarms, and toggles flashlight strobes.

### 🌐 2. Multi-Provider LLM Gateway ("Use All")
Switch dynamically between all major LLM engines on the fly via the top bar selector or in-app Settings modal:
- ⚡ **Google Gemini**: Native `gemini-2.5-flash`, `gemini-1.5-pro`
- 🌐 **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `o3-mini`
- 🧠 **Anthropic Claude**: `claude-3-5-sonnet`, `claude-3-haiku` (supports FreeLLMAPI and official API)
- 💻 **Local Ollama**: `llama3.3`, `qwen2.5`, `deepseek-r1` (runs offline on Kali Linux)

### 🔌 3. Extensible Plugin & Tool Registry
Subagents execute system operations autonomously through registered, typed plugins:
`system_stats`, `system_volume`, `system_power`, `terminal_exec`, `network_scan`, `network_connections`, `files_list`, `files_read`, `files_search`, `camera_snapshot`, `screen_snapshot`, `oppo_phone_action`.
- Plugins can be toggled on/off in the **Plugin Store Modal**.
- Full execution trace with tool inputs, raw outputs, and execution duration.
- Rich visual artifacts rendered inline: live telemetry gauges, image previews, file tables, and active siren alerts.

### 📊 4. Real-Time File Transfer Processing Bar
- **Precise Progress Tracking**: 0% to 100% real-time progress for single file downloads, folder ZIP exports, and multi-file uploads.
- **Live Metrics**: Smoothed upload/download speeds (`KB/s`, `MB/s`) and estimated time remaining (`~Xs left`).
- **Batch Drawer**: Expandable list showing the status and size of each file during multi-file uploads.
- **Full Cancellation Support**: Clean abort of in-progress transfers at any moment.
- **Drag-and-Drop**: Drop files anywhere on the File Manager to initiate background upload with live progress.

### 📱 5. Mobile Fleet Daemon & Laptop-Off Edge Control
- **`SmartRemoteDaemonService`**: 24/7 Android foreground daemon with `WakeLock`, `WifiLock`, Doze battery exemption, and self-resurrection on task removal.
- **Cloudflare Edge Hub (KV)**: When the laptop is powered off, the phone continues communicating with `smart-remote.aryan76688.workers.dev` via Cloudflare KV, allowing remote siren, torch, and GPS tracking even without the laptop online.

### 🎮 6. Full Remote Hardware Deck (Manual Override)
- **Real Linux PTY Terminal**: Multi-session bash terminals with ANSI colors, interactive command programs, and mobile quick-keys.
- **Real Screen Mirroring**: Low-latency live X11 display streaming, pinch-to-zoom, landscape toggle, FPS/quality controls, and direct touch-to-screen click mapping.
- **Dedicated Touchpad & Mouse**: One-finger movement, tap-to-click, two-finger right-click, two-finger scroll, tap-and-hold drag, haptic vibration, and sensitivity controls.
- **Directional D-Pad**: 4-direction + diagonals circular D-pad with continuous press-and-hold stepped movement, acceleration, and precision mode.
- **Virtual Keyboard**: Compact, Full, and Terminal keyboards with Esc, F1-F12, modifiers (Ctrl, Alt, Shift, Super), and key combination shortcuts (Ctrl+C, Ctrl+V, Alt+Tab, Ctrl+Alt+T).
- **Smart Media & OTT Remote**: Window activation using `xdotool` for YouTube, Netflix, Prime Video, Spotify, Disney+, Twitch, Apple TV, Hulu, Crunchyroll, Plex, and SoundCloud.
- **Face Biometric Authentication**: Biometric webcam scanner with 128-point descriptor matching and fallback master credentials (`Aryan007` / `Aryan@2007`).
- **Google Drive Cloud Sync**: Background backup of settings, shortcuts, and CCTV recordings.

---

## 1. System Requirements

- **Operating System**: Kali Linux 2023.x / 2024.x / Rolling (or any Debian-based distribution with X11)
- **Python**: Python 3.10+ (tested with Python 3.14)
- **Node.js**: Node.js 18+ (tested with v24.19) and npm 9+
- **Network**: Private Tailscale VPN mesh network
- **Linux Packages**: `xdotool`, `imagemagick` (`import`), `x11-xserver-utils` (`xrandr`)

---

## 2. Kali Linux Setup

Install the required X11 display and input utilities:

```bash
sudo apt update
sudo apt install -y xdotool imagemagick x11-xserver-utils python3-pip python3-venv
```

Verify that the utilities are installed:
```bash
which xdotool import xrandr
```

---

## 3. Python Installation

Smart Remote relies on Python 3 and standard scientific/system monitoring libraries:

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version
```

---

## 4. Node.js Installation

If Node.js is not already installed on your Kali workstation:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

---

## 5. Tailscale Setup

Tailscale creates a secure, encrypted peer-to-peer network between your phone, laptop, and Kali Linux workstation without opening router ports:

1. Install Tailscale on Kali Linux:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
2. Retrieve your Kali workstation's Tailscale IPv4 address:
   ```bash
   tailscale ip -4
   ```
   *(Example: `100.69.194.11`)*
3. Install the Tailscale app on your iPhone or Android device and log into the same account.

---

## 6. Project Installation

Clone or extract Smart Remote into your desired directory:

```bash
cd smart-remote
chmod +x scripts/*.sh
./scripts/install.sh
```

The installer will:
1. Verify required system binaries.
2. Initialize `.env` configuration.
3. Install backend Python dependencies.
4. Install frontend npm dependencies and compile the production Vite PWA bundle.
5. Run automated validation tests.

---

## 7. Environment Configuration

The configuration file is located at `.env`. You can adjust settings as needed:

```ini
# Server Network Binding
SMART_REMOTE_HOST=0.0.0.0
SMART_REMOTE_PORT=7070
SMART_REMOTE_TAILSCALE_IP=100.69.194.11

# Security & Filesystem Root (Restricted Directory)
ALLOWED_FILE_ROOT=/home/aryan
SECRET_KEY=smart-remote-kali-secret-key-production
ENVIRONMENT=production

# Screen Streaming Performance
SCREEN_STREAM_FPS=25
SCREEN_STREAM_QUALITY=50
```

---

## 8. Starting the Server

Start Smart Remote in the background using the provided start script:

```bash
./scripts/start.sh
```

Output:
```
============================================================
           SMART REMOTE - Kali Linux Controller             
============================================================
Starting Smart Remote server on 0.0.0.0:7070...
✓ Smart Remote is active and listening!

ACCESS URLS:
  • Local Machine:    http://localhost:7070
  • Tailscale Remote: http://100.69.194.11:7070

[SECURITY NOTICE]
  Port 7070 is intended for private access over Tailscale.
  Never expose this port directly to the public Internet.
============================================================
```

---

## 9. Stopping the Server

Stop the running Smart Remote daemon:

```bash
./scripts/stop.sh
```

---

## 10. Mobile Connection (Android & iOS)

1. Connect your mobile phone to your Tailscale network (turn on VPN in Tailscale app).
2. Open Chrome (Android) or Safari (iOS).
3. Navigate to:
   ```
   http://100.69.194.11:7070
   ```
4. On first open, select **📱 MOBILE** mode for thumb-friendly one-handed controls.

---

## 11. Desktop Connection

Open any modern browser on another workstation or laptop on the Tailscale network:
```
http://100.69.194.11:7070
```
Select **💻 DESKTOP** mode to enable the collapsible sidebar, multi-column dashboard, and workstation hotkeys.

---

## 12. PWA (Progressive Web App) Installation

Smart Remote includes a standalone PWA manifest and service worker:

- **iOS Safari**: Tap the **Share** button in Safari -> Select **"Add to Home Screen"**.
- **Android Chrome**: Tap the three-dot menu -> Select **"Install app"** or **"Add to Home screen"**.

Once installed, Smart Remote launches full-screen without URL bars and with native safe-area edge padding.

---

## 13. Screen Mirror Requirements

- Smart Remote captures the active X11 root display using ImageMagick `import` and feeds binary JPEG frames over the `/ws/screen` WebSocket.
- The default target display is `:0`. If you run in a custom session, set `export DISPLAY=:0` before launching the server.
- On mobile devices, tap the **Rotate** button in the mirror view to auto-fill your phone's screen in landscape mode.

---

## 14. Mouse & Input Permissions

- Input simulation uses `xdotool`.
- The user account running `scripts/start.sh` must have access to the X11 server authorization (standard on default Kali desktop sessions).
- If running over SSH without an active display session, ensure `export DISPLAY=:0` and `export XAUTHORITY=$HOME/.Xauthority` are set.

---

## 15. Real-Time Voice Assistant & Auto-Listening Mode

- **Autonomous Voice Agent**: Designed after the OpenAI Realtime API persona with zero visual markup, strictly conversational spoken output, and prompt replies (< 25 words).
- **Phonetic Clarity**: Automatically expands numbers, percentages ("forty-two percent"), memory units ("sixteen gigabytes"), and system abbreviations ("C P U", "ram", "P I D", "I P").
- **Auto-Listening Mode**: Tap the **Auto-Listening** badge in the top bar to activate continuous sensitive listening. When you stop speaking, it automatically processes the intent and re-arms listening without manual intervention.
- **Universal Button & Remote Voice Execution**:
  - **Mouse & Navigation**: *"Left click"*, *"Right click"*, *"Double click"*, *"Scroll down"*, *"Scroll up"*, *"Press enter"*, *"Go back"*.
  - **D-Pad Directionals**: *"Move up"*, *"Move down"*, *"Move left"*, *"Move right"*.
  - **Media & OTT Controls**: *"Volume up"*, *"Volume down"*, *"Mute"*, *"Play"*, *"Pause"*, *"Open YouTube"*, *"Switch to Netflix"*, *"Play Spotify"*, *"Open Prime Video"*, *"Switch to Twitch"*, *"Open Apple TV"*, *"Open Hulu"*, *"Open Crunchyroll"*, *"Open Plex"*, *"Open SoundCloud"*.
  - **Voice Deep Search**: *"Search files config"*, *"Find files report"*, *"Search process python"*, *"Find process bash"*.
  - **Navigation & Views**: *"Open terminal"*, *"Switch to touchpad"*, *"Show mirror"*, *"Open files"*, *"Show system monitor"*, *"Open settings"*.
  - **System Telemetry**: *"What is the CPU usage?"*, *"Check memory"*, *"Disk space status"*, *"Battery level"*.
  - **Power & Safety**: *"Reboot system"*, *"Shut down computer"* (enforces spoken confirmation step).

---

## 16. Google Drive Cloud Sync Setup

1. Open **Settings > Cloud Backup & Sync**.
2. Enter your Google account email to link the automated backup engine.
3. Tap **Sync Backup Now** to export non-sensitive shortcuts, remote presets, and multi-turn voice memory.
4. *Security guarantee:* Passwords, Tailscale private keys, and biometrics are never included in sync archives.

---

## 17. Face Biometric Authentication & Master Credentials

Smart Remote provides hardware-accelerated face biometric enrollment and real-time verification using your device's webcam:

1. Tap the **Face Auth** badge in the top bar or navigate to **Settings > Face Authentication**.
2. **Master Credentials**:
   - **Username**: `Aryan007`
   - **Password**: `Aryan@2007`
3. **Face Enrollment**:
   - Position your face in front of the camera. The biometric HUD will lock a neon targeting reticle and sweeping laser scanner.
   - Enter your master password `Aryan@2007` and tap **Enroll Biometrics**.
   - A normalized 128-dimensional biometric descriptor vector is extracted and securely hashed into SQLite.
4. **Biometric Unlock**:
   - Tap **Scan & Verify** to authenticate instantly using biometric Euclidean distance matching.
   - If lighting or camera is unavailable, use the fallback master password prompt to unlock.

---

## 18. Troubleshooting

- **Connection refused on phone**: Verify that Tailscale is connected on both your phone and Kali machine. Test with `ping 100.69.194.11`.
- **Screen mirror shows black frame**: Ensure the X11 display is unlocked and running. Run `xdotool getmouselocation` in a terminal to confirm X11 accessibility.
- **Port 7070 already in use**: Run `./scripts/stop.sh` or `fuser -k 7070/tcp`.

---

## 19. Security Recommendations

1. **Private Network Only**: Keep port 7070 bound strictly within your private Tailscale mesh network. Never set up router port forwarding to 7070.
2. **File Manager Isolation**: The file manager restricts operations to `ALLOWED_FILE_ROOT` (`$HOME`) to prevent accidental modification of system files.
3. **Power & Command Confirmation**: Destructive operations (`rm`, `reboot`, `shutdown`, `kill -9`) require explicit confirmation.

---

## 20. Running as a Systemd Service

To automatically start Smart Remote whenever Kali Linux boots:

```bash
# Copy systemd unit
sudo cp systemd/smart-remote.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable smart-remote
sudo systemctl start smart-remote

# Check status
sudo systemctl status smart-remote
```

---

*Smart Remote — Kali Linux Mobile & Web Remote Controller*
