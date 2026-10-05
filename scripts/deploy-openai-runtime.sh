#!/usr/bin/env bash
# Recreates only the beta API with the persistent OpenAI runtime configuration.
# Secrets stay in the owner-only provider-real.env file and are never printed.
set -euo pipefail
umask 077

P1_DIR="${P1_DIR:?P1_DIR is required}"
P1_REPO="${P1_REPO:?P1_REPO is required}"
BASE_COMPOSE="$P1_DIR/compose.p1.yml"
BASE_ENV="$P1_DIR/p1.env"
PRIVATE_ENV="$P1_DIR/private/provider-real.env"
AUTH_RUNTIME="$P1_REPO/scripts/compose.auth-runtime.yml"
ADMIN_COPILOT="$P1_REPO/scripts/compose.admin-copilot.yml"
OPENAI_RUNTIME="$P1_REPO/scripts/compose.openai-runtime.yml"
PROJECT="${P1_COMPOSE_PROJECT:-$(basename "$P1_DIR")}"

for required in \
  "$BASE_COMPOSE" "$BASE_ENV" "$PRIVATE_ENV" \
  "$AUTH_RUNTIME" "$ADMIN_COPILOT" "$OPENAI_RUNTIME"; do
  [ -f "$required" ] || { printf 'OPENAI_RUNTIME_REQUIRED_FILE_MISSING\n' >&2; exit 2; }
done

[ "$(stat -c '%a' "$PRIVATE_ENV")" = '600' ] || {
  printf 'OPENAI_RUNTIME_PRIVATE_ENV_MODE_INVALID\n' >&2
  exit 2
}

for required_key in OPENAI_API_KEY OPENAI_MODEL; do
  count="$(grep -Ec "^${required_key}=.+" "$PRIVATE_ENV" || true)"
  [ "$count" = '1' ] || {
    printf 'OPENAI_RUNTIME_PRIVATE_VALUE_MISSING:%s\n' "$required_key" >&2
    exit 2
  }
done

compose=(
  docker compose
  --env-file "$BASE_ENV"
  --env-file "$PRIVATE_ENV"
  -p "$PROJECT"
  -f "$BASE_COMPOSE"
  -f "$AUTH_RUNTIME"
  -f "$ADMIN_COPILOT"
  -f "$OPENAI_RUNTIME"
)

export P1_DIR P1_REPO
"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-deps --force-recreate api

container="${PROJECT}-api-1"
for _ in $(seq 1 36); do
  if docker exec "$container" node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    printf 'OPENAI_RUNTIME_API_HEALTHY\n'
    exit 0
  fi
  sleep 5
done

printf 'OPENAI_RUNTIME_API_HEALTH_TIMEOUT\n' >&2
exit 1
