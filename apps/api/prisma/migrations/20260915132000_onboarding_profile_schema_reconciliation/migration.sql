-- Sprint 3 schema reconciliation (additive only).
--
-- The Prisma datamodel has long contained OnboardingProfile, but the historical
-- migration chain did not create its table/enums.  This migration is idempotent
-- so a staging database that already contains the legacy table remains safe.

DO $$
BEGIN
  CREATE TYPE "LearningCategory" AS ENUM (
    'kindergarten', 'primary', 'secondary', 'highschool', 'university',
    'research', 'professional', 'language', 'personal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "onboarding_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'not_started',
  "category" "LearningCategory",
  "currentStep" TEXT NOT NULL DEFAULT 'welcome',
  "identity" JSONB,
  "education" JSONB,
  "languages" JSONB,
  "languageLearner" JSONB,
  "goals" JSONB,
  "subjects" JSONB,
  "preferences" JSONB,
  "teacher" JSONB,
  "academicSupport" JSONB,
  "assessment" JSONB,
  "extra" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_profiles_userId_key"
  ON "onboarding_profiles"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "onboarding_profiles"
      ADD CONSTRAINT "onboarding_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
