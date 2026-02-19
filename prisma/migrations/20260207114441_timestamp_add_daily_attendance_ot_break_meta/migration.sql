-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "otBreakCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otBreakDeductMinutes" INTEGER NOT NULL DEFAULT 0;
