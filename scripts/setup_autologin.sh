#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run with sudo/root privileges."
  echo "Usage: sudo bash scripts/setup_autologin.sh"
  exit 1
fi

TARGET_USER="aryan"

echo "============================================================"
echo "    Configuring Kali Linux Automatic Login & 24/7 Remote    "
echo "============================================================"

# 1. Ensure autologin group exists in system
if ! getent group autologin >/dev/null 2>&1; then
  groupadd -r autologin
  echo "✓ Created 'autologin' system group"
else
  echo "✓ 'autologin' group already exists"
fi

# 2. Add target user to autologin group
usermod -a -G autologin "$TARGET_USER"
echo "✓ Added user '$TARGET_USER' to 'autologin' group"

# 3. Create LightDM drop-in autologin configuration
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/12-autologin.conf << EOF
[Seat:*]
autologin-user=$TARGET_USER
autologin-user-timeout=0
autologin-session=lightdm-xsession
EOF
chmod 644 /etc/lightdm/lightdm.conf.d/12-autologin.conf
echo "✓ Created /etc/lightdm/lightdm.conf.d/12-autologin.conf"

# 4. Enable user lingering so background services can start on system boot
loginctl enable-linger "$TARGET_USER" 2>/dev/null || true
echo "✓ Enabled systemd lingering for '$TARGET_USER'"

# 5. Prevent laptop from going to sleep when the lid is closed
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/10-ignore-lid-switch.conf << 'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
echo "✓ Configured laptop to stay ON 24/7 even with lid closed (/etc/systemd/logind.conf.d/10-ignore-lid-switch.conf)"

# 6. Ensure Tailscale and NetworkManager start automatically on boot
systemctl enable NetworkManager.service 2>/dev/null || true
systemctl enable tailscaled.service 2>/dev/null || true
echo "✓ Enabled NetworkManager & Tailscale auto-connect on boot"

echo "============================================================"
echo "✓ Automatic Login & 24/7 Power Configuration Complete!"
echo "  When you turn on the PC, Kali will immediately log into '$TARGET_USER'"
echo "  and launch SMART REMOTE automatically."
echo "============================================================"
