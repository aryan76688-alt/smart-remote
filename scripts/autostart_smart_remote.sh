#!/usr/bin/env bash
# Smart Remote PC Login Auto-Start Launcher
# Opens https://smart-remote.aryan76688.workers.dev in the default browser upon user login

# Brief wait to ensure graphical session and network connection are ready
sleep 3

URL="https://smart-remote.aryan76688.workers.dev"

# Attempt to open using xdg-open (system default browser)
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
    chromium "$URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
    firefox "$URL" >/dev/null 2>&1 &
fi
