#!/usr/bin/env bash
# Reconciles one already-recorded Admin Copilot provider operation. It has no
# OpenAI credential, never calls the Copilot query route, and never recreates
# the long-running P1 services or modifies their configuration.
set -euo pipefail
umask 077

P1_DIR="${P1_DIR:?P1_DIR is required}"
REPO="${P1_REPO:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BASE_COMPOSE="$P1_DIR/compose.p1.yml"
BASE_ENV="$P1_DIR/p1.env"
SOURCE_EVIDENCE="${P1_ADMIN_COPILOT_GATE_EVIDENCE:?P1_ADMIN_COPILOT_GATE_EVIDENCE is required}"
OVERRIDE="$REPO/scripts/compose.admin-copilot-cost-trace-verify.yml"
CLIENT="$REPO/scripts/admin-copilot-cost-trace-verify-client.cjs"
EVIDENCE_DIR="$P1_DIR/evidence"
PROJECT="${P1_COMPOSE_PROJECT:-$(basename "$P1_DIR")}"
RUN_ID="admin-copilot-cost-trace-verify-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
CONTAINER="${PROJECT}-${RUN_ID}"

write_not_verified() {
  local code="$1"
  mkdir -p "$EVIDENCE_DIR"
  chmod 700 "$EVIDENCE_DIR" 2>/dev/null || true
  printf '{"gate":"ADMIN_COPILOT_REAL_PROVIDER_COST_TRACE_VERIFICATION","status":"NOT_VERIFIED","runId":"%s","code":"%s","recordedAt":"%s"}\n' \
    "$RUN_ID" "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$EVIDENCE_DIR/admin-copilot-provider-trace-verification-${RUN_ID}.json"
  chmod 600 "$EVIDENCE_DIR/admin-copilot-provider-trace-verification-${RUN_ID}.json"
  printf 'ADMIN_COPILOT_COST_TRACE_VERIFICATION_NOT_VERIFIED\n'
}

refuse() {
  write_not_verified "$1"
  exit 2
}

for required in "$BASE_COMPOSE" "$BASE_ENV" "$SOURCE_EVIDENCE" "$OVERRIDE" "$CLIENT"; do
  [ -f "$required" ] || refuse "REQUIRED_FILE_MISSING"
done

[ "$(stat -c '%a' "$SOURCE_EVIDENCE")" = '600' ] || refuse "SOURCE_EVIDENCE_MODE_INVALID"
command -v jq >/dev/null 2>&1 || refuse "JQ_REQUIRED_FOR_PRIVATE_EVIDENCE_PARSE"
git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || refuse "STAGING_SOURCE_REPOSITORY_INVALID"
[ -z "$(git -C "$REPO" status --porcelain)" ] || refuse "STAGING_SOURCE_WORKTREE_DIRTY"

read_evidence_field() {
  local field="$1"
  jq -er --arg field "$field" '.[$field] | select(type == "string" and length > 0)' "$SOURCE_EVIDENCE" \
    || refuse "SOURCE_EVIDENCE_FIELD_INVALID"
}

CORRELATION_ID="$(read_evidence_field correlationId)"
ORIGINAL_RUN_ID="$(read_evidence_field runId)"
case "$CORRELATION_ID" in
  ''|*[!A-Za-z0-9:_-]*) refuse "SOURCE_EVIDENCE_CORRELATION_INVALID" ;;
esac
[ "${#CORRELATION_ID}" -ge 8 ] && [ "${#CORRELATION_ID}" -le 128 ] || refuse "SOURCE_EVIDENCE_CORRELATION_INVALID"

SOURCE_SHA="$(git -C "$REPO" rev-parse HEAD)"

cleanup() {
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

export P1_REPO="$REPO"
export P1_API_IMAGE="second-brain-p1-admin-copilot-cost-trace-verify:${RUN_ID}"

# The override explicitly forces echo/fake and blanks the OpenAI key in this
# disposable process. No private provider environment is loaded here.
docker compose --env-file "$BASE_ENV" -p "$PROJECT" \
  -f "$BASE_COMPOSE" -f "$OVERRIDE" build api
docker compose --env-file "$BASE_ENV" -p "$PROJECT" \
  -f "$BASE_COMPOSE" -f "$OVERRIDE" run -d --no-deps --name "$CONTAINER" api >/dev/null

for _ in $(seq 1 36); do
  if docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || refuse "ADMIN_COPILOT_COST_TRACE_VERIFY_API_HEALTH_TIMEOUT"

docker exec \
  -e "P1_ADMIN_COPILOT_VERIFY_RUN_ID=$RUN_ID" \
  -e "P1_ADMIN_COPILOT_VERIFY_SOURCE_SHA=$SOURCE_SHA" \
  -e "P1_ADMIN_COPILOT_GATE_ORIGINAL_RUN_ID=$ORIGINAL_RUN_ID" \
  -e "P1_ADMIN_COPILOT_GATE_CORRELATION_ID=$CORRELATION_ID" \
  -e "P1_ADMIN_COPILOT_GATE_EVIDENCE_DIR=/p1/evidence" \
  "$CONTAINER" node /app/admin-copilot-cost-trace-verify-client.cjs
