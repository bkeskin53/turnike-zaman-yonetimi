import { AttendanceReviewStatus } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listDailyAttendanceReviewLogs, updateDailyAttendanceReview } from "@/src/repositories/attendance.repo";

export async function setDailyAttendanceReviewStatus(input: {
  id: string;
  status: "APPROVED" | "REJECTED" | "PENDING";
  note?: string | null;
  reviewedByUserId?: string | null;
}) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("DAILY_ATTENDANCE_ID_REQUIRED");

  const status = String(input.status ?? "").toUpperCase();
  if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
    throw new Error("INVALID_REVIEW_STATUS");
  }

  const mapped = status as AttendanceReviewStatus;

  return updateDailyAttendanceReview({
    id,
    companyId,
    reviewStatus: mapped,
    reviewedAt: new Date(),
    reviewedByUserId: input.reviewedByUserId ?? null,
    reviewNote: input.note ?? null,
  });
}

export async function getDailyAttendanceReviewLogs(input: { dailyAttendanceId: string }) {
  const companyId = await getActiveCompanyId();
  const dailyAttendanceId = String(input.dailyAttendanceId ?? "").trim();
  if (!dailyAttendanceId) throw new Error("DAILY_ATTENDANCE_ID_REQUIRED");

  return listDailyAttendanceReviewLogs({
    companyId,
    dailyAttendanceId,
  });
}