-- Sprint 5 follow-up: keep report-submission idempotency distinct from the
-- prior failing request used for evidence-only correlation.
ALTER TABLE "reports" ADD COLUMN "observedRequestId" TEXT;
CREATE INDEX "reports_observedRequestId_createdAt_idx" ON "reports"("observedRequestId", "createdAt");
