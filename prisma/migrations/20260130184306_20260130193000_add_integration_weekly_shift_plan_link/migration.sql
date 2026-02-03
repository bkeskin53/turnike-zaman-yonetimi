-- CreateTable
CREATE TABLE "IntegrationWeeklyShiftPlanLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceSystem" VARCHAR(50) NOT NULL,
    "externalRef" VARCHAR(200) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weeklyShiftPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastPayloadHash" VARCHAR(64),

    CONSTRAINT "IntegrationWeeklyShiftPlanLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationWeeklyShiftPlanLink_companyId_employeeId_idx" ON "IntegrationWeeklyShiftPlanLink"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "IntegrationWeeklyShiftPlanLink_companyId_weeklyShiftPlanId_idx" ON "IntegrationWeeklyShiftPlanLink"("companyId", "weeklyShiftPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationWeeklyShiftPlanLink_companyId_sourceSystem_exter_key" ON "IntegrationWeeklyShiftPlanLink"("companyId", "sourceSystem", "externalRef");

-- AddForeignKey
ALTER TABLE "IntegrationWeeklyShiftPlanLink" ADD CONSTRAINT "IntegrationWeeklyShiftPlanLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWeeklyShiftPlanLink" ADD CONSTRAINT "IntegrationWeeklyShiftPlanLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWeeklyShiftPlanLink" ADD CONSTRAINT "IntegrationWeeklyShiftPlanLink_weeklyShiftPlanId_fkey" FOREIGN KEY ("weeklyShiftPlanId") REFERENCES "WeeklyShiftPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
