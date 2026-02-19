-- CreateTable
CREATE TABLE "WorkSchedulePatternDay" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "shiftTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedulePatternDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSchedulePatternDay_companyId_idx" ON "WorkSchedulePatternDay"("companyId");

-- CreateIndex
CREATE INDEX "WorkSchedulePatternDay_companyId_patternId_idx" ON "WorkSchedulePatternDay"("companyId", "patternId");

-- CreateIndex
CREATE INDEX "WorkSchedulePatternDay_companyId_shiftTemplateId_idx" ON "WorkSchedulePatternDay"("companyId", "shiftTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedulePatternDay_companyId_patternId_dayIndex_key" ON "WorkSchedulePatternDay"("companyId", "patternId", "dayIndex");

-- AddForeignKey
ALTER TABLE "WorkSchedulePatternDay" ADD CONSTRAINT "WorkSchedulePatternDay_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedulePatternDay" ADD CONSTRAINT "WorkSchedulePatternDay_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "WorkSchedulePattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedulePatternDay" ADD CONSTRAINT "WorkSchedulePatternDay_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
