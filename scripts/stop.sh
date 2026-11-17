#!/usr/bin/env bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/smart-remote.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping Smart Remote (PID $PID)..."
        kill "$PID" 2>/dev/null || true
        sleep 0.5
        kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
fi

# Always ensure port 7070 and uvicorn are terminated cleanly
fuser -k 7070/tcp 2>/dev/null || true
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
echo "Smart Remote stopped."
