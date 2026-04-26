-- CreateEnum
CREATE TYPE "AttendanceOwnershipAuditDisposition" AS ENUM ('SCHEDULED', 'VISIBLE_UNSCHEDULED', 'OWNED_OTHER_LOGICAL_DAY', 'IGNORED');

-- CreateEnum
CREATE TYPE "AttendanceOwnershipAuditOwnerSource" AS ENUM ('PREVIOUS_DAY', 'CURRENT_DAY', 'NEXT_DAY');

-- CreateTable
CREATE TABLE "AttendanceOwnershipAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rawEventId" TEXT NOT NULL,
    "logicalDayKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "EventDirection" NOT NULL,
    "ownerLogicalDayKey" TEXT,
    "ownerSource" "AttendanceOwnershipAuditOwnerSource",
    "ownershipScore" INTEGER,
    "ownershipBreakdown" JSONB,
    "disposition" "AttendanceOwnershipAuditDisposition" NOT NULL,
    "note" TEXT,
    "shiftSource" TEXT,
    "shiftSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceOwnershipAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceOwnershipAudit_companyId_logicalDayKey_idx" ON "AttendanceOwnershipAudit"("companyId", "logicalDayKey");

-- CreateIndex
CREATE INDEX "AttendanceOwnershipAudit_companyId_employeeId_logicalDayKey_idx" ON "AttendanceOwnershipAudit"("companyId", "employeeId", "logicalDayKey");

-- CreateIndex
CREATE INDEX "AttendanceOwnershipAudit_companyId_rawEventId_idx" ON "AttendanceOwnershipAudit"("companyId", "rawEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceOwnershipAudit_rawEventId_logicalDayKey_key" ON "AttendanceOwnershipAudit"("rawEventId", "logicalDayKey");

-- AddForeignKey
ALTER TABLE "AttendanceOwnershipAudit" ADD CONSTRAINT "AttendanceOwnershipAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceOwnershipAudit" ADD CONSTRAINT "AttendanceOwnershipAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceOwnershipAudit" ADD CONSTRAINT "AttendanceOwnershipAudit_rawEventId_fkey" FOREIGN KEY ("rawEventId") REFERENCES "RawEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
