# Second Brain API — production image (Sprint 10.7).
# Multi-stage: build the shared package + API, then run a lean runtime that
# applies migrations before starting. Build context is the repo root (pnpm
# workspace, hoisted node_modules). Build: docker build -t second-brain-api .
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app

# ── build stage: install everything, build shared + api ──────────────────────
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @second-brain/shared build \
 && pnpm --filter @second-brain/api exec prisma generate \
 && pnpm --filter @second-brain/api build

# ── runtime stage: production deps only + built artifacts ─────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Workspace manifests + lockfile so a --prod install resolves the same versions.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --prod --frozen-lockfile

# Built code + Prisma schema/engine.
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma

WORKDIR /app/apps/api
EXPOSE 3000
# Apply pending migrations, then start. Reproducible on every deploy.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
