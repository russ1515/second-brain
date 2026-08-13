# Deployment & DevOps (Sprint 10.7)

Reproducible deploy for the Second Brain API. The goal: the same command produces
the same result in every environment, migrations apply automatically, and any
release can be rolled back.

## Environments

| Env | Purpose | Config |
| --- | --- | --- |
| **Dev** | Local development | `docker-compose.yml` (infra only) + `pnpm --filter @second-brain/api dev` |
| **Staging** | Pre-prod validation | `docker-compose.prod.yml` with a staging `.env` |
| **Prod** | Live | `docker-compose.prod.yml` with the prod `.env` / orchestrator |

Each environment differs ONLY by its `.env` (secrets + URLs) — never by code. See
`.env.example` for the full list of variables.

## Build

```bash
docker build -t second-brain-api .
```

Multi-stage (`Dockerfile`): builds `@second-brain/shared` + the API, then a lean
runtime with production dependencies and the Prisma engine only.

## Deploy

```bash
scripts/deploy.sh
```

1. backs up the database (`scripts/backup.sh`);
2. builds the API image and rolls the stack forward (`docker compose -f docker-compose.prod.yml up -d --build`);
3. the API container runs `prisma migrate deploy` on start, so **migrations are
   applied automatically and idempotently**;
4. waits for `GET /api/health` to go green.

## Backups

```bash
scripts/backup.sh                       # → backups/secondbrain-<ts>.sql.gz (keeps 14)
scripts/restore.sh backups/<file>.sql.gz
```

Schedule `backup.sh` (cron / CI) for automated, retained backups.

## Rollback

Code rollback is instant and safe:

```bash
scripts/rollback.sh <previous-image-tag>   # e.g. a git SHA
```

Database rollback is a **separate, deliberate** step — forward migrations can be
destructive, so data is never auto-reverted. When a release included a
destructive migration, restore the matching backup:

```bash
scripts/restore.sh backups/<file>.sql.gz
```

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR: install → build shared →
Prisma generate → typecheck API + mobile. On `main` it also builds the Docker
image. Push-to-registry + rollout are the final wiring (owner's infrastructure:
container registry, host, secrets).

## Owner-supplied (not in the repo)

- Secrets: `JWT_ACCESS_SECRET`, `GEMINI_API_KEY` (and any other provider keys),
  DB credentials, `ADMIN_EMAILS` — injected via the deploy environment.
- A container registry + host (VM / Kubernetes — later) and DNS/TLS.
- App-store distribution for the mobile builds (EAS / Play Console / App Store).

## Scale-out notes (future)

The API is stateless (sessions live in Postgres/Redis), so it scales
horizontally behind a load balancer. Postgres and Qdrant are the stateful tier;
Redis backs cache + the async-job path. Kubernetes manifests are the natural next
step once traffic warrants it.
