-- CreateTable
CREATE TABLE "learning_predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "signals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_predictions_userId_kind_key" ON "learning_predictions"("userId", "kind");

-- AddForeignKey
ALTER TABLE "learning_predictions" ADD CONSTRAINT "learning_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
