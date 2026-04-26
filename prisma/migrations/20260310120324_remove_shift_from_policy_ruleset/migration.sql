/*
  Warnings:

  - You are about to drop the column `shiftEndMinute` on the `PolicyRuleSet` table. All the data in the column will be lost.
  - You are about to drop the column `shiftStartMinute` on the `PolicyRuleSet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PolicyRuleSet" DROP COLUMN "shiftEndMinute",
DROP COLUMN "shiftStartMinute";
