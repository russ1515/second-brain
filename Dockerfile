# Second Brain API — production image (Sprint 10.7).
# Multi-stage: build the shared package + API, then run a lean runtime that
# applies migrations before starting. Build context is the repo root (pnpm
# workspace, hoisted node_modules). Build: docker build -t second-brain-api .
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app

# ── build stage: install the API closure once, then build shared + API ────────
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=second-brain-pnpm,target=/root/.local/share/pnpm/store \
    pnpm --config.node-linker=isolated --config.trust-lockfile=true \
    --filter @second-brain/api... install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN packages/shared/node_modules/.bin/tsc -p packages/shared/tsconfig.json \
 && cd apps/api \
 && ./node_modules/.bin/prisma generate \
 && ./node_modules/.bin/nest build

# Produce a self-contained production package from the populated pnpm store.
RUN --mount=type=cache,id=second-brain-pnpm,target=/root/.local/share/pnpm/store \
    pnpm --config.inject-workspace-packages=true --config.trust-lockfile=true \
    --filter @second-brain/api --prod deploy /prod/api \
 && cd /prod/api \
 && ./node_modules/.bin/prisma generate --schema=prisma/schema.prisma

# ── runtime stage: portable API package only ──────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
EXPOSE 3000
# Apply pending migrations, then start. Reproducible on every deploy.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
