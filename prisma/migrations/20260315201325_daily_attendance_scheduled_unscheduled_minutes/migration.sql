-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "scheduledWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unscheduledWorkedMinutes" INTEGER NOT NULL DEFAULT 0;
