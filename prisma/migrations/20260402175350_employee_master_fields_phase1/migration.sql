-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "gender" VARCHAR(20),
ADD COLUMN     "nationalId" VARCHAR(11),
ADD COLUMN     "phone" VARCHAR(30);

-- CreateIndex
CREATE INDEX "Employee_companyId_nationalId_idx" ON "Employee"("companyId", "nationalId");

-- CreateIndex
CREATE INDEX "Employee_companyId_phone_idx" ON "Employee"("companyId", "phone");
