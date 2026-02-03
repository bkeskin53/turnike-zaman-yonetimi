-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "overtimeEarlyMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeLateMinutes" INTEGER NOT NULL DEFAULT 0;
