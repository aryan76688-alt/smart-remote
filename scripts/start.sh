#!/usr/bin/env bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

PID_FILE="$PROJECT_DIR/smart-remote.pid"
LOG_FILE="$PROJECT_DIR/smart-remote.log"

# Stop existing
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        kill "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
fi

# Inhibit lid sleep in background
nohup systemd-inhibit --what=handle-lid-switch:sleep:idle --why="pearOS Smart Remote 24/7 background operation" sleep infinity >> "$LOG_FILE" 2>&1 &

# Start Uvicorn in background
nohup "$PROJECT_DIR/.venv/bin/python3" -m uvicorn backend.app.main:app \
    --host 0.0.0.0 \
    --port 7070 \
    --workers 1 >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

# Start Cloudflare Tunnel in background
if [ -x "$PROJECT_DIR/bin/cloudflared" ]; then
    nohup "$PROJECT_DIR/bin/cloudflared" tunnel run smart-remote >> "$LOG_FILE" 2>&1 &
fi

echo "✓ pearOS Nexus Smart Remote 3.0 is active and running!"
exit 0
