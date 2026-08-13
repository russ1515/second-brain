-- CreateEnum
CREATE TYPE "LanguageMode" AS ENUM ('beginner', 'intermediate', 'advanced', 'academic', 'professional', 'exam_prep', 'immersion');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "languageProfileId" TEXT;

-- AlterTable
ALTER TABLE "tutor_sessions" ADD COLUMN     "languageProfileId" TEXT;

-- CreateTable
CREATE TABLE "language_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "normalizedLanguage" TEXT NOT NULL,
    "nativeLanguage" TEXT,
    "mode" "LanguageMode" NOT NULL DEFAULT 'beginner',
    "goal" TEXT,
    "vocabDeckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "language_profiles_userId_idx" ON "language_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "language_profiles_userId_normalizedLanguage_key" ON "language_profiles"("userId", "normalizedLanguage");

-- AddForeignKey
ALTER TABLE "language_profiles" ADD CONSTRAINT "language_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_profiles" ADD CONSTRAINT "language_profiles_vocabDeckId_fkey" FOREIGN KEY ("vocabDeckId") REFERENCES "decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_languageProfileId_fkey" FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_languageProfileId_fkey" FOREIGN KEY ("languageProfileId") REFERENCES "language_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
