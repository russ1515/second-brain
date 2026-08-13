-- CreateTable
CREATE TABLE "learning_dna" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "traits" JSONB NOT NULL,
    "maturity" INTEGER NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_dna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_dna_userId_key" ON "learning_dna"("userId");

-- AddForeignKey
ALTER TABLE "learning_dna" ADD CONSTRAINT "learning_dna_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
