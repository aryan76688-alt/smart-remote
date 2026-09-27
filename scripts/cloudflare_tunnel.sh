#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLOUDFLARED="$PROJECT_ROOT/bin/cloudflared"
PORT="${SMART_REMOTE_PORT:-7070}"

if [ ! -f "$CLOUDFLARED" ]; then
    echo "Downloading official cloudflared binary..."
    mkdir -p "$PROJECT_ROOT/bin"
    curl -L --fail -o "$CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x "$CLOUDFLARED"
fi

echo "============================================================"
echo "          SMART REMOTE - Cloudflare Tunnel Launcher         "
echo "============================================================"

# If token passed as argument
if [ -n "$1" ]; then
    TOKEN="$1"
    echo "Starting Named Cloudflare Tunnel with Token..."
    exec "$CLOUDFLARED" tunnel run --token "$TOKEN"
fi

# Check if TOKEN environment variable is set
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "Starting Named Cloudflare Tunnel with CLOUDFLARE_TUNNEL_TOKEN..."
    exec "$CLOUDFLARED" tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
fi

# Otherwise start Quick Tunnel (Free, zero-config, temporary HTTPS URL)
echo "Starting Cloudflare Quick Tunnel (Free, No account needed)..."
echo "Target: http://127.0.0.1:$PORT"
echo ""
echo "Watch below for your public 'https://*.trycloudflare.com' URL:"
echo "------------------------------------------------------------"
exec "$CLOUDFLARED" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate
