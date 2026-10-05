#!/usr/bin/env bash
# Dump the database to ./backups (keeps the last 14). Cron example (daily 03:15):
#   15 3 * * * /home/ubuntu/flowdm/deploy/backup.sh >/dev/null 2>&1
# Restore: gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U flowdm flowdm
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/flowdm-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U flowdm flowdm | gzip > "$file"
ls -1t backups/*.sql.gz | tail -n +15 | xargs -r rm --
echo "Saved $file"
