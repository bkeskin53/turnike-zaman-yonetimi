-- CreateTable
CREATE TABLE "WeeklyShiftPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "monStartMinute" INTEGER,
    "monEndMinute" INTEGER,
    "tueStartMinute" INTEGER,
    "tueEndMinute" INTEGER,
    "wedStartMinute" INTEGER,
    "wedEndMinute" INTEGER,
    "thuStartMinute" INTEGER,
    "thuEndMinute" INTEGER,
    "friStartMinute" INTEGER,
    "friEndMinute" INTEGER,
    "satStartMinute" INTEGER,
    "satEndMinute" INTEGER,
    "sunStartMinute" INTEGER,
    "sunEndMinute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyShiftPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_companyId_idx" ON "WeeklyShiftPlan"("companyId");

-- CreateIndex
CREATE INDEX "WeeklyShiftPlan_employeeId_idx" ON "WeeklyShiftPlan"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyShiftPlan_companyId_employeeId_weekStartDate_key" ON "WeeklyShiftPlan"("companyId", "employeeId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "WeeklyShiftPlan" ADD CONSTRAINT "WeeklyShiftPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyShiftPlan" ADD CONSTRAINT "WeeklyShiftPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
