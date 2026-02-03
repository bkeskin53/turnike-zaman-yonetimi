-- CreateTable
CREATE TABLE "DailyAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statusOverride" "DailyStatus",
    "workedMinutesOverride" INTEGER,
    "overtimeMinutesOverride" INTEGER,
    "lateMinutesOverride" INTEGER,
    "earlyLeaveMinutesOverride" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAdjustment_companyId_idx" ON "DailyAdjustment"("companyId");

-- CreateIndex
CREATE INDEX "DailyAdjustment_employeeId_idx" ON "DailyAdjustment"("employeeId");

-- CreateIndex
CREATE INDEX "DailyAdjustment_date_idx" ON "DailyAdjustment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAdjustment_employeeId_date_key" ON "DailyAdjustment"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "DailyAdjustment" ADD CONSTRAINT "DailyAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAdjustment" ADD CONSTRAINT "DailyAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
