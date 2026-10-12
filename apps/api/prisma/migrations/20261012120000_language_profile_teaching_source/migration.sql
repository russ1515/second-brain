-- The path stores only the learner's choice of trusted source. The actual
-- language continues to be resolved from Profile/LanguageProfile at runtime,
-- so changing the UI locale updates future content without rewriting history.
ALTER TABLE "language_profiles"
ADD COLUMN "teachingLanguageSource" TEXT NOT NULL DEFAULT 'interface';

ALTER TABLE "language_profiles"
ADD CONSTRAINT "language_profiles_teachingLanguageSource_check"
CHECK ("teachingLanguageSource" IN ('native', 'interface'));
