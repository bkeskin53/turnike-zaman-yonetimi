-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollAuditEntityType" ADD VALUE 'PAYROLL_MAPPING_PROFILE';
ALTER TYPE "PayrollAuditEntityType" ADD VALUE 'PAYROLL_MAPPING_ITEM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_PROFILE_CREATED';
ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_PROFILE_UPDATED';
ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_PROFILE_DEFAULT_CHANGED';
ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_PROFILE_ACTIVE_CHANGED';
ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_ITEM_UPSERTED';
ALTER TYPE "PayrollAuditEventType" ADD VALUE 'PAYROLL_MAPPING_ITEM_DEACTIVATED';
