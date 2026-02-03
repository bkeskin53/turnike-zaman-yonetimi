-- CreateTable
CREATE TABLE "IntegrationLeaveLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceSystem" VARCHAR(50) NOT NULL,
    "externalRef" VARCHAR(200) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastPayloadHash" VARCHAR(64),

    CONSTRAINT "IntegrationLeaveLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationLeaveLink_companyId_employeeId_idx" ON "IntegrationLeaveLink"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "IntegrationLeaveLink_companyId_leaveId_idx" ON "IntegrationLeaveLink"("companyId", "leaveId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationLeaveLink_companyId_sourceSystem_externalRef_key" ON "IntegrationLeaveLink"("companyId", "sourceSystem", "externalRef");

-- AddForeignKey
ALTER TABLE "IntegrationLeaveLink" ADD CONSTRAINT "IntegrationLeaveLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLeaveLink" ADD CONSTRAINT "IntegrationLeaveLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLeaveLink" ADD CONSTRAINT "IntegrationLeaveLink_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "EmployeeLeave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
