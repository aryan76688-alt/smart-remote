#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Installing SMART REMOTE (Kali Linux Mobile & Web Controller) ==="
echo "Project directory: $PROJECT_ROOT"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is required."
    exit 1
fi

# Check Node & npm
if ! command -v npm &>/dev/null; then
    echo "ERROR: npm is required."
    exit 1
fi

# Check system utilities
for util in xdotool import xrandr; do
    if ! command -v "$util" &>/dev/null; then
        echo "WARNING: '$util' not found in PATH. Install with: sudo apt install xdotool imagemagick x11-xserver-utils"
    fi
done

# Initialize .env
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "Creating .env from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
fi

# Install Python backend dependencies
echo "Installing Python dependencies..."
python3 -m pip install -q -r "$PROJECT_ROOT/backend/requirements.txt" || true

# Install frontend dependencies and build bundle
echo "Building React PWA frontend..."
cd "$PROJECT_ROOT/frontend"
npm install --silent
npm run build

# Run Verification Tests
echo "Running validation tests..."
cd "$PROJECT_ROOT"
python3 -m unittest discover -s backend/tests -p "test_*.py"

echo "=== SMART REMOTE Installation & Build Completed Successfully! ==="
echo "Start the server with: ./scripts/start.sh"
