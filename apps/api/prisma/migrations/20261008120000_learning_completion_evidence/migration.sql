-- Canonical, additive learning-completion evidence.
-- Intentionally no legacy backfill: historical generated/opened/completed rows
-- cannot be upgraded to verified evidence without an observable proof.

CREATE TYPE "LearningCompletionKind" AS ENUM ('lesson', 'language_unit');
CREATE TYPE "LearningCompletionStatus" AS ENUM ('verified', 'revoked');
CREATE TYPE "LearningEvidenceSourceKind" AS ENUM ('exercise_attempt', 'assessment_submission', 'language_capability');

ALTER TABLE "lessons"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

-- Snapshot the exact lesson version evaluated by every existing/future attempt.
-- Existing attempts belong to the only pre-migration version (1).
ALTER TABLE "exercise_attempts"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "assessments"
ADD COLUMN "lessonId" TEXT,
ADD COLUMN "contentVersion" INTEGER;

CREATE TABLE "learning_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LearningCompletionKind" NOT NULL,
    "learningRefId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "status" "LearningCompletionStatus" NOT NULL DEFAULT 'verified',
    "evidenceSource" "LearningEvidenceSourceKind" NOT NULL,
    "evidenceRefId" TEXT NOT NULL,
    "lessonId" TEXT,
    "languageProfileId" TEXT,
    "experienceSessionId" TEXT,
    "exerciseAttemptId" TEXT,
    "assessmentSubmissionId" TEXT,
    "criteria" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "dimensionScores" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_completions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_completion_goals" (
    "completionId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_completion_goals_pkey" PRIMARY KEY ("completionId", "goalId")
);

CREATE TABLE "learning_completion_cards" (
    "completionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_completion_cards_pkey" PRIMARY KEY ("completionId", "cardId")
);

CREATE TABLE "learning_completion_reviewables" (
    "completionId" TEXT NOT NULL,
    "reviewableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_completion_reviewables_pkey" PRIMARY KEY ("completionId", "reviewableId")
);

CREATE TABLE "learning_goal_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceSessionId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_goal_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_completions_userId_kind_learningRefId_contentVersion_key"
ON "learning_completions"("userId", "kind", "learningRefId", "contentVersion");
CREATE INDEX "learning_completions_userId_status_finalizedAt_idx"
ON "learning_completions"("userId", "status", "finalizedAt");
CREATE INDEX "learning_completions_lessonId_idx" ON "learning_completions"("lessonId");
CREATE INDEX "learning_completions_languageProfileId_idx" ON "learning_completions"("languageProfileId");
CREATE INDEX "learning_completions_experienceSessionId_idx" ON "learning_completions"("experienceSessionId");
CREATE INDEX "learning_completions_evidenceSource_evidenceRefId_idx"
ON "learning_completions"("evidenceSource", "evidenceRefId");
CREATE INDEX "learning_completion_goals_goalId_idx" ON "learning_completion_goals"("goalId");
CREATE INDEX "learning_completion_cards_cardId_idx" ON "learning_completion_cards"("cardId");
CREATE INDEX "learning_completion_reviewables_reviewableId_idx" ON "learning_completion_reviewables"("reviewableId");
CREATE UNIQUE INDEX "learning_goal_links_experienceSessionId_goalId_key"
ON "learning_goal_links"("experienceSessionId", "goalId");
CREATE INDEX "learning_goal_links_userId_experienceSessionId_idx"
ON "learning_goal_links"("userId", "experienceSessionId");
CREATE INDEX "learning_goal_links_goalId_idx" ON "learning_goal_links"("goalId");
CREATE INDEX "assessments_lessonId_idx" ON "assessments"("lessonId");

ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_languageProfileId_fkey"
FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_experienceSessionId_fkey"
FOREIGN KEY ("experienceSessionId") REFERENCES "experience_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_exerciseAttemptId_fkey"
FOREIGN KEY ("exerciseAttemptId") REFERENCES "exercise_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_completions"
ADD CONSTRAINT "learning_completions_assessmentSubmissionId_fkey"
FOREIGN KEY ("assessmentSubmissionId") REFERENCES "assessment_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "learning_completion_goals"
ADD CONSTRAINT "learning_completion_goals_completionId_fkey"
FOREIGN KEY ("completionId") REFERENCES "learning_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completion_goals"
ADD CONSTRAINT "learning_completion_goals_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_completion_cards"
ADD CONSTRAINT "learning_completion_cards_completionId_fkey"
FOREIGN KEY ("completionId") REFERENCES "learning_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completion_cards"
ADD CONSTRAINT "learning_completion_cards_cardId_fkey"
FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_completion_reviewables"
ADD CONSTRAINT "learning_completion_reviewables_completionId_fkey"
FOREIGN KEY ("completionId") REFERENCES "learning_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_completion_reviewables"
ADD CONSTRAINT "learning_completion_reviewables_reviewableId_fkey"
FOREIGN KEY ("reviewableId") REFERENCES "reviewables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_goal_links"
ADD CONSTRAINT "learning_goal_links_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_goal_links"
ADD CONSTRAINT "learning_goal_links_experienceSessionId_fkey"
FOREIGN KEY ("experienceSessionId") REFERENCES "experience_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_goal_links"
ADD CONSTRAINT "learning_goal_links_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The legacy compatibility pointer is trustworthy ownership/linkage data, not
-- fabricated learning evidence. Preserve those existing learning objectives in
-- the new authoritative relation while excluding non-learning session types.
INSERT INTO "learning_goal_links" (
    "id",
    "userId",
    "experienceSessionId",
    "goalId",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-' || md5(es."id" || ':' || es."goalId"),
    es."userId",
    es."id",
    es."goalId",
    true,
    es."startedAt",
    CURRENT_TIMESTAMP
FROM "experience_sessions" es
INNER JOIN "goals" g
    ON g."id" = es."goalId"
   AND g."userId" = es."userId"
WHERE es."goalId" IS NOT NULL
  AND es."type" IN ('learning', 'language')
ON CONFLICT ("experienceSessionId", "goalId") DO NOTHING;

-- Prisma cannot currently express a partial unique index. The database remains
-- authoritative: a journey can have many goals but at most one primary goal.
CREATE UNIQUE INDEX "learning_goal_links_one_primary_per_session"
ON "learning_goal_links" ("experienceSessionId")
WHERE "isPrimary" = true;
