-- CreateEnum
CREATE TYPE "WorkedCalculationMode" AS ENUM ('ACTUAL', 'CLAMP_TO_SHIFT');

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "workedCalculationMode" "WorkedCalculationMode" NOT NULL DEFAULT 'ACTUAL';
