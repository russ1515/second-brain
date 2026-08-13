-- CreateTable
CREATE TABLE "reviewables" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" "CardState" NOT NULL DEFAULT 'new',
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviewables_userId_due_idx" ON "reviewables"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "reviewables_userId_kind_refId_key" ON "reviewables"("userId", "kind", "refId");

-- AddForeignKey
ALTER TABLE "reviewables" ADD CONSTRAINT "reviewables_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
