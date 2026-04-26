import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { setDailyAttendanceReviewStatus } from "@/src/services/attendanceReview.service";
import {
  logPayrollReviewNoteChanged,
  logPayrollReviewStatusChanged,
} from "@/src/services/puantaj/audit.service";
import { getActiveCompanyId } from "@/src/services/company.service";

function monthFromDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
}

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"].includes(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)).filter(Boolean) : [];
    const status = String(body?.status ?? "").trim().toUpperCase();
    const note = body?.note ? String(body.note) : null;
    const actorUserId = String((session as any).userId ?? (session as any).id ?? "");
    const companyId = await getActiveCompanyId();

    if (!ids.length) {
      return NextResponse.json({ error: "IDS_REQUIRED" }, { status: 400 });
    }

    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "INVALID_REVIEW_STATUS" }, { status: 400 });
    }

    const results = [];
    for (const id of ids) {
      const item = await setDailyAttendanceReviewStatus({
        id,
        status: status as "APPROVED" | "REJECTED" | "PENDING",
        note,
        reviewedByUserId: actorUserId,
      });

      const month = monthFromDate(item.workDate);
      const nextNote = item.reviewNote ?? null;
      const prevNote = item.previousReviewNote ?? null;
      const nextStatus = item.reviewStatus ?? null;
      const prevStatus = item.previousReviewStatus ?? null;

      if (prevStatus !== nextStatus) {
        await logPayrollReviewStatusChanged({
          companyId,
          month,
          employeeId: item.employeeId,
          dailyAttendanceId: item.id,
          actorUserId,
          fromStatus: prevStatus,
          toStatus: nextStatus,
          note: nextNote,
        });
      }

      if (prevNote !== nextNote) {
        await logPayrollReviewNoteChanged({
          companyId,
          month,
          employeeId: item.employeeId,
          dailyAttendanceId: item.id,
          actorUserId,
          note: nextNote,
        });
      }
      
      results.push(item);
    }

    return NextResponse.json({ ok: true, count: results.length });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "REVIEW_BULK_UPDATE_FAILED",
        message: error?.message ?? "UNKNOWN_ERROR",
      },
      { status: 400 }
    );
  }
}