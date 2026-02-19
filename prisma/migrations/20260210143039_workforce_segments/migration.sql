-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PolicyAssignmentScope" ADD VALUE 'EMPLOYEE_SUBGROUP';
ALTER TYPE "PolicyAssignmentScope" ADD VALUE 'EMPLOYEE_GROUP';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employeeGroupId" TEXT,
ADD COLUMN     "employeeSubgroupId" TEXT;

-- AlterTable
ALTER TABLE "PolicyAssignment" ADD COLUMN     "employeeGroupId" TEXT,
ADD COLUMN     "employeeSubgroupId" TEXT;

-- CreateTable
CREATE TABLE "EmployeeGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSubgroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSubgroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeGroup_companyId_idx" ON "EmployeeGroup"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeGroup_companyId_code_key" ON "EmployeeGroup"("companyId", "code");

-- CreateIndex
CREATE INDEX "EmployeeSubgroup_companyId_idx" ON "EmployeeSubgroup"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeSubgroup_companyId_groupId_idx" ON "EmployeeSubgroup"("companyId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSubgroup_companyId_code_key" ON "EmployeeSubgroup"("companyId", "code");

-- CreateIndex
CREATE INDEX "Employee_companyId_employeeGroupId_idx" ON "Employee"("companyId", "employeeGroupId");

-- CreateIndex
CREATE INDEX "Employee_companyId_employeeSubgroupId_idx" ON "Employee"("companyId", "employeeSubgroupId");

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_employeeSubgroupId_idx" ON "PolicyAssignment"("companyId", "employeeSubgroupId");

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_employeeGroupId_idx" ON "PolicyAssignment"("companyId", "employeeGroupId");

-- AddForeignKey
ALTER TABLE "EmployeeGroup" ADD CONSTRAINT "EmployeeGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSubgroup" ADD CONSTRAINT "EmployeeSubgroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSubgroup" ADD CONSTRAINT "EmployeeSubgroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_employeeSubgroupId_fkey" FOREIGN KEY ("employeeSubgroupId") REFERENCES "EmployeeSubgroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employeeSubgroupId_fkey" FOREIGN KEY ("employeeSubgroupId") REFERENCES "EmployeeSubgroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
