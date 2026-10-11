-- Lot 2 language mastery: publish criterion-scoped mastery proof without
-- reusing lesson or language-unit completion semantics.
-- Additive only; the existing journal migration remains immutable.

BEGIN;

ALTER TYPE "LearningCompletionKind" ADD VALUE IF NOT EXISTS 'language_milestone';
ALTER TYPE "LearningCompletionKind" ADD VALUE IF NOT EXISTS 'language_pillar_exam';
ALTER TYPE "LearningEvidenceSourceKind" ADD VALUE IF NOT EXISTS 'language_mastery_attempt';

COMMIT;
