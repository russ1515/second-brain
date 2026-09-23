-- Sprint 5: safe Error Event telemetry, Bug Groups and support/incident foundations.
-- This migration is additive.  It neither alters quotas/plans/providers nor
-- changes historical Sprint 1–4 data.

ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'identified';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'monitoring';

CREATE TYPE "ErrorEventSource" AS ENUM ('frontend', 'backend', 'provider', 'worker', 'payment', 'mail', 'quota', 'database', 'redis', 'qdrant', 'security');
CREATE TYPE "ErrorSeverity" AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE "BugStatus" AS ENUM ('new', 'triaged', 'investigating', 'fix_in_progress', 'fixed', 'monitoring', 'resolved', 'reopened', 'wont_fix', 'duplicate');
CREATE TYPE "ReportCorrelationStatus" AS ENUM ('independent', 'suggested', 'linked');
CREATE TYPE "SupportCaseStatus" AS ENUM ('open', 'in_progress', 'waiting_for_user', 'waiting_for_engineering', 'resolved', 'closed');
CREATE TYPE "SupportCasePriority" AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE "DiagnosticKind" AS ENUM ('rule_based', 'ai_assisted');
CREATE TYPE "DiagnosticStatus" AS ENUM ('available', 'not_available', 'not_instrumented');
CREATE TYPE "DiagnosticConfidence" AS ENUM ('unconfirmed', 'low', 'medium', 'high');
CREATE TYPE "IncidentTimelineType" AS ENUM ('created', 'status_changed', 'bug_linked', 'note_added', 'acknowledged');

ALTER TABLE "incidents"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "identifiedAt" TIMESTAMP(3),
  ADD COLUMN "monitoringAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "reports"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "operationId" TEXT,
  ADD COLUMN "route" TEXT,
  ADD COLUMN "feature" TEXT,
  ADD COLUMN "appVersion" TEXT,
  ADD COLUMN "buildVersion" TEXT,
  ADD COLUMN "platform" TEXT,
  ADD COLUMN "environment" TEXT,
  ADD COLUMN "consentAdditionalDiagnostics" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "correlationStatus" "ReportCorrelationStatus" NOT NULL DEFAULT 'independent',
  ADD COLUMN "correlationConfidence" "DiagnosticConfidence" NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN "bugGroupId" TEXT,
  ADD COLUMN "linkedAt" TIMESTAMP(3),
  ADD COLUMN "linkedById" TEXT;

CREATE TABLE "error_events" (
  "id" TEXT NOT NULL,
  "ingestId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment" TEXT NOT NULL,
  "source" "ErrorEventSource" NOT NULL,
  "severity" "ErrorSeverity" NOT NULL DEFAULT 'medium',
  "errorCode" TEXT,
  "errorType" TEXT,
  "messageSanitized" TEXT,
  "stackFingerprint" TEXT,
  "stackDetailSanitized" TEXT,
  "fingerprint" TEXT NOT NULL,
  "fingerprintVersion" INTEGER NOT NULL DEFAULT 1,
  "userId" TEXT,
  "sessionId" TEXT,
  "requestId" TEXT,
  "operationId" TEXT,
  "route" TEXT,
  "feature" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "appVersion" TEXT,
  "buildVersion" TEXT,
  "platform" TEXT,
  "deviceMetadataSanitized" JSONB,
  "quotaState" "QuotaState",
  "planSlug" TEXT,
  "httpStatus" INTEGER,
  "latencyMs" INTEGER,
  "retryAttempt" INTEGER,
  "metadataSanitized" JSONB,
  "providerUsageAttemptId" TEXT,
  "bugGroupId" TEXT,
  "incidentId" TEXT,
  CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_groups" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "fingerprintVersion" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "status" "BugStatus" NOT NULL DEFAULT 'new',
  "severity" "ErrorSeverity" NOT NULL DEFAULT 'medium',
  "source" "ErrorEventSource" NOT NULL,
  "feature" TEXT,
  "firstSeen" TIMESTAMP(3) NOT NULL,
  "lastSeen" TIMESTAMP(3) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
  "affectedUsersCount" INTEGER NOT NULL DEFAULT 0,
  "incidentId" TEXT,
  "assignedToId" TEXT,
  "duplicateOfId" TEXT,
  "fixReference" TEXT,
  "targetRelease" TEXT,
  "resolutionNote" TEXT,
  "securityReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bug_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_affected_users" (
  "bugGroupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
  "firstAffectedAt" TIMESTAMP(3) NOT NULL,
  "lastAffectedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bug_affected_users_pkey" PRIMARY KEY ("bugGroupId", "userId")
);

CREATE TABLE "bug_comments" (
  "id" TEXT NOT NULL,
  "bugGroupId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bug_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_cases" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reportId" TEXT,
  "bugGroupId" TEXT,
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'open',
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'medium',
  "assignedToId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_case_notes" (
  "id" TEXT NOT NULL,
  "supportCaseId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_case_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incident_timeline_events" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "IncidentTimelineType" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_diagnostics" (
  "id" TEXT NOT NULL,
  "bugGroupId" TEXT NOT NULL,
  "kind" "DiagnosticKind" NOT NULL,
  "status" "DiagnosticStatus" NOT NULL DEFAULT 'available',
  "confidence" "DiagnosticConfidence" NOT NULL DEFAULT 'unconfirmed',
  "observed" JSONB,
  "correlated" JSONB,
  "hypotheses" JSONB,
  "evidence" JSONB,
  "nextChecks" JSONB,
  "providerOperationId" TEXT,
  "requestedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bug_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "error_events_environment_ingestId_key" ON "error_events"("environment", "ingestId");
CREATE INDEX "error_events_fingerprint_occurredAt_idx" ON "error_events"("fingerprint", "occurredAt");
CREATE INDEX "error_events_bugGroupId_occurredAt_idx" ON "error_events"("bugGroupId", "occurredAt");
CREATE INDEX "error_events_requestId_occurredAt_idx" ON "error_events"("requestId", "occurredAt");
CREATE INDEX "error_events_operationId_occurredAt_idx" ON "error_events"("operationId", "occurredAt");
CREATE INDEX "error_events_userId_occurredAt_idx" ON "error_events"("userId", "occurredAt");
CREATE INDEX "error_events_source_occurredAt_idx" ON "error_events"("source", "occurredAt");
CREATE INDEX "error_events_provider_model_occurredAt_idx" ON "error_events"("provider", "model", "occurredAt");
CREATE INDEX "error_events_appVersion_buildVersion_occurredAt_idx" ON "error_events"("appVersion", "buildVersion", "occurredAt");
CREATE UNIQUE INDEX "bug_groups_environment_fingerprintVersion_fingerprint_key" ON "bug_groups"("environment", "fingerprintVersion", "fingerprint");
CREATE INDEX "bug_groups_status_severity_lastSeen_idx" ON "bug_groups"("status", "severity", "lastSeen");
CREATE INDEX "bug_groups_incidentId_status_idx" ON "bug_groups"("incidentId", "status");
CREATE INDEX "bug_groups_assignedToId_status_updatedAt_idx" ON "bug_groups"("assignedToId", "status", "updatedAt");
CREATE INDEX "bug_affected_users_bugGroupId_lastAffectedAt_idx" ON "bug_affected_users"("bugGroupId", "lastAffectedAt");
CREATE INDEX "bug_comments_bugGroupId_createdAt_idx" ON "bug_comments"("bugGroupId", "createdAt");
CREATE INDEX "support_cases_status_assignedToId_updatedAt_idx" ON "support_cases"("status", "assignedToId", "updatedAt");
CREATE INDEX "support_cases_userId_status_idx" ON "support_cases"("userId", "status");
CREATE INDEX "support_cases_bugGroupId_status_idx" ON "support_cases"("bugGroupId", "status");
CREATE INDEX "support_case_notes_supportCaseId_createdAt_idx" ON "support_case_notes"("supportCaseId", "createdAt");
CREATE INDEX "incident_timeline_events_incidentId_createdAt_idx" ON "incident_timeline_events"("incidentId", "createdAt");
CREATE INDEX "bug_diagnostics_bugGroupId_createdAt_idx" ON "bug_diagnostics"("bugGroupId", "createdAt");
CREATE INDEX "incidents_assignedToId_status_updatedAt_idx" ON "incidents"("assignedToId", "status", "updatedAt");
CREATE INDEX "reports_reporterId_createdAt_idx" ON "reports"("reporterId", "createdAt");
CREATE INDEX "reports_requestId_createdAt_idx" ON "reports"("requestId", "createdAt");
CREATE INDEX "reports_bugGroupId_status_idx" ON "reports"("bugGroupId", "status");

ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_providerUsageAttemptId_fkey" FOREIGN KEY ("providerUsageAttemptId") REFERENCES "provider_usage_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_groups" ADD CONSTRAINT "bug_groups_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_groups" ADD CONSTRAINT "bug_groups_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_groups" ADD CONSTRAINT "bug_groups_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "bug_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_affected_users" ADD CONSTRAINT "bug_affected_users_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_affected_users" ADD CONSTRAINT "bug_affected_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_case_notes" ADD CONSTRAINT "support_case_notes_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_notes" ADD CONSTRAINT "support_case_notes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_diagnostics" ADD CONSTRAINT "bug_diagnostics_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_diagnostics" ADD CONSTRAINT "bug_diagnostics_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_bugGroupId_fkey" FOREIGN KEY ("bugGroupId") REFERENCES "bug_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
