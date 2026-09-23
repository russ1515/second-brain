-- Sprint 4: additive provider usage, pricing and cost-control foundation.
--
-- The legacy provider_usage table is intentionally retained for backwards
-- compatibility.  The immutable operation/attempt ledger below is the new
-- financial source of truth and supports retries and provider fallbacks.

CREATE TYPE "ProviderUsageOperationStatus" AS ENUM (
  'STARTED', 'SUCCEEDED', 'FAILED', 'FINALIZATION_PENDING', 'BLOCKED'
);
CREATE TYPE "ProviderUsageAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ProviderCostStatus" AS ENUM (
  'MEASURED', 'ESTIMATED', 'UNKNOWN', 'NOT_AVAILABLE', 'NOT_INSTRUMENTED'
);
CREATE TYPE "ProviderPricingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "ProviderCostAdjustmentKind" AS ENUM ('CORRECTION', 'RECONCILIATION');

CREATE TABLE "provider_usage_operations" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestId" TEXT,
  "userId" TEXT,
  "subscriptionId" TEXT,
  "planSlug" TEXT,
  "planVersion" INTEGER,
  "feature" TEXT NOT NULL,
  "resource" "QuotaResource",
  "quotaReservationId" TEXT,
  "quotaState" "QuotaState",
  "status" "ProviderUsageOperationStatus" NOT NULL DEFAULT 'STARTED',
  "unattributedReason" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "provider_usage_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_usage_operations_idempotencyKey_key" ON "provider_usage_operations"("idempotencyKey");
CREATE INDEX "provider_usage_operations_startedAt_status_idx" ON "provider_usage_operations"("startedAt", "status");
CREATE INDEX "provider_usage_operations_userId_startedAt_idx" ON "provider_usage_operations"("userId", "startedAt");
CREATE INDEX "provider_usage_operations_planSlug_feature_startedAt_idx" ON "provider_usage_operations"("planSlug", "feature", "startedAt");
CREATE INDEX "provider_usage_operations_quotaState_startedAt_idx" ON "provider_usage_operations"("quotaState", "startedAt");
ALTER TABLE "provider_usage_operations"
  ADD CONSTRAINT "provider_usage_operations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_operations"
  ADD CONSTRAINT "provider_usage_operations_quotaReservationId_fkey"
  FOREIGN KEY ("quotaReservationId") REFERENCES "quota_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_usage_attempts" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "attemptId" TEXT NOT NULL,
  "providerRequestId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "status" "ProviderUsageAttemptStatus" NOT NULL DEFAULT 'STARTED',
  "costStatus" "ProviderCostStatus" NOT NULL DEFAULT 'NOT_INSTRUMENTED',
  "measurementSource" TEXT NOT NULL DEFAULT 'PROVIDER',
  "inputTokens" INTEGER,
  "cachedInputTokens" INTEGER,
  "outputTokens" INTEGER,
  "reasoningTokens" INTEGER,
  "audioInputSeconds" INTEGER,
  "audioOutputSeconds" INTEGER,
  "ocrPages" INTEGER,
  "visionCalls" INTEGER,
  "embeddingUnits" INTEGER,
  "searchUnits" INTEGER,
  "otherUnits" INTEGER,
  "originalAmount" DECIMAL(20,12),
  "originalCurrency" TEXT,
  "referenceAmountUsd" DECIMAL(20,12),
  "fxRate" DECIMAL(20,12),
  "fxRateSource" TEXT,
  "fxRateTimestamp" TIMESTAMP(3),
  "pricingVersionId" TEXT,
  "pricingVersion" TEXT,
  "pricingSnapshot" JSONB,
  "latencyMs" INTEGER,
  "errorCode" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  CONSTRAINT "provider_usage_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_usage_attempts_non_negative_units" CHECK (
    ("attemptNumber" >= 1) AND
    ("inputTokens" IS NULL OR "inputTokens" >= 0) AND
    ("cachedInputTokens" IS NULL OR "cachedInputTokens" >= 0) AND
    ("outputTokens" IS NULL OR "outputTokens" >= 0) AND
    ("reasoningTokens" IS NULL OR "reasoningTokens" >= 0) AND
    ("audioInputSeconds" IS NULL OR "audioInputSeconds" >= 0) AND
    ("audioOutputSeconds" IS NULL OR "audioOutputSeconds" >= 0) AND
    ("ocrPages" IS NULL OR "ocrPages" >= 0) AND
    ("visionCalls" IS NULL OR "visionCalls" >= 0) AND
    ("embeddingUnits" IS NULL OR "embeddingUnits" >= 0) AND
    ("searchUnits" IS NULL OR "searchUnits" >= 0) AND
    ("otherUnits" IS NULL OR "otherUnits" >= 0) AND
    ("latencyMs" IS NULL OR "latencyMs" >= 0)
  )
);
CREATE UNIQUE INDEX "provider_usage_attempts_attemptId_key" ON "provider_usage_attempts"("attemptId");
CREATE UNIQUE INDEX "provider_usage_attempts_providerRequestId_key" ON "provider_usage_attempts"("providerRequestId");
CREATE UNIQUE INDEX "provider_usage_attempts_operationId_attemptNumber_key" ON "provider_usage_attempts"("operationId", "attemptNumber");
CREATE INDEX "provider_usage_attempts_provider_model_startedAt_idx" ON "provider_usage_attempts"("provider", "model", "startedAt");
CREATE INDEX "provider_usage_attempts_costStatus_startedAt_idx" ON "provider_usage_attempts"("costStatus", "startedAt");
CREATE INDEX "provider_usage_attempts_operationId_startedAt_idx" ON "provider_usage_attempts"("operationId", "startedAt");
ALTER TABLE "provider_usage_attempts"
  ADD CONSTRAINT "provider_usage_attempts_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "provider_usage_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "provider_cost_adjustments" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "attemptId" TEXT,
  "kind" "ProviderCostAdjustmentKind" NOT NULL,
  "amountDeltaUsd" DECIMAL(20,12),
  "originalAmount" DECIMAL(20,12),
  "originalCurrency" TEXT,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_cost_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "provider_cost_adjustments_operationId_createdAt_idx" ON "provider_cost_adjustments"("operationId", "createdAt");
CREATE INDEX "provider_cost_adjustments_attemptId_createdAt_idx" ON "provider_cost_adjustments"("attemptId", "createdAt");
ALTER TABLE "provider_cost_adjustments"
  ADD CONSTRAINT "provider_cost_adjustments_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "provider_usage_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_cost_adjustments"
  ADD CONSTRAINT "provider_cost_adjustments_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "provider_usage_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_pricing_versions" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "ProviderPricingStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL,
  "inputTokenPrice" DECIMAL(20,12),
  "cachedInputTokenPrice" DECIMAL(20,12),
  "outputTokenPrice" DECIMAL(20,12),
  "reasoningTokenPrice" DECIMAL(20,12),
  "audioInputSecondPrice" DECIMAL(20,12),
  "audioOutputSecondPrice" DECIMAL(20,12),
  "ocrPagePrice" DECIMAL(20,12),
  "visionCallPrice" DECIMAL(20,12),
  "embeddingUnitPrice" DECIMAL(20,12),
  "searchUnitPrice" DECIMAL(20,12),
  "otherUnitPrice" DECIMAL(20,12),
  "otherUnitName" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "sourceReference" TEXT,
  "createdById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_pricing_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_pricing_versions_valid_window" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE UNIQUE INDEX "provider_pricing_versions_provider_model_version_key" ON "provider_pricing_versions"("provider", "model", "version");
CREATE INDEX "provider_pricing_versions_provider_model_status_effectiveFrom_idx" ON "provider_pricing_versions"("provider", "model", "status", "effectiveFrom");

CREATE TABLE "provider_cost_budgets" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeKey" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthlyAmountUsd" DECIMAL(20,12) NOT NULL,
  "warningPercent" INTEGER NOT NULL DEFAULT 80,
  "criticalPercent" INTEGER NOT NULL DEFAULT 100,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_cost_budgets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_cost_budgets_valid_thresholds" CHECK (
    "monthlyAmountUsd" >= 0 AND "warningPercent" BETWEEN 0 AND 100 AND
    "criticalPercent" BETWEEN "warningPercent" AND 100
  )
);
CREATE INDEX "provider_cost_budgets_scope_scopeKey_active_idx" ON "provider_cost_budgets"("scope", "scopeKey", "active");
