import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { recomputeAttendanceForDate } from "@/src/services/attendance.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date_required" }, { status: 400 });
    }

    const data = await recomputeAttendanceForDate(date);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.RECOMPUTE,
      targetType: AuditTargetType.ATTENDANCE,
      targetId: date, // date is safe & useful as targetId
      details: {
        date,
        employeesComputed: data?.employeesComputed ?? null,
        presentCount: data?.presentCount ?? null,
        absentCount: data?.absentCount ?? null,
        missingPunchCount: data?.missingPunchCount ?? null,
      },
    });

    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;

    console.error("recompute error:", err);
    const message = err instanceof Error ? err.message : "unknown_error";

    // ✅ DEV'de hata mesajını göster (prod'da gösterme)
    return NextResponse.json(
      { error: "server_error", message: process.env.NODE_ENV !== "production" ? message : undefined },
      { status: 500 }
    );
  }
}
