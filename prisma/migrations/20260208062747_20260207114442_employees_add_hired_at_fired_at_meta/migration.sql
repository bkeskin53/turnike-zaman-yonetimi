-- CreateEnum
CREATE TYPE "EmployeeActionType" AS ENUM ('HIRE', 'TERMINATE', 'REHIRE', 'UPDATE');

-- CreateTable
CREATE TABLE "EmployeeEmploymentPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEmploymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeActionType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "note" VARCHAR(200),
    "actorUserId" VARCHAR(64),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeEmploymentPeriod_companyId_employeeId_idx" ON "EmployeeEmploymentPeriod"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentPeriod_employeeId_startDate_idx" ON "EmployeeEmploymentPeriod"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentPeriod_companyId_startDate_idx" ON "EmployeeEmploymentPeriod"("companyId", "startDate");

-- CreateIndex
CREATE INDEX "EmployeeAction_companyId_employeeId_idx" ON "EmployeeAction"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeAction_companyId_type_idx" ON "EmployeeAction"("companyId", "type");

-- CreateIndex
CREATE INDEX "EmployeeAction_companyId_effectiveDate_idx" ON "EmployeeAction"("companyId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "EmployeeEmploymentPeriod" ADD CONSTRAINT "EmployeeEmploymentPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmploymentPeriod" ADD CONSTRAINT "EmployeeEmploymentPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAction" ADD CONSTRAINT "EmployeeAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAction" ADD CONSTRAINT "EmployeeAction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
