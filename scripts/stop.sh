#!/usr/bin/env bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_DIR/smart-remote.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
fi

# Kill any stray uvicorn or cloudflared
pkill -f "uvicorn backend.app.main:app" 2>/dev/null || true
pkill -f "cloudflared tunnel run smart-remote" 2>/dev/null || true

echo "✓ pearOS Nexus Smart Remote stopped."
