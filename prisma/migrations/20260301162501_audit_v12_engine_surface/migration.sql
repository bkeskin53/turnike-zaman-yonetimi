-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RULESET_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'POLICY_ASSIGNMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SHIFT_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WORK_SCHEDULE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SHIFT_ASSIGNMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKFORCE_UPDATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditTargetType" ADD VALUE 'RULESET';
ALTER TYPE "AuditTargetType" ADD VALUE 'POLICY_ASSIGNMENT';
ALTER TYPE "AuditTargetType" ADD VALUE 'SHIFT_TEMPLATE';
ALTER TYPE "AuditTargetType" ADD VALUE 'WORK_SCHEDULE';
ALTER TYPE "AuditTargetType" ADD VALUE 'SHIFT_ASSIGNMENT';
ALTER TYPE "AuditTargetType" ADD VALUE 'WORKFORCE';
