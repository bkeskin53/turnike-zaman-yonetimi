-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'PRE_CLOSED', 'CLOSED');

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "preClosedAt" TIMESTAMP(3),
    "preClosedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollPeriod_companyId_status_idx" ON "PayrollPeriod"("companyId", "status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_companyId_month_status_idx" ON "PayrollPeriod"("companyId", "month", "status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_preClosedByUserId_idx" ON "PayrollPeriod"("preClosedByUserId");

-- CreateIndex
CREATE INDEX "PayrollPeriod_closedByUserId_idx" ON "PayrollPeriod"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_month_key" ON "PayrollPeriod"("companyId", "month");

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_preClosedByUserId_fkey" FOREIGN KEY ("preClosedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
