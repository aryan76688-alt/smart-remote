#!/usr/bin/env bash
set -e

AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/smart-remote.desktop"

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/smart-remote.service"

echo "=== Disabling SMART REMOTE Auto-Start on Login ==="

if [ -f "$DESKTOP_FILE" ]; then
    rm -f "$DESKTOP_FILE"
    echo "✓ Removed $DESKTOP_FILE"
fi

if command -v systemctl &>/dev/null; then
    systemctl --user disable smart-remote.service 2>/dev/null || true
    systemctl --user daemon-reload 2>/dev/null || true
fi

if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    echo "✓ Removed $SERVICE_FILE"
fi

echo "✓ SMART REMOTE auto-start has been disabled."
