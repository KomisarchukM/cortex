#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo 'Configure .env first.' >&2; exit 1; }
if ! grep -q '^APP_ORIGIN=https://' .env; then echo 'Production APP_ORIGIN must use HTTPS.' >&2; exit 1; fi
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then tag="$(git rev-parse --short HEAD)"; else tag="$(date -u +%Y%m%dT%H%M%SZ)"; fi
echo "Deploying this checkout as cortex:${tag}. Database migrations run on application startup."
if [[ $(docker compose -f docker-compose.prod.yml ps -q db | wc -c) -gt 1 ]]; then bash scripts/backup.sh; fi
if grep -q '^APP_TAG=' .env; then sed -i "s/^APP_TAG=.*/APP_TAG=${tag}/" .env; else printf '\nAPP_TAG=%s\n' "$tag" >> .env; fi
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml build --pull app
docker compose -f docker-compose.prod.yml up -d --wait --wait-timeout 120
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
echo
echo "Release ${tag} is healthy. Verify https://YOUR_DOMAIN in a browser."
