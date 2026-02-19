-- AlterEnum
ALTER TYPE "PolicyAssignmentScope" ADD VALUE 'BRANCH';

-- AlterTable
ALTER TABLE "PolicyAssignment" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "PolicyAssignment_companyId_branchId_idx" ON "PolicyAssignment"("companyId", "branchId");

-- AddForeignKey
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
