-- Sprint 2 Control Center: bounded UTC range aggregates over platform data.
-- Additive indexes only; no commercial, quota, or user data is changed.
CREATE INDEX "users_lastActiveAt_idx" ON "users"("lastActiveAt");
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX "quota_cycles_status_startsAt_endsAt_idx" ON "quota_cycles"("status", "startsAt", "endsAt");
CREATE INDEX "provider_usage_startedAt_resource_status_idx" ON "provider_usage"("startedAt", "resource", "status");
