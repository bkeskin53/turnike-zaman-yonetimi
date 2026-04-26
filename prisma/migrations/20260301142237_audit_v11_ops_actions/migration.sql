-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RECOMPUTE';
ALTER TYPE "AuditAction" ADD VALUE 'IMPORT';
ALTER TYPE "AuditAction" ADD VALUE 'POLICY_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_EVENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditTargetType" ADD VALUE 'ATTENDANCE';
ALTER TYPE "AuditTargetType" ADD VALUE 'EMPLOYEES';
ALTER TYPE "AuditTargetType" ADD VALUE 'POLICY';
ALTER TYPE "AuditTargetType" ADD VALUE 'EVENT';
