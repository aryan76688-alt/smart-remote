#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Running SMART REMOTE Test Suite ==="

# 1. Backend tests
echo "1. Backend Tests:"
cd "$PROJECT_ROOT"
python3 -m unittest discover -s backend/tests -p "test_*.py"

# 2. Frontend Assets Check
echo "2. Frontend Assets Check:"
if [ -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
    echo "✓ Frontend bundle dist/index.html exists"
else
    echo "✗ Frontend bundle missing! Building now..."
    cd "$PROJECT_ROOT/frontend"
    npm run build
fi

# 3. Integration Endpoints Test
echo "3. Integration Endpoints Test:"
python3 -c "
import sys
sys.path.append('$PROJECT_ROOT/backend')
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
assert client.get('/').status_code == 200
assert client.get('/api/system/info').status_code == 200
assert client.get('/api/system/stats').status_code == 200
assert client.get('/api/files/list').status_code == 200
assert client.get('/manifest.json').status_code == 200

# Test Face Auth endpoint
auth_resp = client.post('/api/auth/face/verify', json={'username': 'Aryan007', 'password': 'Aryan@2007'})
assert auth_resp.status_code == 200
assert auth_resp.json().get('authenticated') is True

# Test Voice Realtime Process endpoint
voice_resp = client.post('/api/voice/process', json={'transcript': 'system status'})
assert voice_resp.status_code == 200
assert '*' not in voice_resp.json().get('spoken_reply', '')

# Test Tunnel status and ping endpoint
tunnel_resp = client.get('/api/tunnel/status')
assert tunnel_resp.status_code == 200
assert 'available_providers' in tunnel_resp.json()

ping_resp = client.get('/api/tunnel/ping')
assert ping_resp.status_code == 200
assert ping_resp.json().get('pong') is True

# Test Quick Action endpoint
qa_resp = client.post('/api/system/quick-action', json={'action': 'wake_display'})
assert qa_resp.status_code == 200

# Test Camera and CCTV endpoints
cam_status = client.get('/api/camera/status')
assert cam_status.status_code == 200

cctv_status = client.get('/api/camera/cctv/status')
assert cctv_status.status_code == 200
assert 'is_recording' in cctv_status.json()

cctv_settings = client.get('/api/camera/cctv/settings')
assert cctv_settings.status_code == 200
assert 'always_record' in cctv_settings.json()

cctv_events = client.get('/api/camera/cctv/events')
assert cctv_events.status_code == 200
assert isinstance(cctv_events.json(), list)

cctv_recs = client.get('/api/camera/cctv/recordings')
assert cctv_recs.status_code == 200
assert isinstance(cctv_recs.json(), list)

sync_status = client.get('/api/sync/status')
assert sync_status.status_code == 200

rclone_stat = client.get('/api/sync/gdrive/rclone-status')
assert rclone_stat.status_code == 200
assert 'installed' in rclone_stat.json()

gdrive_files = client.get('/api/sync/gdrive/cctv-files')
assert gdrive_files.status_code == 200

# Test camera snapshot endpoint
snap_resp = client.get('/api/camera/laptop/snapshot')
assert snap_resp.status_code == 200
assert 'image/jpeg' in snap_resp.headers.get('content-type', '')

# Test CCTV screen-status, screen-off, and screen-on
scr_stat = client.get('/api/camera/cctv/screen-status')
assert scr_stat.status_code == 200
assert 'screen_is_off' in scr_stat.json()

scr_off = client.post('/api/camera/cctv/screen-off')
assert scr_off.status_code == 200

scr_on = client.post('/api/camera/cctv/screen-on')
assert scr_on.status_code == 200

# Test updating sensitivity to ultra and keep_laptop_screen_off
upd_sett = client.post('/api/camera/cctv/settings', json={'motion_sensitivity': 'ultra', 'keep_laptop_screen_off': True})
assert upd_sett.status_code == 200
assert upd_sett.json().get('motion_sensitivity') == 'ultra'

# Test Motion Detection ON/OFF toggle
mot_off = client.post('/api/camera/cctv/motion-toggle', json={'enabled': False})
assert mot_off.status_code == 200
assert mot_off.json().get('motion_detection_enabled') is False

mot_on = client.post('/api/camera/cctv/motion-toggle', json={'enabled': True})
assert mot_on.status_code == 200
assert mot_on.json().get('motion_detection_enabled') is True

# Test Intercom History and Intercom Audio POST
int_hist = client.get('/api/camera/cctv/intercom-history')
assert int_hist.status_code == 200
assert isinstance(int_hist.json(), list)

# Test Intercom audio upload and playback
files = {'audio': ('voice.webm', b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'audio/webm')}
int_post = client.post('/api/camera/laptop/intercom', files=files)
assert int_post.status_code == 200
assert int_post.json().get('success') is True
assert int_post.json().get('gdrive_folder') == 'Kali_CCTV_Recordings2.0'

# Verify rclone sync targets Kali_CCTV_Recordings2.0
from app.sync.rclone_manager import rclone_manager
assert rclone_manager.cctv_folder_name == 'Kali_CCTV_Recordings2.0'

# Test Noise Cancellation toggle endpoint
nc_off = client.post('/api/camera/cctv/noise-cancellation', json={'enabled': False})
assert nc_off.status_code == 200
assert nc_off.json().get('audio_noise_cancellation') is False

nc_on = client.post('/api/camera/cctv/noise-cancellation', json={'enabled': True})
assert nc_on.status_code == 200
assert nc_on.json().get('audio_noise_cancellation') is True

# Test Auto Light Adjust toggle endpoint
al_off = client.post('/api/camera/cctv/auto-light', json={'enabled': False})
assert al_off.status_code == 200
assert al_off.json().get('auto_light_adjust') is False

al_on = client.post('/api/camera/cctv/auto-light', json={'enabled': True})
assert al_on.status_code == 200
assert al_on.json().get('auto_light_adjust') is True

print('✓ All core, face auth, voice, tunnel, quick-action, CCTV, audio, screen stealth, motion toggle, noise cancel, auto light, intercom, and Kali_CCTV_Recordings2.0 sync endpoints verified successfully!')
"

echo "=== ALL TESTS PASSED! ==="
