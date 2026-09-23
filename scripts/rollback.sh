#!/usr/bin/env bash
# Second Brain — rollback (Sprint 10.7).
# Rolls the API back to a previous image tag. Code rollback is instant; DB
# rollback is a deliberate, separate step (restore a backup) because forward
# migrations can be destructive — never auto-revert data.
# Usage: scripts/rollback.sh <previous-image-tag>
set -euo pipefail

TAG="${1:?Usage: rollback.sh <previous-image-tag>   (e.g. a git SHA)}"
COMPOSE="docker compose -f docker-compose.prod.yml"
export API_IMAGE="${API_IMAGE_REPOSITORY:-second-brain-api}:$TAG"

if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
  echo "Rollback image is not available locally: $API_IMAGE" >&2
  echo "Pull it from the configured registry before retrying." >&2
  exit 1
fi

echo "Rolling the API back to image: $API_IMAGE"
$COMPOSE up -d --no-deps --no-build api

echo "Rolled back. If this release included a destructive migration, restore the"
echo "matching DB backup explicitly:  scripts/restore.sh backups/<file>.sql.gz"
