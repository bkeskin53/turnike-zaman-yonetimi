/*
  Warnings:

  - Added the required column `quantityStrategy` to the `PayrollCodeMappingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityStrategy` to the `PayrollPeriodSnapshotCodeRow` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PayrollCodeMappingQuantityStrategy" AS ENUM ('WORKED_MINUTES', 'OVERTIME_MINUTES', 'FIXED_QUANTITY');

-- AlterEnum
ALTER TYPE "PayrollCodeMappingItemUnit" ADD VALUE 'COUNT';

-- AlterEnum
ALTER TYPE "PayrollSnapshotQuantityUnit" ADD VALUE 'COUNT';

-- AlterTable
ALTER TABLE "PayrollCodeMappingItem" ADD COLUMN     "fixedQuantity" DECIMAL(12,2),
ADD COLUMN     "quantityStrategy" "PayrollCodeMappingQuantityStrategy" NOT NULL;

-- AlterTable
ALTER TABLE "PayrollPeriodSnapshotCodeRow" ADD COLUMN     "fixedQuantity" DECIMAL(12,2),
ADD COLUMN     "quantityStrategy" "PayrollCodeMappingQuantityStrategy" NOT NULL;
