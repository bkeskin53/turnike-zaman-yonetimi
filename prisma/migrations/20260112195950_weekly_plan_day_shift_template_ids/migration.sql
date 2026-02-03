-- AlterTable
ALTER TABLE "WeeklyShiftPlan" ADD COLUMN     "friShiftTemplateId" TEXT,
ADD COLUMN     "monShiftTemplateId" TEXT,
ADD COLUMN     "satShiftTemplateId" TEXT,
ADD COLUMN     "sunShiftTemplateId" TEXT,
ADD COLUMN     "thuShiftTemplateId" TEXT,
ADD COLUMN     "tueShiftTemplateId" TEXT,
ADD COLUMN     "wedShiftTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_monShiftTemplateId_idx" ON "WeeklyShiftPlan"("monShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_tueShiftTemplateId_idx" ON "WeeklyShiftPlan"("tueShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_wedShiftTemplateId_idx" ON "WeeklyShiftPlan"("wedShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_thuShiftTemplateId_idx" ON "WeeklyShiftPlan"("thuShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_friShiftTemplateId_idx" ON "WeeklyShiftPlan"("friShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_satShiftTemplateId_idx" ON "WeeklyShiftPlan"("satShiftTemplateId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_sunShiftTemplateId_idx" ON "WeeklyShiftPlan"("sunShiftTemplateId");
