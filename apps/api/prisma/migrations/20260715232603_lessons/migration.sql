-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tutorSessionId" TEXT,
    "conceptId" TEXT,
    "language" TEXT,
    "topic" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "exercises" JSONB NOT NULL,
    "homework" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "revisionSheet" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lessons_userId_idx" ON "lessons"("userId");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tutorSessionId_fkey" FOREIGN KEY ("tutorSessionId") REFERENCES "tutor_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
