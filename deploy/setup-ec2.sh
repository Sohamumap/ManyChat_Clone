#!/usr/bin/env bash
# One-time server preparation for a fresh Ubuntu 22.04/24.04 EC2 instance (t3.micro is fine).
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-ec2.sh | sudo bash
# or, after cloning:  sudo ./deploy/setup-ec2.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo" >&2
  exit 1
fi

echo "==> Adding 2 GB swap (t3.micro only has 1 GB RAM; building the images needs more)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
user="${SUDO_USER:-ubuntu}"
usermod -aG docker "$user" || true

echo "==> Installing git and unattended security upgrades"
apt-get update -y
apt-get install -y git unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "==> Limiting Docker log size"
mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl restart docker
fi

echo
echo "Done. Log out and back in (so '$user' can run docker without sudo), then:"
echo "  git clone https://github.com/<you>/<repo>.git flowdm && cd flowdm"
echo "  ./deploy/init-env.sh yourname.duckdns.org you@example.com"
echo "  nano .env    # add INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET"
echo "  docker compose up -d --build"
