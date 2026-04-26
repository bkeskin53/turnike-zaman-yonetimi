-- CreateEnum
CREATE TYPE "PayrollSnapshotStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "PayrollSnapshotQuantityUnit" AS ENUM ('MINUTES', 'DAYS');

-- CreateTable
CREATE TABLE "PayrollPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "PayrollSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "payrollMappingProfile" VARCHAR(50) NOT NULL,
    "dailyExportProfile" VARCHAR(50),
    "monthlyExportProfile" VARCHAR(50),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "payrollReadyCount" INTEGER NOT NULL DEFAULT 0,
    "blockedEmployeeCount" INTEGER NOT NULL DEFAULT 0,
    "blockedDayCount" INTEGER NOT NULL DEFAULT 0,
    "reviewRequiredDayCount" INTEGER NOT NULL DEFAULT 0,
    "pendingReviewDayCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedReviewDayCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriodSnapshotEmployee" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" VARCHAR(100) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "offDays" INTEGER NOT NULL DEFAULT 0,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "sickLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "excusedLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "unpaidLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "unknownLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeEarlyMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeLateMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "blockedDays" INTEGER NOT NULL DEFAULT 0,
    "readyDays" INTEGER NOT NULL DEFAULT 0,
    "reviewRequiredDays" INTEGER NOT NULL DEFAULT 0,
    "pendingReviewDays" INTEGER NOT NULL DEFAULT 0,
    "rejectedReviewDays" INTEGER NOT NULL DEFAULT 0,
    "manualAdjustmentDays" INTEGER NOT NULL DEFAULT 0,
    "anomalyDays" INTEGER NOT NULL DEFAULT 0,
    "puantajCodes" JSONB,
    "isPayrollReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriodSnapshotEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriodSnapshotCodeRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" VARCHAR(100) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "puantajCode" VARCHAR(50) NOT NULL,
    "payrollCode" VARCHAR(50) NOT NULL,
    "payrollLabel" VARCHAR(200) NOT NULL,
    "unit" "PayrollSnapshotQuantityUnit" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriodSnapshotCodeRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshot_companyId_month_idx" ON "PayrollPeriodSnapshot"("companyId", "month");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshot_periodId_createdAt_idx" ON "PayrollPeriodSnapshot"("periodId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshot_createdByUserId_idx" ON "PayrollPeriodSnapshot"("createdByUserId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotEmployee_snapshotId_idx" ON "PayrollPeriodSnapshotEmployee"("snapshotId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotEmployee_snapshotId_employeeId_idx" ON "PayrollPeriodSnapshotEmployee"("snapshotId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotEmployee_snapshotId_employeeCode_idx" ON "PayrollPeriodSnapshotEmployee"("snapshotId", "employeeCode");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotCodeRow_snapshotId_idx" ON "PayrollPeriodSnapshotCodeRow"("snapshotId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotCodeRow_snapshotId_employeeId_idx" ON "PayrollPeriodSnapshotCodeRow"("snapshotId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotCodeRow_snapshotId_payrollCode_idx" ON "PayrollPeriodSnapshotCodeRow"("snapshotId", "payrollCode");

-- CreateIndex
CREATE INDEX "PayrollPeriodSnapshotCodeRow_snapshotId_puantajCode_idx" ON "PayrollPeriodSnapshotCodeRow"("snapshotId", "puantajCode");

-- AddForeignKey
ALTER TABLE "PayrollPeriodSnapshot" ADD CONSTRAINT "PayrollPeriodSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodSnapshot" ADD CONSTRAINT "PayrollPeriodSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodSnapshot" ADD CONSTRAINT "PayrollPeriodSnapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodSnapshotEmployee" ADD CONSTRAINT "PayrollPeriodSnapshotEmployee_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PayrollPeriodSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodSnapshotCodeRow" ADD CONSTRAINT "PayrollPeriodSnapshotCodeRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PayrollPeriodSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
