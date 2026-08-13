-- CreateTable
CREATE TABLE "concept_cards" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_documents" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concept_cards_cardId_idx" ON "concept_cards"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "concept_cards_conceptId_cardId_key" ON "concept_cards"("conceptId", "cardId");

-- CreateIndex
CREATE INDEX "concept_documents_documentId_idx" ON "concept_documents"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "concept_documents_conceptId_documentId_key" ON "concept_documents"("conceptId", "documentId");

-- AddForeignKey
ALTER TABLE "concept_cards" ADD CONSTRAINT "concept_cards_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_cards" ADD CONSTRAINT "concept_cards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_documents" ADD CONSTRAINT "concept_documents_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_documents" ADD CONSTRAINT "concept_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
