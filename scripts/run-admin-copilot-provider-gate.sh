#!/usr/bin/env bash
# Runs only on the staging VPS after a human has provisioned the owner-only
# private environment. It starts a disposable OpenAI-backed API container for
# exactly one Admin Copilot request and never changes the long-running P1 API.
set -euo pipefail
umask 077

P1_DIR="${P1_DIR:?P1_DIR is required}"
REPO="${P1_REPO:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BASE_COMPOSE="$P1_DIR/compose.p1.yml"
BASE_ENV="$P1_DIR/p1.env"
# Reuse the owner-only provider file already used by the prior isolated gate.
# The only added selector is ADMIN_COPILOT_MODEL; no key is copied elsewhere.
PRIVATE_ENV="$P1_DIR/private/provider-real.env"
OVERRIDE="$REPO/scripts/compose.admin-copilot-provider-gate.yml"
CLIENT="$REPO/scripts/admin-copilot-provider-gate-client.cjs"
EVIDENCE_DIR="$P1_DIR/evidence"
PROJECT="${P1_COMPOSE_PROJECT:-$(basename "$P1_DIR")}"
RUN_ID="admin-copilot-provider-gate-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
CONTAINER="${PROJECT}-${RUN_ID}"

write_not_verified() {
  local code="$1"
  mkdir -p "$EVIDENCE_DIR"
  chmod 700 "$EVIDENCE_DIR" 2>/dev/null || true
  printf '{"gate":"ADMIN_COPILOT_REAL_PROVIDER_COST_TRACE","status":"NOT_VERIFIED","runId":"%s","code":"%s","recordedAt":"%s"}\n' \
    "$RUN_ID" "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$EVIDENCE_DIR/admin-copilot-provider-gate-${RUN_ID}.json"
  chmod 600 "$EVIDENCE_DIR/admin-copilot-provider-gate-${RUN_ID}.json"
  printf 'ADMIN_COPILOT_PROVIDER_GATE_NOT_VERIFIED\n'
}

refuse() {
  write_not_verified "$1"
  exit 2
}

for required in "$BASE_COMPOSE" "$BASE_ENV" "$PRIVATE_ENV" "$OVERRIDE" "$CLIENT"; do
  [ -f "$required" ] || refuse "REQUIRED_FILE_MISSING"
done

[ "$(stat -c '%a' "$PRIVATE_ENV")" = '600' ] || refuse "PRIVATE_PROVIDER_ENV_MODE_INVALID"
[ "$(stat -c '%a' "$(dirname "$PRIVATE_ENV")")" = '700' ] || refuse "PRIVATE_PROVIDER_DIRECTORY_MODE_INVALID"

# Parse specific dotenv keys without sourcing the file: values must never be
# interpreted as shell and are never echoed. Technical fixture credentials are
# already injected by the private P1 Compose environment; this gate must not
# duplicate them into the provider credential file.
read_private_env() {
  local key="$1" line count value
  count="$(grep -Ec "^${key}=" "$PRIVATE_ENV" || true)"
  [ "$count" = '1' ] || refuse "PRIVATE_PROVIDER_${key}_MISSING"
  line="$(grep -E "^${key}=" "$PRIVATE_ENV")"
  value="${line#*=}"
  [ -n "$value" ] || refuse "PRIVATE_PROVIDER_${key}_EMPTY"
  printf -v "$key" '%s' "$value"
  export "$key"
}

read_private_env OPENAI_API_KEY
read_private_env ADMIN_COPILOT_MODEL

if grep -q '^OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS=' "$PRIVATE_ENV"; then
  read_private_env OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS
else
  OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS=32
  export OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS
fi

case "$OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS" in
  ''|*[!0-9]*) refuse "OPENAI_PROVIDER_GATE_OUTPUT_CAP_INVALID" ;;
esac
[ "$OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS" -ge 1 ] && [ "$OPENAI_PROVIDER_GATE_MAX_OUTPUT_TOKENS" -le 128 ] || refuse "OPENAI_PROVIDER_GATE_OUTPUT_CAP_INVALID"

case "$ADMIN_COPILOT_MODEL" in
  *$'\n'*|*$'\r'*) refuse "ADMIN_COPILOT_MODEL_INVALID" ;;
esac

git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || refuse "STAGING_SOURCE_REPOSITORY_INVALID"
[ -z "$(git -C "$REPO" status --porcelain)" ] || refuse "STAGING_SOURCE_WORKTREE_DIRTY"
SOURCE_SHA="$(git -C "$REPO" rev-parse HEAD)"

cleanup() {
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

export P1_REPO="$REPO"
export P1_API_IMAGE="second-brain-p1-admin-copilot-provider-gate:${RUN_ID}"

# The explicit model is supplied from ADMIN_COPILOT_MODEL only. The Compose
# overlay maps it to the server-side OpenAI selector for this disposable API.
docker compose --env-file "$BASE_ENV" --env-file "$PRIVATE_ENV" -p "$PROJECT" \
  -f "$BASE_COMPOSE" -f "$OVERRIDE" build api
docker compose --env-file "$BASE_ENV" --env-file "$PRIVATE_ENV" -p "$PROJECT" \
  -f "$BASE_COMPOSE" -f "$OVERRIDE" run -d --no-deps --name "$CONTAINER" api >/dev/null

for _ in $(seq 1 36); do
  if docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || refuse "ADMIN_COPILOT_GATE_API_HEALTH_TIMEOUT"

# The client runs exactly one POST to /admin/copilot/query. It does not print
# the access token, MFA material, query, response, provider request identifier,
# or private environment contents.
docker exec \
  -e "P1_ADMIN_COPILOT_GATE_RUN_ID=$RUN_ID" \
  -e "P1_ADMIN_COPILOT_GATE_SOURCE_SHA=$SOURCE_SHA" \
  -e "P1_ADMIN_COPILOT_GATE_EVIDENCE_DIR=/p1/evidence" \
  -e "P1_ADMIN_COPILOT_MODEL=$ADMIN_COPILOT_MODEL" \
  "$CONTAINER" node /app/admin-copilot-provider-gate-client.cjs
