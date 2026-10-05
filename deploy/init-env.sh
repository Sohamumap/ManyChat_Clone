#!/usr/bin/env bash
# Create .env from .env.example with random secrets filled in.
#   ./deploy/init-env.sh yourname.duckdns.org you@example.com
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo ".env already exists - edit it directly (or delete it first)." >&2
  exit 1
fi

domain="${1:-}"
email="${2:-admin@example.com}"
rand() { openssl rand -hex "$1"; }
admin_password="$(rand 9)"

cp .env.example .env
set_var() { sed -i "s|^$1=.*|$1=$2|" .env; }
set_var SECRET_KEY "$(rand 32)"
set_var POSTGRES_PASSWORD "$(rand 16)"
set_var WEBHOOK_VERIFY_TOKEN "$(rand 12)"
set_var ADMIN_PASSWORD "$admin_password"
set_var ADMIN_EMAIL "$email"
if [[ -n "$domain" ]]; then
  set_var DOMAIN "$domain"
  set_var PUBLIC_BASE_URL "https://$domain"
else
  set_var DOMAIN ":80"
  set_var PUBLIC_BASE_URL "http://localhost"
fi
chmod 600 .env

echo "Created .env"
echo "  Dashboard login: $email / $admin_password"
echo "  Next: add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to .env, then: docker compose up -d --build"
