/*
  Warnings:

  - A unique constraint covering the columns `[companyId,externalRef]` on the table `RawEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RawEvent" ADD COLUMN     "externalRef" VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "RawEvent_companyId_externalRef_key" ON "RawEvent"("companyId", "externalRef");
