-- CreateTable
CREATE TABLE "study_resources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_resources_userId_idx" ON "study_resources"("userId");

-- CreateIndex
CREATE INDEX "study_resources_documentId_idx" ON "study_resources"("documentId");

-- AddForeignKey
ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
