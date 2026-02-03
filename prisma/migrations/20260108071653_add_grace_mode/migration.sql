-- CreateEnum
CREATE TYPE "GraceMode" AS ENUM ('ROUND_ONLY', 'PAID_PARTIAL');

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "graceMode" "GraceMode" NOT NULL DEFAULT 'ROUND_ONLY';
