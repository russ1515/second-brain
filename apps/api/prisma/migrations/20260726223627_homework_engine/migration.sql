-- CreateTable
CREATE TABLE "homework" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "conceptId" TEXT,
    "language" TEXT,
    "focus" TEXT NOT NULL,
    "exercises" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "masteryAtGeneration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homework_lessonId_key" ON "homework"("lessonId");

-- CreateIndex
CREATE INDEX "homework_userId_idx" ON "homework"("userId");

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
