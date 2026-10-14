#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || cp .env.example .env
echo 'This runs only credential setup in a disposable Node container; it writes a password hash to .env.'
docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD:/app" -w /app node:24-bookworm-slim sh -c 'npm ci --cache /tmp/npm-cache && npm run admin:setup'
chmod 600 .env
