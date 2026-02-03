import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import {
  getDailyAdjustmentForEmployeeOnDate,
} from "@/src/services/dailyAdjustment.service";
import { resolveShiftForEmployeeOnDate } from "@/src/services/shiftPlan.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

// GET /api/employees/[id]/daily?date=YYYY-MM-DD
// Returns the daily attendance record for a specific employee and date.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrNull();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Only ADMIN or HR roles can view daily attendance
    if (session.role !== "ADMIN" && session.role !== "HR") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    }
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
    }
    const companyId = await getActiveCompanyId();
    // workDate stored as UTC date in DB
    const workDate = dbDateFromDayKey(date);
    const item = await prisma.dailyAttendance.findFirst({
      where: {
        companyId,
        employeeId: id,
        workDate,
      },
      select: {
        id: true,
        employeeId: true,
        firstIn: true,
        lastOut: true,
        workedMinutes: true,
        overtimeMinutes: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        status: true,
        anomalies: true,
      },
    });
    if (item) {
      // Fetch any manual adjustment for this employee and date (local)
      const adj = await getDailyAdjustmentForEmployeeOnDate(id, date);
      const applied: any = applyDailyAdjustment(item as any, adj as any);

      // Shift source visibility (UI only) - does not affect computation.
      try {
        const resolved = await resolveShiftForEmployeeOnDate(id, date);
        applied.shiftSource = resolved.source;
        applied.shiftSignature = resolved.signature.signature;
        applied.shiftBadge =
          resolved.source === "DAY_TEMPLATE"
            ? `📌 ${resolved.signature.signature}${resolved.signature.spansMidnight ? " 🌙" : ""}`
            : resolved.source === "CUSTOM"
              ? `✏️ ${resolved.signature.signature}${resolved.signature.spansMidnight ? " 🌙" : ""}`
              : resolved.source === "WEEK_TEMPLATE"
                ? `📅 ${resolved.signature.signature}${resolved.signature.spansMidnight ? " 🌙" : ""}`
                : `🧩 ${resolved.signature.signature}${resolved.signature.spansMidnight ? " 🌙" : ""}`;
      } catch {
        // Non-critical: keep API stable even if shift resolution fails
     }

      // Optionally flag if a manual override was applied
      if (adj) {
        applied.manualOverrideApplied = true;
      }
      return NextResponse.json({ item: applied });
    }
    return NextResponse.json({ item: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("[api/employees/[id]/daily][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}