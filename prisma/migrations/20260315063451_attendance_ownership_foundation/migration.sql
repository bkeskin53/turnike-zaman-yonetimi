/*
  Warnings:

  - Added the required column `attendanceOwnershipMode` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minimumRestMinutes` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownershipEarlyInMinutes` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownershipLateOutMinutes` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownershipNextShiftLookaheadMinutes` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unscheduledWorkBehavior` to the `PolicyRuleSet` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceOwnershipMode" AS ENUM ('WINDOW', 'INSTANCE_SCORING');

-- CreateEnum
CREATE TYPE "UnscheduledWorkBehavior" AS ENUM ('IGNORE', 'FLAG_ONLY', 'COUNT_AS_OT');

-- AlterTable
ALTER TABLE "CompanyPolicy" ADD COLUMN     "attendanceOwnershipMode" "AttendanceOwnershipMode" NOT NULL DEFAULT 'INSTANCE_SCORING',
ADD COLUMN     "minimumRestMinutes" INTEGER NOT NULL DEFAULT 660,
ADD COLUMN     "ownershipEarlyInMinutes" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "ownershipLateOutMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "ownershipNextShiftLookaheadMinutes" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "unscheduledWorkBehavior" "UnscheduledWorkBehavior" NOT NULL DEFAULT 'FLAG_ONLY';

-- AlterTable
ALTER TABLE "PolicyRuleSet" ADD COLUMN     "attendanceOwnershipMode" "AttendanceOwnershipMode" NOT NULL,
ADD COLUMN     "minimumRestMinutes" INTEGER NOT NULL,
ADD COLUMN     "ownershipEarlyInMinutes" INTEGER NOT NULL,
ADD COLUMN     "ownershipLateOutMinutes" INTEGER NOT NULL,
ADD COLUMN     "ownershipNextShiftLookaheadMinutes" INTEGER NOT NULL,
ADD COLUMN     "unscheduledWorkBehavior" "UnscheduledWorkBehavior" NOT NULL;
