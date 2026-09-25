#!/usr/bin/env bash
# Runs on the VPS only after the explicit “clé et modèle prêts” signal.
# It creates one disposable OpenAI API container, never changes p1.env, never
# recreates the long-running echo/fake API, and never prints secret values.
set -euo pipefail
umask 077

P1_DIR="${P1_DIR:?P1_DIR is required}"
REPO="${P1_REPO:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BASE_COMPOSE="$P1_DIR/compose.p1.yml"
BASE_ENV="$P1_DIR/p1.env"
PRIVATE_ENV="$P1_DIR/private/provider-real.env"
OVERRIDE="$REPO/scripts/compose.openai-provider-gate.yml"
CLIENT="$REPO/scripts/openai-provider-gate-client.cjs"
EVIDENCE_DIR="$P1_DIR/evidence"
PROJECT="${P1_COMPOSE_PROJECT:-$(basename "$P1_DIR")}"
RUN_ID="openai-provider-gate-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
CONTAINER="${PROJECT}-${RUN_ID}"

write_not_verified() {
  local code="$1"
  mkdir -p "$EVIDENCE_DIR"
  chmod 700 "$EVIDENCE_DIR" 2>/dev/null || true
  printf '{"gate":"OPENAI_REAL_PROVIDER_ATTRIBUTABLE_INSTRUMENTATION","status":"NOT_VERIFIED","runId":"%s","code":"%s","recordedAt":"%s"}\n' \
    "$RUN_ID" "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$EVIDENCE_DIR/openai-provider-gate-${RUN_ID}.json"
  chmod 600 "$EVIDENCE_DIR/openai-provider-gate-${RUN_ID}.json"
  printf 'OPENAI_PROVIDER_GATE_NOT_VERIFIED\n'
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

# Parse only the three allowed dotenv keys. Never source this file: a local
# configuration error must not become shell code execution.
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
read_private_env LLM_MODEL
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

case "$LLM_MODEL" in
  *$'\n'*|*$'\r'*) refuse "OPENAI_MODEL_INVALID" ;;
esac

case "$(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || true)" in
  ''|HEAD) refuse "STAGING_SOURCE_BRANCH_INVALID" ;;
esac
SOURCE_SHA="$(git -C "$REPO" rev-parse HEAD)"

cleanup() {
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

export P1_REPO="$REPO"
export P1_API_IMAGE="second-brain-p1-openai-gate:${RUN_ID}"

# Build and run only the disposable API service. docker compose run omits
# service ports by default, so it is reachable only inside its container.
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
docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || refuse "OPENAI_GATE_API_HEALTH_TIMEOUT"

# Client performs pricing/runtime preflight before its sole provider-triggering
# Tutor POST. It writes the sanitized result and controls the final exit status.
docker exec \
  -e "P1_PROVIDER_GATE_RUN_ID=$RUN_ID" \
  -e "P1_PROVIDER_GATE_SOURCE_SHA=$SOURCE_SHA" \
  -e "P1_PROVIDER_GATE_EVIDENCE_DIR=/p1/evidence" \
  "$CONTAINER" node /p1/openai-provider-gate-client.cjs
