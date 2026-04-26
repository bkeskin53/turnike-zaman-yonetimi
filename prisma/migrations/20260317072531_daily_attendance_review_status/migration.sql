-- CreateEnum
CREATE TYPE "AttendanceReviewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "DailyAttendance" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "AttendanceReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT;
