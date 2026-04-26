-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewReasons" TEXT[] DEFAULT ARRAY[]::TEXT[];
