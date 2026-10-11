-- Lot 2 language mastery: durable failed-exam -> targeted-remediation ->
-- retest provenance, plus idempotent assessment creation before journal bind.
-- Additive only; existing attempts/evidence stay readable.

BEGIN;

CREATE TYPE "LanguageMasteryRemediationPlanStatus" AS ENUM (
    'preparing',
    'active',
    'ready_for_retest',
    'retest_started',
    'completed'
);

ALTER TABLE "assessments"
    ADD COLUMN "masteryCreationKey" TEXT,
    ADD COLUMN "masteryCreationHash" TEXT,
    ADD COLUMN "masteryGenerationStatus" TEXT,
    ADD COLUMN "masteryGenerationClaimedAt" TIMESTAMP(3);

ALTER TABLE "assessment_submissions"
    ADD COLUMN "masterySubmissionKey" TEXT,
    ADD COLUMN "masterySubmissionHash" TEXT,
    ADD COLUMN "masteryGenerationStatus" TEXT,
    ADD COLUMN "masteryGenerationClaimedAt" TIMESTAMP(3);

ALTER TABLE "lessons"
    ADD COLUMN "masteryRemediationGenerationKey" TEXT;

CREATE TABLE "language_mastery_remediation_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageProfileId" TEXT NOT NULL,
    "failedAttemptId" TEXT NOT NULL,
    "remediationLessonId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "generationKey" TEXT NOT NULL,
    "startHash" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "masteryContentVersion" TEXT,
    "requiredExerciseCount" INTEGER NOT NULL,
    "status" "LanguageMasteryRemediationPlanStatus" NOT NULL DEFAULT 'preparing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lessonBoundAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "language_mastery_remediation_plans_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "language_mastery_remediation_evidence"
    ADD COLUMN "remediationPlanId" TEXT;

CREATE UNIQUE INDEX "assessments_userId_masteryCreationKey_key"
    ON "assessments"("userId", "masteryCreationKey");
CREATE UNIQUE INDEX "assessment_submissions_userId_masterySubmissionKey_key"
    ON "assessment_submissions"("userId", "masterySubmissionKey");
CREATE UNIQUE INDEX "lessons_userId_masteryRemediationGenerationKey_key"
    ON "lessons"("userId", "masteryRemediationGenerationKey");
CREATE UNIQUE INDEX "language_mastery_remediation_plans_failedAttemptId_key"
    ON "language_mastery_remediation_plans"("failedAttemptId");
CREATE UNIQUE INDEX "language_mastery_remediation_plans_remediationLessonId_key"
    ON "language_mastery_remediation_plans"("remediationLessonId");
CREATE UNIQUE INDEX "language_mastery_remediation_plans_userId_generationKey_key"
    ON "language_mastery_remediation_plans"("userId", "generationKey");
CREATE UNIQUE INDEX "language_mastery_remediation_plans_userId_scopeKey_idempotencyKey_key"
    ON "language_mastery_remediation_plans"("userId", "scopeKey", "idempotencyKey");
CREATE INDEX "language_mastery_remediation_plans_userId_languageProfileId_status_idx"
    ON "language_mastery_remediation_plans"("userId", "languageProfileId", "status");
CREATE INDEX "language_mastery_remediation_plans_languageProfileId_idx"
    ON "language_mastery_remediation_plans"("languageProfileId");
ALTER TABLE "language_mastery_attempts"
    ADD COLUMN "remediationPlanId" TEXT;
CREATE INDEX "language_mastery_attempts_remediationPlanId_startedAt_idx"
    ON "language_mastery_attempts"("remediationPlanId", "startedAt");
CREATE UNIQUE INDEX "language_mastery_remediation_evidence_userId_remediationPlanId_lessonId_sourceContentVersion_exerciseIndex_key"
    ON "language_mastery_remediation_evidence"(
        "userId",
        "remediationPlanId",
        "lessonId",
        "sourceContentVersion",
        "exerciseIndex"
    );
CREATE INDEX "language_mastery_remediation_evidence_remediationPlanId_idx"
    ON "language_mastery_remediation_evidence"("remediationPlanId");

ALTER TABLE "language_mastery_remediation_plans"
    ADD CONSTRAINT "language_mastery_remediation_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_remediation_plans"
    ADD CONSTRAINT "language_mastery_remediation_plans_languageProfileId_fkey"
    FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_remediation_plans"
    ADD CONSTRAINT "language_mastery_remediation_plans_failedAttemptId_fkey"
    FOREIGN KEY ("failedAttemptId") REFERENCES "language_mastery_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_remediation_plans"
    ADD CONSTRAINT "language_mastery_remediation_plans_remediationLessonId_fkey"
    FOREIGN KEY ("remediationLessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts"
    ADD CONSTRAINT "language_mastery_attempts_remediationPlanId_fkey"
    FOREIGN KEY ("remediationPlanId") REFERENCES "language_mastery_remediation_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "language_mastery_remediation_evidence"
    ADD CONSTRAINT "language_mastery_remediation_evidence_remediationPlanId_fkey"
    FOREIGN KEY ("remediationPlanId") REFERENCES "language_mastery_remediation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A canonical mastery proof may be reviewable without being immediately due.
-- Existing rows remain scheduled for backwards compatibility; no synthetic
-- future date is introduced for non-scheduled proofs.
ALTER TABLE "reviewables"
    ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "reviewables_userId_isScheduled_due_idx"
    ON "reviewables"("userId", "isScheduled", "due");

COMMIT;
