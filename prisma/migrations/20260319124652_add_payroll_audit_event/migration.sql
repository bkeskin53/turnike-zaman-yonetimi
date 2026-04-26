-- CreateEnum
CREATE TYPE "PayrollAuditEventType" AS ENUM ('REVIEW_STATUS_CHANGED', 'REVIEW_NOTE_CHANGED', 'PERIOD_PRE_CLOSED', 'PERIOD_CLOSED', 'PERIOD_REOPENED', 'SNAPSHOT_CREATED', 'MONTHLY_EXPORT_CREATED', 'DAILY_EXPORT_CREATED');

-- CreateEnum
CREATE TYPE "PayrollAuditEntityType" AS ENUM ('PAYROLL_PERIOD', 'PAYROLL_PERIOD_SNAPSHOT', 'DAILY_ATTENDANCE', 'EMPLOYEE', 'EXPORT');

-- CreateTable
CREATE TABLE "PayrollAuditEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" VARCHAR(7),
    "employeeId" VARCHAR(100),
    "eventType" "PayrollAuditEventType" NOT NULL,
    "entityType" "PayrollAuditEntityType" NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_companyId_createdAt_idx" ON "PayrollAuditEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_companyId_month_createdAt_idx" ON "PayrollAuditEvent"("companyId", "month", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_companyId_eventType_createdAt_idx" ON "PayrollAuditEvent"("companyId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_companyId_entityType_entityId_createdAt_idx" ON "PayrollAuditEvent"("companyId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_companyId_employeeId_createdAt_idx" ON "PayrollAuditEvent"("companyId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollAuditEvent_actorUserId_idx" ON "PayrollAuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAuditEvent" ADD CONSTRAINT "PayrollAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
