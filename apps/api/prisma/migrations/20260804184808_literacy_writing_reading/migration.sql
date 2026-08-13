-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "review" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_exercises" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "topic" TEXT,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "adaptedLevel" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writing_submissions_userId_createdAt_idx" ON "writing_submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reading_exercises_userId_createdAt_idx" ON "reading_exercises"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_exercises" ADD CONSTRAINT "reading_exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
