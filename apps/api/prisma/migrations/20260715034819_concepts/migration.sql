-- CreateEnum
CREATE TYPE "ConceptRelation" AS ENUM ('prerequisite', 'related');

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_edges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" "ConceptRelation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concepts_userId_idx" ON "concepts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_userId_normalizedName_key" ON "concepts"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "concept_edges_userId_idx" ON "concept_edges"("userId");

-- CreateIndex
CREATE INDEX "concept_edges_sourceId_idx" ON "concept_edges"("sourceId");

-- CreateIndex
CREATE INDEX "concept_edges_targetId_idx" ON "concept_edges"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "concept_edges_sourceId_targetId_relation_key" ON "concept_edges"("sourceId", "targetId", "relation");

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
