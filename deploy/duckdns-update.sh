#!/usr/bin/env bash
# Point your DuckDNS name at this server's current public IP.
# Only needed if you don't use an Elastic IP. Add to cron:
#   */5 * * * * /home/ubuntu/flowdm/deploy/duckdns-update.sh >/dev/null 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source <(grep -E '^(DOMAIN|DUCKDNS_TOKEN)=' .env)
subdomain="${DOMAIN%%.duckdns.org}"
if [[ -z "${DUCKDNS_TOKEN:-}" || "$subdomain" == "$DOMAIN" ]]; then
  echo "Set DOMAIN=<name>.duckdns.org and DUCKDNS_TOKEN in .env" >&2
  exit 1
fi
curl -fsS "https://www.duckdns.org/update?domains=${subdomain}&token=${DUCKDNS_TOKEN}&ip="
echo
