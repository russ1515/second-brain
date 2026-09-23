# Second Brain

Second Brain is a pnpm/Turbo monorepo containing the NestJS API, the Expo user application, the secure Expo Web administration application, and shared TypeScript contracts.

## Workspaces

- `apps/api` — NestJS API, Prisma/PostgreSQL, Redis and Qdrant integrations.
- `apps/mobile` — existing learner application for mobile and web.
- `apps/admin` — desktop-first internal control center foundation.
- `packages/shared` — provider-independent API contracts and pure helpers.

## Local commands

```sh
pnpm install
pnpm typecheck
pnpm --filter @second-brain/api test
pnpm --filter @second-brain/api build
pnpm --filter @second-brain/mobile export:web
pnpm --filter @second-brain/admin build
```

Copy `.env.example` to `.env` and provide local credentials. Never commit secrets. Database migrations are under `apps/api/prisma/migrations`; deploy them before starting the API. The Sprint 1 migration is additive and preserves legacy commercial data.

## Administration

The admin UI runs at port 8083 in development. It authenticates through the normal password/TOTP endpoints and validates every session through `/api/admin/session`. Backend roles and capabilities are authoritative; route hiding in the UI is only presentation.

`ADMIN_EMAILS` is a one-time compatibility bootstrap, controlled by `ADMIN_BOOTSTRAP_ENABLED`. A matched legacy administrator receives a persistent `SUPER_ADMIN` assignment and is marked as bootstrapped so removing a role does not silently grant it again.

See `docs/admin-architecture.md`, `docs/security.md`, and `docs/commercial-foundation.md` before changing privileged or commercial behavior.
