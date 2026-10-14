#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -eq 1 && -f $1 ]] || { echo 'Usage: bash scripts/restore.sh /path/to/backup.dump' >&2; exit 1; }
echo 'This stops the app and replaces database contents from the selected backup.'
read -r -p 'Type RESTORE CORTEX to continue: ' confirmation
[[ $confirmation == 'RESTORE CORTEX' ]] || { echo 'Restore canceled.'; exit 1; }
bash scripts/backup.sh
docker compose -f docker-compose.prod.yml stop app
docker compose -f docker-compose.prod.yml exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$1"
docker compose -f docker-compose.prod.yml up -d --wait --wait-timeout 120 app
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
echo
echo 'Restore complete.'
