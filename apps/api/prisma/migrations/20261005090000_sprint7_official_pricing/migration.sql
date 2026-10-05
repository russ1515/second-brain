-- Sprint 7: activate the official public catalog without changing entitlement
-- configuration or any customer/billing/quota history. This migration is
-- intentionally data-only and additive: it appends plan snapshots and audits.

DO $$
DECLARE
  plan_record RECORD;
  next_version INTEGER;
BEGIN
  FOR plan_record IN
    SELECT
      p.*,
      CASE p."slug"
        WHEN 'free' THEN 0
        WHEN 'pro' THEN 499
        WHEN 'pro_max' THEN 1500
      END AS target_monthly,
      CASE p."slug"
        WHEN 'free' THEN 0
        WHEN 'pro' THEN 4900
        WHEN 'pro_max' THEN 15000
      END AS target_yearly
    FROM "plans" AS p
    WHERE p."isActive" = true
      AND p."slug" IN ('free', 'pro', 'pro_max')
      AND (
        p."priceMonthly" IS DISTINCT FROM CASE p."slug"
          WHEN 'free' THEN 0
          WHEN 'pro' THEN 499
          WHEN 'pro_max' THEN 1500
        END
        OR p."priceYearly" IS DISTINCT FROM CASE p."slug"
          WHEN 'free' THEN 0
          WHEN 'pro' THEN 4900
          WHEN 'pro_max' THEN 15000
        END
        OR p."currency" IS DISTINCT FROM 'usd'
      )
    FOR UPDATE
  LOOP
    SELECT GREATEST(
      COALESCE(plan_record."configurationVersion", 0),
      COALESCE(MAX("version"), 0)
    ) + 1
    INTO next_version
    FROM "plan_versions"
    WHERE "planId" = plan_record."id";

    -- A new snapshot is the only new source of truth for future plan reads.
    -- Existing subscription and quota-cycle snapshots remain untouched.
    UPDATE "plan_versions"
    SET "effectiveTo" = CURRENT_TIMESTAMP
    WHERE "planId" = plan_record."id"
      AND "effectiveTo" IS NULL;

    INSERT INTO "plan_versions" (
      "id", "planId", "version", "priceMonthly", "priceYearly", "currency",
      "quotas", "features", "fallbackRatio", "effectiveFrom", "publishedAt",
      "createdById", "reason"
    ) VALUES (
      'sprint7-pricing-' || plan_record."id" || '-v' || next_version::TEXT,
      plan_record."id",
      next_version,
      plan_record.target_monthly,
      plan_record.target_yearly,
      'usd',
      plan_record."quotas",
      plan_record."features",
      plan_record."fallbackRatio",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      NULL,
      'Sprint 7 official public pricing activation'
    );

    UPDATE "plans"
    SET
      "priceMonthly" = plan_record.target_monthly,
      "priceYearly" = plan_record.target_yearly,
      "currency" = 'usd',
      "configurationVersion" = next_version,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = plan_record."id";

    INSERT INTO "audit_logs" (
      "id", "actorId", "action", "detail", "actorRole", "targetType", "targetId",
      "before", "after", "reason", "result", "metadata", "createdAt"
    ) VALUES (
      'sprint7-pricing-audit-' || plan_record."id" || '-v' || next_version::TEXT,
      NULL,
      'plan.pricing.activate_sprint7',
      'Official public catalog pricing activated through an additive migration',
      'SYSTEM',
      'Plan',
      plan_record."id",
      jsonb_build_object(
        'priceMonthly', plan_record."priceMonthly",
        'priceYearly', plan_record."priceYearly",
        'currency', plan_record."currency",
        'configurationVersion', plan_record."configurationVersion"
      ),
      jsonb_build_object(
        'priceMonthly', plan_record.target_monthly,
        'priceYearly', plan_record.target_yearly,
        'currency', 'usd',
        'configurationVersion', next_version
      ),
      'Sprint 7 official public pricing activation',
      'success',
      jsonb_build_object(
        'migration', '20261005090000_sprint7_official_pricing',
        'preservedConfiguration', jsonb_build_object(
          'quotas', true,
          'features', true,
          'fallbackRatio', true,
          'subscriptionHistory', true,
          'quotaHistory', true,
          'paymentHistory', true
        )
      ),
      CURRENT_TIMESTAMP
    );
  END LOOP;
END $$;
