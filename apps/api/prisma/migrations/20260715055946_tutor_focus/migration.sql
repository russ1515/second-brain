-- AlterTable
ALTER TABLE "tutor_sessions" ADD COLUMN     "focusConceptId" TEXT;

-- AddForeignKey
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_focusConceptId_fkey" FOREIGN KEY ("focusConceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
