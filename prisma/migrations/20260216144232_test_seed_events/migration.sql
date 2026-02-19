-- AlterEnum
ALTER TYPE "EventSource" ADD VALUE 'TEST_SEED';

-- AlterTable
ALTER TABLE "RawEvent" ADD COLUMN     "batchId" VARCHAR(64),
ADD COLUMN     "note" VARCHAR(200);

-- CreateIndex
CREATE INDEX "RawEvent_companyId_batchId_idx" ON "RawEvent"("companyId", "batchId");
