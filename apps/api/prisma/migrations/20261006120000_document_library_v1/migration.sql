-- Additive V1 document-library metadata and durable page provenance.
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'partial';

ALTER TABLE "documents"
  ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'DOCUMENT',
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "documents"
SET "contentType" = CASE
  WHEN "sourceRef" LIKE 'scan:%' THEN 'SCAN'
  WHEN lower(coalesce("sourceRef", '')) LIKE '%.pdf' THEN 'PDF'
  WHEN "source" = 'text' THEN 'NOTE'
  ELSE 'DOCUMENT'
END;

-- Lessons created before this migration already point at their generated
-- source document. Preserve that real relationship instead of presenting the
-- material as a generic learner note after the new type facet is introduced.
UPDATE "documents" AS document
SET
  "contentType" = 'LESSON_AI',
  "sourceRef" = coalesce(document."sourceRef", 'lesson:' || lesson."id")
FROM "lessons" AS lesson
WHERE lesson."sourceDocumentId" = document."id";

CREATE INDEX "documents_userId_fingerprint_idx"
  ON "documents"("userId", "fingerprint");
CREATE INDEX "documents_userId_contentType_idx"
  ON "documents"("userId", "contentType");

ALTER TABLE "collections"
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH normalized AS (
  SELECT
    "id",
    lower(regexp_replace(trim("name"), '[[:space:]]+', ' ', 'g')) AS value,
    row_number() OVER (
      PARTITION BY "userId", lower(regexp_replace(trim("name"), '[[:space:]]+', ' ', 'g'))
      ORDER BY "createdAt", "id"
    ) AS duplicate_position
  FROM "collections"
)
UPDATE "collections" AS collection
SET "normalizedName" = CASE
  WHEN normalized.duplicate_position = 1 THEN normalized.value
  ELSE NULL
END
FROM normalized
WHERE normalized."id" = collection."id";

CREATE UNIQUE INDEX "collections_userId_normalizedName_key"
  ON "collections"("userId", "normalizedName");

ALTER TABLE "document_chunks"
  ADD COLUMN "pageNumber" INTEGER,
  ADD COLUMN "sourceType" TEXT;

CREATE TABLE "document_pages" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "storageName" TEXT NOT NULL,
  "originalName" TEXT,
  "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
  "rotation" INTEGER NOT NULL DEFAULT 0,
  "ocrText" TEXT,
  "ocrStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "ocrError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_pages_documentId_pageNumber_key"
  ON "document_pages"("documentId", "pageNumber");
CREATE INDEX "document_pages_documentId_position_idx"
  ON "document_pages"("documentId", "position");
ALTER TABLE "document_pages"
  ADD CONSTRAINT "document_pages_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
