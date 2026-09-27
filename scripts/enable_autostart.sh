#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_SCRIPT="$PROJECT_ROOT/scripts/start.sh"
STOP_SCRIPT="$PROJECT_ROOT/scripts/stop.sh"
PID_FILE="$PROJECT_ROOT/smart-remote.pid"

AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/smart-remote.desktop"

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/smart-remote.service"

mkdir -p "$AUTOSTART_DIR"
mkdir -p "$SYSTEMD_USER_DIR"

echo "=== Enabling SMART REMOTE Auto-Start on Login / Boot ==="

# 1. Desktop Session Autostart (.desktop entry)
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Encoding=UTF-8
Version=2.0
Type=Application
Name=SMART REMOTE 2.0 Controller
Comment=Auto-starts SMART REMOTE Kali Linux Controller and Global Tunnel at Login
Exec=$START_SCRIPT
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
EOF
chmod +x "$DESKTOP_FILE"
echo "✓ Created XDG Autostart Entry: $DESKTOP_FILE"

# 2. Systemd User Service
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=SMART REMOTE 2.0 - Kali Linux Controller & Global Tunnel
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=forking
WorkingDirectory=$PROJECT_ROOT
ExecStart=$START_SCRIPT
ExecStop=$STOP_SCRIPT
PIDFile=$PID_FILE
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

echo "✓ Created Systemd User Service: $SERVICE_FILE"

# Enable systemd user service if systemctl is available
if command -v systemctl &>/dev/null; then
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable smart-remote.service 2>/dev/null || true
    echo "✓ Enabled smart-remote.service in systemd user manager"
fi

echo "============================================================"
echo "✓ SMART REMOTE is now configured to automatically start"
echo "  whenever user '$(whoami)' logs in or the system boots!"
echo "============================================================"
