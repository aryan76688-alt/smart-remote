#!/usr/bin/env bash
set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Restarting Smart Remote server..."
bash "$PROJECT_ROOT/scripts/stop.sh" || true
sleep 1
bash "$PROJECT_ROOT/scripts/start.sh"
