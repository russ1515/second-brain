#!/usr/bin/env bash
# Second Brain — rollback (Sprint 10.7).
# Rolls the API back to a previous image tag. Code rollback is instant; DB
# rollback is a deliberate, separate step (restore a backup) because forward
# migrations can be destructive — never auto-revert data.
# Usage: scripts/rollback.sh <previous-image-tag>
set -euo pipefail

TAG="${1:?Usage: rollback.sh <previous-image-tag>   (e.g. a git SHA)}"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "Rolling the API back to image tag: $TAG"
API_IMAGE="second-brain-api:$TAG" $COMPOSE up -d --no-deps api

echo "Rolled back. If this release included a destructive migration, restore the"
echo "matching DB backup explicitly:  scripts/restore.sh backups/<file>.sql.gz"
