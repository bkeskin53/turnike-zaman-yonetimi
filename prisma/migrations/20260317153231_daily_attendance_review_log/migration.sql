-- CreateTable
CREATE TABLE "DailyAttendanceReviewLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dailyAttendanceId" TEXT NOT NULL,
    "fromStatus" "AttendanceReviewStatus",
    "toStatus" "AttendanceReviewStatus" NOT NULL,
    "actedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendanceReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAttendanceReviewLog_companyId_dailyAttendanceId_create_idx" ON "DailyAttendanceReviewLog"("companyId", "dailyAttendanceId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyAttendanceReviewLog_companyId_createdAt_idx" ON "DailyAttendanceReviewLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "DailyAttendanceReviewLog" ADD CONSTRAINT "DailyAttendanceReviewLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceReviewLog" ADD CONSTRAINT "DailyAttendanceReviewLog_dailyAttendanceId_fkey" FOREIGN KEY ("dailyAttendanceId") REFERENCES "DailyAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
