-- UX-2 Lot 0: additive, persistent cross-product experience sessions.

-- CreateEnum
CREATE TYPE "ExperienceSessionType" AS ENUM ('learning', 'tutor', 'research', 'review', 'language', 'workspace', 'document-processing');

-- CreateEnum
CREATE TYPE "ExperienceSessionStatus" AS ENUM ('active', 'paused', 'completed', 'abandoned', 'failed');

-- CreateEnum
CREATE TYPE "ExperienceInputModality" AS ENUM ('text', 'voice', 'photo', 'scan', 'file', 'mixed');

-- CreateTable
CREATE TABLE "experience_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExperienceSessionType" NOT NULL,
    "status" "ExperienceSessionStatus" NOT NULL DEFAULT 'active',
    "title" TEXT,
    "intent" TEXT,
    "inputModality" "ExperienceInputModality",
    "activeContexts" JSONB NOT NULL,
    "currentStep" JSONB,
    "progress" JSONB,
    "productions" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "twinImpact" JSONB,
    "resumeTarget" JSONB,
    "nextBestAction" JSONB,
    "tutorSessionId" TEXT,
    "studySessionId" TEXT,
    "documentId" TEXT,
    "lessonId" TEXT,
    "goalId" TEXT,
    "languageProfileId" TEXT,
    "workspaceRef" TEXT,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "experience_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experience_sessions_userId_status_updatedAt_idx" ON "experience_sessions"("userId", "status", "updatedAt");
CREATE INDEX "experience_sessions_userId_type_updatedAt_idx" ON "experience_sessions"("userId", "type", "updatedAt");
CREATE INDEX "experience_sessions_tutorSessionId_idx" ON "experience_sessions"("tutorSessionId");
CREATE INDEX "experience_sessions_studySessionId_idx" ON "experience_sessions"("studySessionId");
CREATE INDEX "experience_sessions_documentId_idx" ON "experience_sessions"("documentId");
CREATE INDEX "experience_sessions_lessonId_idx" ON "experience_sessions"("lessonId");
CREATE INDEX "experience_sessions_goalId_idx" ON "experience_sessions"("goalId");
CREATE INDEX "experience_sessions_languageProfileId_idx" ON "experience_sessions"("languageProfileId");
CREATE UNIQUE INDEX "experience_sessions_userId_idempotencyKey_key" ON "experience_sessions"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_tutorSessionId_fkey" FOREIGN KEY ("tutorSessionId") REFERENCES "tutor_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_sessions" ADD CONSTRAINT "experience_sessions_languageProfileId_fkey" FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
