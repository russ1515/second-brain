-- CreateEnum
CREATE TYPE "AchievementKind" AS ENUM ('streak_days', 'cards_reviewed', 'concepts_mastered', 'lessons_completed', 'exercises_correct');

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AchievementKind" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievements_userId_idx" ON "achievements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_userId_kind_threshold_key" ON "achievements"("userId", "kind", "threshold");

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
