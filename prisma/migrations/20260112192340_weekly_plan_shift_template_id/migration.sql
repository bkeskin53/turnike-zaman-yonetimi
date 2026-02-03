-- AlterTable
ALTER TABLE "WeeklyShiftPlan" ADD COLUMN     "shiftTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "ShiftTemplate_companyId_idx" ON "ShiftTemplate"("companyId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_shiftTemplateId_idx" ON "WeeklyShiftPlan"("shiftTemplateId");

-- AddForeignKey
ALTER TABLE "WeeklyShiftPlan" ADD CONSTRAINT "WeeklyShiftPlan_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
