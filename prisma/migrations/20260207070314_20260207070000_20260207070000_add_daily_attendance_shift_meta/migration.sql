-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "shiftEndMinute" INTEGER,
ADD COLUMN     "shiftSignature" VARCHAR(32),
ADD COLUMN     "shiftSource" VARCHAR(20),
ADD COLUMN     "shiftSpansMidnight" BOOLEAN,
ADD COLUMN     "shiftStartMinute" INTEGER;
