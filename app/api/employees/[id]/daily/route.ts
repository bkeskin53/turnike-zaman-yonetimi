import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import {
  getDailyAdjustmentForEmployeeOnDate,
} from "@/src/services/dailyAdjustment.service";
import { resolveShiftForDay } from "@/src/services/shiftPlan.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { DateTime } from "luxon";

// GET /api/employees/[id]/daily?date=YYYY-MM-DD
// Returns the daily attendance record for a specific employee and date.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrNull();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Only ADMIN or HR roles can view daily attendance
    if (session.role !== "SYSTEM_ADMIN" && session.role !== "HR_OPERATOR") {
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
    const { company, policy } = await getCompanyBundle();
    const companyId = company.id;
    const tz = policy.timezone || "Europe/Istanbul";
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
        overtimeEarlyMinutes: true,
        overtimeLateMinutes: true,
        otBreakCount: true,
        otBreakDeductMinutes: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        status: true,
        anomalies: true,
        // Sales-safety: use engine-persisted shift meta if available
        shiftSource: true,
        shiftSignature: true,
        shiftStartMinute: true,
        shiftEndMinute: true,
        shiftSpansMidnight: true,
      },
    });
    if (item) {
      // Fetch any manual adjustment for this employee and date (local)
      const adj = await getDailyAdjustmentForEmployeeOnDate(id, date);
      const applied: any = applyDailyAdjustment(item as any, adj as any);

      // Shift meta:
      // Prefer engine-persisted values from DailyAttendance to avoid UI/engine drift.
      // Fallback to resolver only for legacy rows that predate shift meta persistence.
      const persistedSrc = (item as any).shiftSource as
        | "POLICY"
        | "WEEK_TEMPLATE"
        | "DAY_TEMPLATE"
        | "CUSTOM"
        | null
        | undefined;
      const persistedSig = (item as any).shiftSignature as string | null | undefined;
      const persistedStartMinute = (item as any).shiftStartMinute as number | null | undefined;
      const persistedEndMinute = (item as any).shiftEndMinute as number | null | undefined;
      const persistedSpans = (item as any).shiftSpansMidnight as boolean | null | undefined;
      if (persistedSrc && persistedSig) {
        applied.shiftSource = persistedSrc;
        applied.shiftSignature = persistedSig;
        if (typeof persistedStartMinute === "number") applied.shiftStartMinute = persistedStartMinute;
        if (typeof persistedEndMinute === "number") applied.shiftEndMinute = persistedEndMinute;
        if (typeof persistedSpans === "boolean") applied.shiftSpansMidnight = persistedSpans;
        const moon = persistedSpans ? " 🌙" : "";
        const prefix =
         persistedSrc === "DAY_TEMPLATE"
            ? "📌 "
            : persistedSrc === "CUSTOM"
              ? "✏️ "
              : persistedSrc === "WEEK_TEMPLATE"
                ? "📅 "
                : "🧩 ";
        applied.shiftBadge = `${prefix}${persistedSig}${moon}`;
      } else {
        // Legacy fallback (non-critical)
        try {
          const resolved = await resolveShiftForDay(id, date);
          applied.shiftSource = resolved.source;
          applied.shiftSignature = resolved.signature;
          if (typeof resolved.startMinute === "number") applied.shiftStartMinute = resolved.startMinute;
          if (typeof resolved.endMinute === "number") applied.shiftEndMinute = resolved.endMinute;
          applied.shiftSpansMidnight = !!resolved.spansMidnight;
          applied.shiftBadge =
            resolved.source === "DAY_TEMPLATE"
              ? `📌 ${resolved.signature}${resolved.spansMidnight ? " 🌙" : ""}`
              : resolved.source === "CUSTOM"
               ? `✏️ ${resolved.signature}${resolved.spansMidnight ? " 🌙" : ""}`
                : resolved.source === "WEEK_TEMPLATE"
                  ? `📅 ${resolved.signature}${resolved.spansMidnight ? " 🌙" : ""}`
                  : `🧩 ${resolved.signature}${resolved.spansMidnight ? " 🌙" : ""}`;
        } catch {
          // Non-critical: keep API stable even if shift resolution fails
        }
      }

      // Context fields for UX clarity (no engine change)
      applied.dayKey = date;
      applied.shiftTimezone = tz;
      const sm = typeof applied.shiftStartMinute === "number" ? (applied.shiftStartMinute as number) : null;
      const em = typeof applied.shiftEndMinute === "number" ? (applied.shiftEndMinute as number) : null;
      const spans = !!applied.shiftSpansMidnight;
      if (sm != null && em != null) {
        const dayStartLocal = DateTime.fromISO(date, { zone: tz }).startOf("day");
        const startLocal = dayStartLocal.plus({ minutes: sm });
        let endLocal = dayStartLocal.plus({ minutes: em });
        if (spans || em <= sm) endLocal = endLocal.plus({ days: 1 });
        applied.shiftWindowStart = startLocal.toISO();
        applied.shiftWindowEnd = endLocal.toISO();
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