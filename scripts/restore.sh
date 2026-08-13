#!/usr/bin/env bash
# Second Brain — database restore (Sprint 10.7).
# Restores a gzipped dump produced by backup.sh.
# Usage: DATABASE_URL=postgres://... scripts/restore.sh backups/secondbrain-XXXX.sql.gz
set -euo pipefail

DUMP="${1:?Usage: restore.sh <backup.sql.gz>}"
[ -f "$DUMP" ] || { echo "No such file: $DUMP" >&2; exit 1; }

echo "⚠️  This overwrites the current database. Ctrl-C to abort."
sleep 3

if [ -n "${DATABASE_URL:-}" ]; then
  gunzip -c "$DUMP" | psql "$DATABASE_URL"
elif docker ps --format '{{.Names}}' | grep -q postgres; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep postgres | head -1)"
  gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U "${POSTGRES_USER:-secondbrain}" "${POSTGRES_DB:-secondbrain}"
else
  echo "No DATABASE_URL and no postgres container found." >&2
  exit 1
fi

echo "Restore complete from $DUMP"
