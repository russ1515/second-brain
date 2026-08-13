#!/usr/bin/env bash
# Second Brain — database backup (Sprint 10.7).
# Dumps PostgreSQL to a timestamped, compressed file under ./backups.
# Usage: DATABASE_URL=postgres://... scripts/backup.sh
#   (or set PGHOST/PGUSER/PGDATABASE; falls back to the dev container).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/secondbrain-$STAMP.sql.gz"

if [ -n "${DATABASE_URL:-}" ]; then
  # Direct dump from a reachable database URL.
  pg_dump "$DATABASE_URL" | gzip > "$OUT"
elif docker ps --format '{{.Names}}' | grep -q postgres; then
  # Dump from the running Postgres container (dev/prod compose).
  CONTAINER="$(docker ps --format '{{.Names}}' | grep postgres | head -1)"
  docker exec "$CONTAINER" pg_dump -U "${POSTGRES_USER:-secondbrain}" "${POSTGRES_DB:-secondbrain}" | gzip > "$OUT"
else
  echo "No DATABASE_URL and no postgres container found." >&2
  exit 1
fi

echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
# Retention: keep the 14 most recent backups.
ls -1t "$BACKUP_DIR"/secondbrain-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
