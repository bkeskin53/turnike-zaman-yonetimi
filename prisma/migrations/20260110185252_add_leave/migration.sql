-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'EXCUSED', 'UNPAID');

-- AlterEnum
ALTER TYPE "DailyStatus" ADD VALUE 'LEAVE';

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "leaveEntryBehavior" "OffDayEntryBehavior" NOT NULL DEFAULT 'FLAG';

-- CreateTable
CREATE TABLE "EmployeeLeave" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "type" "LeaveType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_idx" ON "EmployeeLeave"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_employeeId_idx" ON "EmployeeLeave"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_dateFrom_idx" ON "EmployeeLeave"("dateFrom");

-- CreateIndex
CREATE INDEX "EmployeeLeave_dateTo_idx" ON "EmployeeLeave"("dateTo");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_employeeId_idx" ON "EmployeeLeave"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_employeeId_dateFrom_dateTo_idx" ON "EmployeeLeave"("employeeId", "dateFrom", "dateTo");

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
