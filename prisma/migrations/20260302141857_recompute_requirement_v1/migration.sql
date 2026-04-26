-- CreateEnum
CREATE TYPE "RecomputeReason" AS ENUM ('POLICY_UPDATE', 'RULESET_UPDATED', 'POLICY_ASSIGNMENT_UPDATED', 'SHIFT_TEMPLATE_UPDATED', 'WORK_SCHEDULE_UPDATED', 'SHIFT_ASSIGNMENT_UPDATED', 'WORKFORCE_UPDATED');

-- CreateEnum
CREATE TYPE "RecomputeStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE');

-- CreateTable
CREATE TABLE "RecomputeRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reason" "RecomputeReason" NOT NULL,
    "rangeStartDayKey" TEXT,
    "rangeEndDayKey" TEXT,
    "status" "RecomputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "RecomputeRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecomputeRequirement_companyId_status_idx" ON "RecomputeRequirement"("companyId", "status");

-- CreateIndex
CREATE INDEX "RecomputeRequirement_companyId_reason_status_idx" ON "RecomputeRequirement"("companyId", "reason", "status");

-- CreateIndex
CREATE INDEX "RecomputeRequirement_createdAt_idx" ON "RecomputeRequirement"("createdAt");
