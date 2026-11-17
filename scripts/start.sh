#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/smart-remote.pid"
LOG_FILE="$PROJECT_ROOT/smart-remote.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Smart Remote is already running with PID $(cat "$PID_FILE")"
    exit 0
fi

# Source configuration
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

HOST="${SMART_REMOTE_HOST:-0.0.0.0}"
PORT="${SMART_REMOTE_PORT:-7070}"
TAILSCALE_IP="${SMART_REMOTE_TAILSCALE_IP:-100.69.194.11}"

echo "============================================================"
echo "           SMART REMOTE - pearOS Controller             "
echo "============================================================"
echo "Starting Smart Remote server on $HOST:$PORT..."

cd "$PROJECT_ROOT"
PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python3"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="/home/aryan/.gemini/antigravity/scratch/gesture-detetction/.venv/bin/python3"
fi
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi
export PATH="$PROJECT_ROOT/bin:$PROJECT_ROOT/.venv/bin:/home/aryan/.local/bin:$PATH"

INHIBIT_PREFIX=""
if command -v systemd-inhibit >/dev/null 2>&1; then
    INHIBIT_PREFIX="systemd-inhibit --what=handle-lid-switch:sleep:idle --why=SmartRemote --mode=block"
fi

setsid $INHIBIT_PREFIX "$PYTHON_BIN" -m uvicorn app.main:app --app-dir backend --host "$HOST" --port "$PORT" </dev/null > "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"
disown "$PID" 2>/dev/null || true

sleep 1

if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "✓ Smart Remote is active and listening!"
    echo ""
    echo "ACCESS URLS:"
    echo "  • Local Machine:    http://localhost:$PORT"
    echo "  • Tailscale Remote: http://$TAILSCALE_IP:$PORT"
    echo ""
    echo "[SECURITY NOTICE]"
    echo "  Port $PORT is intended for private access over Tailscale."
    echo "  Never expose this port directly to the public Internet."
    echo "============================================================"
else
    echo "ERROR: Server failed to start. Check logs in $LOG_FILE"
    exit 1
fi
