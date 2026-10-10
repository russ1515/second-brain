-- Lot 2 language mastery: additive, owner-scoped attempt journal.
-- Existing assessments, submissions, completions and course JSON remain valid.

CREATE TYPE "LanguageMasteryScopeKind" AS ENUM ('unit_autonomy', 'milestone', 'pillar_exam');
CREATE TYPE "LanguageMasteryAttemptVerdict" AS ENUM ('mastered', 'not_mastered', 'not_evaluable');
CREATE TYPE "LanguageMasteryAttemptStatus" AS ENUM ('started', 'assessment_bound', 'evaluated');
CREATE TYPE "LanguageMasteryRemediationState" AS ENUM ('completed', 'incomplete', 'technical_error', 'not_evaluable');

CREATE TABLE "language_mastery_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageProfileId" TEXT NOT NULL,
    "experienceSessionId" TEXT,
    "lessonId" TEXT,
    "assessmentId" TEXT,
    "assessmentSubmissionId" TEXT,
    "attemptId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scopeKind" "LanguageMasteryScopeKind" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "masteryContentVersion" TEXT,
    "contentDefinitionId" TEXT,
    "sourceContentVersion" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "pillar" TEXT,
    "status" "LanguageMasteryAttemptStatus" NOT NULL DEFAULT 'started',
    "verdict" "LanguageMasteryAttemptVerdict",
    "rawScore" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION NOT NULL,
    "decisionReason" TEXT,
    "helpUsed" BOOLEAN NOT NULL DEFAULT false,
    "decision" JSONB,
    "criteria" JSONB,
    "startHash" TEXT NOT NULL,
    "decisionHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "language_mastery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "language_mastery_remediation_evidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageMasteryAttemptId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "trainingFormat" TEXT NOT NULL,
    "state" "LanguageMasteryRemediationState" NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sourceContentVersion" INTEGER NOT NULL,
    "exerciseIndex" INTEGER NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "language_mastery_remediation_evidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "learning_completions" ADD COLUMN "languageMasteryAttemptId" TEXT;

CREATE UNIQUE INDEX "language_mastery_attempts_assessmentId_key" ON "language_mastery_attempts"("assessmentId");
CREATE UNIQUE INDEX "language_mastery_attempts_assessmentSubmissionId_key" ON "language_mastery_attempts"("assessmentSubmissionId");
CREATE UNIQUE INDEX "language_mastery_attempts_userId_attemptId_key" ON "language_mastery_attempts"("userId", "attemptId");
CREATE UNIQUE INDEX "language_mastery_attempts_userId_scopeKey_idempotencyKey_key" ON "language_mastery_attempts"("userId", "scopeKey", "idempotencyKey");
CREATE INDEX "language_mastery_attempts_userId_languageProfileId_evaluatedAt_idx" ON "language_mastery_attempts"("userId", "languageProfileId", "evaluatedAt");
CREATE INDEX "language_mastery_attempts_userId_scopeKey_evaluatedAt_idx" ON "language_mastery_attempts"("userId", "scopeKey", "evaluatedAt");
CREATE INDEX "language_mastery_attempts_mappingVersion_policyVersion_idx" ON "language_mastery_attempts"("mappingVersion", "policyVersion");

CREATE UNIQUE INDEX "language_mastery_remediation_evidence_userId_evidenceId_key" ON "language_mastery_remediation_evidence"("userId", "evidenceId");
CREATE UNIQUE INDEX "language_mastery_remediation_evidence_userId_sourceKind_sourceRefId_key" ON "language_mastery_remediation_evidence"("userId", "sourceKind", "sourceRefId");
CREATE UNIQUE INDEX "language_mastery_remediation_evidence_userId_languageMasteryAttemptId_lessonId_sourceContentVersion_exerciseIndex_key" ON "language_mastery_remediation_evidence"("userId", "languageMasteryAttemptId", "lessonId", "sourceContentVersion", "exerciseIndex");
CREATE INDEX "language_mastery_remediation_evidence_languageMasteryAttemptId_recordedAt_idx" ON "language_mastery_remediation_evidence"("languageMasteryAttemptId", "recordedAt");
CREATE UNIQUE INDEX "learning_completions_languageMasteryAttemptId_key" ON "learning_completions"("languageMasteryAttemptId");

ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_languageProfileId_fkey" FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_experienceSessionId_fkey" FOREIGN KEY ("experienceSessionId") REFERENCES "experience_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "language_mastery_attempts" ADD CONSTRAINT "language_mastery_attempts_assessmentSubmissionId_fkey" FOREIGN KEY ("assessmentSubmissionId") REFERENCES "assessment_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "language_mastery_remediation_evidence" ADD CONSTRAINT "language_mastery_remediation_evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "language_mastery_remediation_evidence" ADD CONSTRAINT "language_mastery_remediation_evidence_languageMasteryAttemptId_fkey" FOREIGN KEY ("languageMasteryAttemptId") REFERENCES "language_mastery_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_completions" ADD CONSTRAINT "learning_completions_languageMasteryAttemptId_fkey" FOREIGN KEY ("languageMasteryAttemptId") REFERENCES "language_mastery_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
