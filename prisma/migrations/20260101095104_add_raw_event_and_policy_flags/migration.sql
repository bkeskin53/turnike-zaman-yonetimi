-- CreateEnum
CREATE TYPE "OffDayEntryBehavior" AS ENUM ('IGNORE', 'FLAG', 'COUNT_AS_OT');

-- CreateEnum
CREATE TYPE "EventDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('MANUAL', 'DEVICE');

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "breakAutoDeductEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "offDayEntryBehavior" "OffDayEntryBehavior" NOT NULL DEFAULT 'IGNORE',
ADD COLUMN     "overtimeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RawEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "EventDirection" NOT NULL,
    "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawEvent_companyId_employeeId_occurredAt_idx" ON "RawEvent"("companyId", "employeeId", "occurredAt");

-- AddForeignKey
ALTER TABLE "RawEvent" ADD CONSTRAINT "RawEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawEvent" ADD CONSTRAINT "RawEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
