-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "scheduledOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unscheduledOvertimeMinutes" INTEGER NOT NULL DEFAULT 0;
