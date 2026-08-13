#!/usr/bin/env bash
# Second Brain — reproducible deploy (Sprint 10.7).
# Backs up the DB, builds the API image, and rolls the stack forward. Migrations
# are applied by the API container on start (prisma migrate deploy).
# Usage: scripts/deploy.sh   (expects prod env vars / a .env for compose)
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "① Backing up the database…"
scripts/backup.sh || echo "  (skipped — no DB reachable yet)"

echo "② Building + rolling out…"
$COMPOSE up -d --build

echo "③ Waiting for the API to become healthy…"
for i in $(seq 1 30); do
  if curl -fs http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "  API healthy."
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy in time — check logs ($COMPOSE logs api)." >&2
exit 1
