-- CreateEnum
CREATE TYPE "PolicyAssignmentScope" AS ENUM ('EMPLOYEE');

-- CreateTable
CREATE TABLE "PolicyRuleSet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "shiftStartMinute" INTEGER NOT NULL,
    "shiftEndMinute" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "lateGraceMinutes" INTEGER NOT NULL,
    "earlyLeaveGraceMinutes" INTEGER NOT NULL,
    "breakAutoDeductEnabled" BOOLEAN NOT NULL,
    "offDayEntryBehavior" "OffDayEntryBehavior" NOT NULL,
    "overtimeEnabled" BOOLEAN NOT NULL,
    "leaveEntryBehavior" "OffDayEntryBehavior" NOT NULL,
    "graceAffectsWorked" BOOLEAN,
    "exitConsumesBreak" BOOLEAN,
    "maxSingleExitMinutes" INTEGER,
    "maxDailyExitMinutes" INTEGER,
    "exitExceedAction" "ExitExceedAction",
    "graceMode" "GraceMode" NOT NULL,
    "workedCalculationMode" "WorkedCalculationMode" NOT NULL,
    "otBreakInterval" INTEGER,
    "otBreakDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "PolicyAssignmentScope" NOT NULL,
    "employeeId" TEXT,
    "ruleSetId" TEXT NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRuleSet_companyId_idx" ON "PolicyRuleSet"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRuleSet_companyId_code_key" ON "PolicyRuleSet"("companyId", "code");

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_scope_idx" ON "PolicyAssignment"("companyId", "scope");

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_employeeId_idx" ON "PolicyAssignment"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_ruleSetId_idx" ON "PolicyAssignment"("companyId", "ruleSetId");

-- AddForeignKey
ALTER TABLE "PolicyRuleSet" ADD CONSTRAINT "PolicyRuleSet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PolicyRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
