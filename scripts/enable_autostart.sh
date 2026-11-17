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
Comment=Auto-starts SMART REMOTE Controller and Global Tunnel at Login
Exec=$START_SCRIPT
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
EOF
chmod +x "$DESKTOP_FILE"
echo "✓ Created XDG Autostart Entry: $DESKTOP_FILE"

# 1b. Browser Autostart Entry (opens web dashboard on login)
BROWSER_DESKTOP_FILE="$AUTOSTART_DIR/smart-remote-browser.desktop"
cat > "$BROWSER_DESKTOP_FILE" << EOF
[Desktop Entry]
Encoding=UTF-8
Version=2.0
Type=Application
Name=Smart Remote Web Dashboard
Comment=Auto-opens Smart Remote Web Dashboard at Login
Exec=$PROJECT_ROOT/scripts/autostart_smart_remote.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
EOF
chmod +x "$BROWSER_DESKTOP_FILE"
echo "✓ Created Browser Autostart Entry: $BROWSER_DESKTOP_FILE"

# 2. Systemd User Service
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=SMART REMOTE 2.0 - pearOS Controller & Global Tunnel
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

# Enable systemd linger so background services persist after logout/boot
if command -v loginctl &>/dev/null; then
    loginctl enable-linger "$(whoami)" 2>/dev/null || true
    echo "✓ Enabled systemd lingering for $(whoami)"
fi

# Configure KDE Plasma lid behavior: keep laptop awake with screen off
if command -v kwriteconfig6 &>/dev/null; then
    kwriteconfig6 --file powerdevilrc --group AC --group Actions --group HandleLidSwitch --key action 0 2>/dev/null || true
    kwriteconfig6 --file powerdevilrc --group Battery --group Actions --group HandleLidSwitch --key action 0 2>/dev/null || true
    echo "✓ Configured KDE Plasma 6 lid action: stay awake for remote control"
fi

echo "============================================================"
echo "✓ SMART REMOTE is now configured to automatically start"
echo "  whenever user '$(whoami)' logs in or the system boots!"
echo "============================================================"
