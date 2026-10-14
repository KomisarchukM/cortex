#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
file="backups/cortex-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file"
[[ -s $file ]] || { echo 'Backup is empty.' >&2; exit 1; }
echo "Database backup: ${file}"
echo 'Copy the dump and a separately encrypted .env backup off the server.'
