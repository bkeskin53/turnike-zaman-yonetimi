import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getDailyAttendanceReviewLogs } from "@/src/services/attendanceReview.service";

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"].includes(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const dailyAttendanceId = String(url.searchParams.get("dailyAttendanceId") ?? "").trim();
    const items = await getDailyAttendanceReviewLogs({ dailyAttendanceId });
    return NextResponse.json({ ok: true, items });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "REVIEW_LOG_FETCH_FAILED",
        message: error?.message ?? "UNKNOWN_ERROR",
      },
      { status: 400 }
    );
  }
}