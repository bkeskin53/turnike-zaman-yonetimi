-- CreateEnum
CREATE TYPE "WorkScheduleAssignmentScope" AS ENUM ('EMPLOYEE', 'EMPLOYEE_SUBGROUP', 'EMPLOYEE_GROUP', 'BRANCH');

-- CreateTable
CREATE TABLE "WorkSchedulePattern" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL,
    "referenceDate" DATE NOT NULL,
    "dayShiftTemplateIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedulePattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "WorkScheduleAssignmentScope" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATE,
    "validTo" DATE,
    "patternId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeSubgroupId" TEXT,
    "employeeGroupId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSchedulePattern_companyId_idx" ON "WorkSchedulePattern"("companyId");

-- CreateIndex
CREATE INDEX "WorkSchedulePattern_companyId_isActive_idx" ON "WorkSchedulePattern"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedulePattern_companyId_code_key" ON "WorkSchedulePattern"("companyId", "code");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_idx" ON "WorkScheduleAssignment"("companyId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_scope_idx" ON "WorkScheduleAssignment"("companyId", "scope");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_patternId_idx" ON "WorkScheduleAssignment"("companyId", "patternId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_employeeId_idx" ON "WorkScheduleAssignment"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_employeeSubgroupId_idx" ON "WorkScheduleAssignment"("companyId", "employeeSubgroupId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_employeeGroupId_idx" ON "WorkScheduleAssignment"("companyId", "employeeGroupId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_branchId_idx" ON "WorkScheduleAssignment"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_validFrom_idx" ON "WorkScheduleAssignment"("companyId", "validFrom");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_companyId_validTo_idx" ON "WorkScheduleAssignment"("companyId", "validTo");

-- AddForeignKey
ALTER TABLE "WorkSchedulePattern" ADD CONSTRAINT "WorkSchedulePattern_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "WorkSchedulePattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_employeeSubgroupId_fkey" FOREIGN KEY ("employeeSubgroupId") REFERENCES "EmployeeSubgroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
