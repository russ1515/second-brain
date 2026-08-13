-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('active', 'acted', 'dismissed');

-- CreateTable
CREATE TABLE "ai_initiatives" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'active',
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ai_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_initiatives_userId_status_idx" ON "ai_initiatives"("userId", "status");

-- AddForeignKey
ALTER TABLE "ai_initiatives" ADD CONSTRAINT "ai_initiatives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
