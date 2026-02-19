/*
  Warnings:

  - A unique constraint covering the columns `[companyId,shiftCode]` on the table `ShiftTemplate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shiftCode` to the `ShiftTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ShiftPolicyAssignmentScope" AS ENUM ('SHIFT', 'BRANCH_SHIFT', 'EMPLOYEE_GROUP_SHIFT', 'EMPLOYEE_SUBGROUP_SHIFT', 'EMPLOYEE_SHIFT');

-- AlterTable
ALTER TABLE "ShiftTemplate" ADD COLUMN     "shiftCode" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ShiftPolicyAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "ShiftPolicyAssignmentScope" NOT NULL,
    "shiftCode" VARCHAR(80) NOT NULL,
    "employeeId" TEXT,
    "employeeSubgroupId" TEXT,
    "employeeGroupId" TEXT,
    "branchId" TEXT,
    "ruleSetId" TEXT NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftPolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_scope_idx" ON "ShiftPolicyAssignment"("companyId", "scope");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_shiftCode_idx" ON "ShiftPolicyAssignment"("companyId", "shiftCode");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_shiftCode_employeeId_idx" ON "ShiftPolicyAssignment"("companyId", "shiftCode", "employeeId");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_shiftCode_employeeSubgroupI_idx" ON "ShiftPolicyAssignment"("companyId", "shiftCode", "employeeSubgroupId");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_shiftCode_employeeGroupId_idx" ON "ShiftPolicyAssignment"("companyId", "shiftCode", "employeeGroupId");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_shiftCode_branchId_idx" ON "ShiftPolicyAssignment"("companyId", "shiftCode", "branchId");

-- CreateIndex
CREATE INDEX "ShiftPolicyAssignment_companyId_ruleSetId_idx" ON "ShiftPolicyAssignment"("companyId", "ruleSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTemplate_companyId_shiftCode_key" ON "ShiftTemplate"("companyId", "shiftCode");

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_employeeSubgroupId_fkey" FOREIGN KEY ("employeeSubgroupId") REFERENCES "EmployeeSubgroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicyAssignment" ADD CONSTRAINT "ShiftPolicyAssignment_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PolicyRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
