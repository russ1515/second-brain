-- Sprint 1: additive-only admin, account-state, quota, metering and billing foundations.
-- Existing user, plan, subscription and historical usage data are preserved.

CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'banned', 'deletion_pending');
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'TECH_OPS', 'SUPPORT', 'FINANCE', 'SECURITY', 'ANALYTICS');
CREATE TYPE "DeletionRequestStatus" AS ENUM ('requested', 'approved', 'rejected', 'completed');
CREATE TYPE "QuotaResource" AS ENUM ('AI_TEXT', 'VOICE_SECONDS', 'DOCUMENT_PAGES', 'OCR_PAGES', 'EMBEDDING_UNITS', 'WEB_SEARCH', 'DEEP_RESEARCH', 'ACADEMIC_AI');
CREATE TYPE "QuotaCycleStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "QuotaState" AS ENUM ('PRIMARY', 'FALLBACK', 'BLOCKED');
CREATE TYPE "QuotaReservationStatus" AS ENUM ('RESERVED', 'FINALIZED', 'RELEASED');
CREATE TYPE "UsageLedgerEvent" AS ENUM ('RESERVE', 'FINALIZE', 'RELEASE', 'ADJUST');

ALTER TABLE "users"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "bannedAt" TIMESTAMP(3),
  ADD COLUMN "banReason" TEXT,
  ADD COLUMN "banInternalNote" TEXT,
  ADD COLUMN "banReference" TEXT,
  ADD COLUMN "accountStateActorId" TEXT,
  ADD COLUMN "adminBootstrappedAt" TIMESTAMP(3);

UPDATE "users" SET "accountStatus" = 'suspended' WHERE "suspendedAt" IS NOT NULL;

ALTER TABLE "sessions" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

ALTER TABLE "plans"
  ADD COLUMN "publicV1" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fallbackRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "configurationVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "plans" SET
  "priceMonthly" = CASE "slug" WHEN 'free' THEN 0 WHEN 'pro' THEN 1999 WHEN 'pro_max' THEN 4999 ELSE "priceMonthly" END,
  "priceYearly" = CASE "slug" WHEN 'free' THEN 0 WHEN 'pro' THEN 19900 WHEN 'pro_max' THEN 49900 ELSE "priceYearly" END,
  "currency" = CASE WHEN "slug" IN ('free', 'pro', 'pro_max') THEN 'usd' ELSE "currency" END,
  "publicV1" = "slug" IN ('free', 'pro', 'pro_max'),
  "fallbackRatio" = CASE WHEN "slug" = 'free' THEN 0 ELSE 0.5 END;

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TABLE "subscriptions" ADD COLUMN "planVersion" INTEGER;

ALTER TABLE "webhook_events"
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "processedAt" DROP DEFAULT,
  ALTER COLUMN "processedAt" DROP NOT NULL,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "payloadHash" TEXT;

ALTER TABLE "audit_logs"
  ADD COLUMN "actorRole" TEXT,
  ADD COLUMN "targetType" TEXT,
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "result" TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE TABLE "admin_role_assignments" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" "AdminRole" NOT NULL,
  "grantedById" TEXT, "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3), CONSTRAINT "admin_role_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_role_assignments_userId_role_key" ON "admin_role_assignments"("userId", "role");
CREATE INDEX "admin_role_assignments_userId_revokedAt_idx" ON "admin_role_assignments"("userId", "revokedAt");
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "security_events" (
  "id" TEXT NOT NULL, "actorId" TEXT, "userId" TEXT, "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info', "result" TEXT NOT NULL DEFAULT 'success',
  "requestId" TEXT, "sessionId" TEXT, "ip" TEXT, "userAgent" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

CREATE TABLE "account_deletion_requests" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "requestedById" TEXT NOT NULL,
  "approvedById" TEXT, "reason" TEXT NOT NULL, "status" "DeletionRequestStatus" NOT NULL DEFAULT 'requested',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "metadata" JSONB,
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "account_deletion_requests_userId_status_idx" ON "account_deletion_requests"("userId", "status");

CREATE TABLE "plan_versions" (
  "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "priceMonthly" INTEGER, "priceYearly" INTEGER, "currency" TEXT NOT NULL,
  "quotas" JSONB NOT NULL, "features" JSONB NOT NULL, "fallbackRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT, "reason" TEXT,
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plan_versions_planId_version_key" ON "plan_versions"("planId", "version");
CREATE INDEX "plan_versions_planId_effectiveFrom_idx" ON "plan_versions"("planId", "effectiveFrom");
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "plan_versions" ("id", "planId", "version", "priceMonthly", "priceYearly", "currency", "quotas", "features", "fallbackRatio")
SELECT 'v1-' || "id", "id", 1, "priceMonthly", "priceYearly", "currency", "quotas", "features", "fallbackRatio" FROM "plans"
ON CONFLICT ("planId", "version") DO NOTHING;

CREATE TABLE "quota_cycles" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "subscriptionId" TEXT, "planSlug" TEXT NOT NULL,
  "planVersion" INTEGER NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "QuotaCycleStatus" NOT NULL DEFAULT 'ACTIVE', "source" TEXT NOT NULL, "predecessorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" TIMESTAMP(3),
  CONSTRAINT "quota_cycles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quota_cycles_userId_startsAt_endsAt_key" ON "quota_cycles"("userId", "startsAt", "endsAt");
CREATE INDEX "quota_cycles_userId_status_startsAt_endsAt_idx" ON "quota_cycles"("userId", "status", "startsAt", "endsAt");
ALTER TABLE "quota_cycles" ADD CONSTRAINT "quota_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quota_accounts" (
  "id" TEXT NOT NULL, "cycleId" TEXT NOT NULL, "resource" "QuotaResource" NOT NULL,
  "primaryLimit" INTEGER, "fallbackLimit" INTEGER NOT NULL DEFAULT 0,
  "primaryUsed" INTEGER NOT NULL DEFAULT 0, "fallbackUsed" INTEGER NOT NULL DEFAULT 0,
  "state" "QuotaState" NOT NULL DEFAULT 'PRIMARY', "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quota_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quota_accounts_cycleId_resource_key" ON "quota_accounts"("cycleId", "resource");
ALTER TABLE "quota_accounts" ADD CONSTRAINT "quota_accounts_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "quota_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quota_reservations" (
  "id" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "userId" TEXT NOT NULL, "cycleId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL, "resource" "QuotaResource" NOT NULL, "feature" TEXT NOT NULL,
  "requestedUnits" INTEGER NOT NULL, "primaryUnits" INTEGER NOT NULL DEFAULT 0, "fallbackUnits" INTEGER NOT NULL DEFAULT 0,
  "actualUnits" INTEGER, "status" "QuotaReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "quota_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quota_reservations_userId_idempotencyKey_key" ON "quota_reservations"("userId", "idempotencyKey");
CREATE INDEX "quota_reservations_userId_createdAt_idx" ON "quota_reservations"("userId", "createdAt");
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "quota_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "quota_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "usage_ledger" (
  "id" TEXT NOT NULL, "reservationId" TEXT, "userId" TEXT NOT NULL, "cycleId" TEXT NOT NULL,
  "resource" "QuotaResource" NOT NULL, "event" "UsageLedgerEvent" NOT NULL,
  "primaryDelta" INTEGER NOT NULL DEFAULT 0, "fallbackDelta" INTEGER NOT NULL DEFAULT 0,
  "actualUnits" INTEGER, "actorId" TEXT, "reason" TEXT, "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usage_ledger_idempotencyKey_key" ON "usage_ledger"("idempotencyKey");
CREATE INDEX "usage_ledger_userId_cycleId_resource_createdAt_idx" ON "usage_ledger"("userId", "cycleId", "resource", "createdAt");
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "quota_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_usage" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "subscriptionId" TEXT, "planSlug" TEXT NOT NULL,
  "planVersion" INTEGER NOT NULL, "feature" TEXT NOT NULL, "resource" "QuotaResource" NOT NULL,
  "provider" TEXT NOT NULL, "model" TEXT, "requestId" TEXT NOT NULL, "internalOperationId" TEXT NOT NULL,
  "status" TEXT NOT NULL, "inputTokens" INTEGER, "outputTokens" INTEGER, "cachedTokens" INTEGER,
  "audioInputSeconds" INTEGER, "audioOutputSeconds" INTEGER, "pages" INTEGER, "searchCount" INTEGER,
  "providerCostMinor" INTEGER, "providerCurrency" TEXT, "pricingVersion" TEXT, "latencyMs" INTEGER,
  "metadata" JSONB, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "reservationId" TEXT,
  CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_usage_internalOperationId_key" ON "provider_usage"("internalOperationId");
CREATE UNIQUE INDEX "provider_usage_reservationId_key" ON "provider_usage"("reservationId");
CREATE INDEX "provider_usage_userId_startedAt_idx" ON "provider_usage"("userId", "startedAt");
CREATE INDEX "provider_usage_provider_model_startedAt_idx" ON "provider_usage"("provider", "model", "startedAt");
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "quota_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_pricing" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL, "version" TEXT NOT NULL,
  "currency" TEXT NOT NULL, "inputTokenPrice" DOUBLE PRECISION, "outputTokenPrice" DOUBLE PRECISION,
  "audioSecondPrice" DOUBLE PRECISION, "pagePrice" DOUBLE PRECISION, "searchPrice" DOUBLE PRECISION,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_pricing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_pricing_provider_model_version_key" ON "provider_pricing"("provider", "model", "version");

CREATE TABLE "entitlement_overrides" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "key" TEXT NOT NULL,
  "value" JSONB NOT NULL, "reason" TEXT NOT NULL, "grantedById" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "entitlement_overrides_userId_startsAt_endsAt_revokedAt_idx" ON "entitlement_overrides"("userId", "startsAt", "endsAt", "revokedAt");
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
