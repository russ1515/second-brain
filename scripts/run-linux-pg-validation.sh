#!/bin/sh
# Runs only inside docker-compose.linux-validation.yml's internal Linux runner.
# It refuses production-looking URLs and never prints DATABASE_URL or its secret.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SB_LINUX_VALIDATION_POSTGRES_DB:?SB_LINUX_VALIDATION_POSTGRES_DB is required}"
: "${SB_LINUX_VALIDATION_RUN_ID:?SB_LINUX_VALIDATION_RUN_ID is required}"

case "$DATABASE_URL" in
  *prod*|*production*)
    echo "Refusing a production-looking DATABASE_URL for the validation gate." >&2
    exit 2
    ;;
  *test*|*staging*|*sprint*)
    ;;
  *)
    echo "Refusing DATABASE_URL without a test, staging, or sprint marker." >&2
    exit 2
    ;;
esac

case "${SPRINT5_VALIDATION_REPEATS:-3}" in
  ''|*[!0-9]*)
    echo "SPRINT5_VALIDATION_REPEATS must be a positive integer." >&2
    exit 2
    ;;
esac

if [ "${SPRINT5_VALIDATION_REPEATS:-3}" -lt 1 ]; then
  echo "SPRINT5_VALIDATION_REPEATS must be at least 1." >&2
  exit 2
fi

if [ "${SB_LINUX_VALIDATION_FRESH_DATABASE:-}" != "I_CONFIRM_FRESH_VALIDATION_DATABASE" ]; then
  echo "Refusing to migrate without an explicit fresh-database confirmation." >&2
  exit 2
fi

if [ "${SB_LINUX_VALIDATION_COMPOSE_MARKER:-}" != "SECOND_BRAIN_LINUX_VALIDATION" ]; then
  echo "Refusing to run outside the Linux validation Compose topology." >&2
  exit 2
fi

expected_database="second_brain_sprint5_test_$(printf '%s' "$SB_LINUX_VALIDATION_RUN_ID" | tr -d '-')"
if [ "$SB_LINUX_VALIDATION_POSTGRES_DB" != "$expected_database" ]; then
  echo "Refusing a validation database not bound to this unique run id." >&2
  exit 2
fi

case "$DATABASE_URL" in
  *"@postgres:5432/${SB_LINUX_VALIDATION_POSTGRES_DB}?schema=public")
    ;;
  *)
    echo "Refusing DATABASE_URL outside the internal validation PostgreSQL host/database." >&2
    exit 2
    ;;
esac

export NODE_ENV=test

echo "Applying declared migrations to the dedicated validation database..."
# This runner is only invoked for a fresh, project-scoped validation database.
# A deploy error stops the gate; no migration status error is ever ignored.
pnpm --filter @second-brain/api exec prisma migrate deploy --schema prisma/schema.prisma

echo "Verifying the migrated database..."
pnpm --filter @second-brain/api exec prisma migrate status --schema prisma/schema.prisma

run=1
while [ "$run" -le "$SPRINT5_VALIDATION_REPEATS" ]; do
  echo "Running Sprint 5 PostgreSQL validation ($run/$SPRINT5_VALIDATION_REPEATS)..."
  pnpm --filter @second-brain/api test:sprint5:postgres
  run=$((run + 1))
done
