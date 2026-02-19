import { NextResponse } from "next/server";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";
import { findWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";
import { computeWeekStartUTC, saveWeeklyShiftPlan } from "@/src/services/shiftPlan.service";
import { DateTime } from "luxon";
import { findNotEmployedDayKeysForEmployee } from "@/src/services/employmentGuard.service";
 
// Convert a time string "HH:mm" to minutes since midnight. Returns null if invalid or empty.
function parseTimeToMinutes(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : val;
  }
  if (typeof val !== "string") return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(val.trim());  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return hh * 60 + mm;
}

function hasDayOverride(args: { tplId: any; startMin: any; endMin: any }): boolean {
  // Day Template override OR Custom minutes means we are explicitly writing day-level data.
  if (typeof args.tplId === "string" && args.tplId.trim()) return true;
  if (args.startMin != null) return true;
  if (args.endMin != null) return true;
  return false;
}

// GET /api/employees/[id]/weekly-plan?weekStart=YYYY-MM-DD
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const session = await getSessionOrNull();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Only ADMIN and HR roles can view shift plans
    if (session.role !== "SYSTEM_ADMIN" && session.role !== "HR_OPERATOR") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    }
    const url = new URL(req.url);
    const weekStart = url.searchParams.get("weekStart");
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "INVALID_WEEK" }, { status: 400 });
    }
    const { company, policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";
    const weekStartUTC = computeWeekStartUTC(weekStart, tz);
    const plan = await findWeeklyShiftPlan(company.id, id, weekStartUTC);
    if (!plan) {
      return NextResponse.json({ item: null });
    }
    // Convert plan to response object with start/end minutes (numbers or null)
    const item = {
      weekStartDate: weekStart,
      // Stage 3: week-level default template + day overrides
      shiftTemplateId: plan.shiftTemplateId ?? null,
      monShiftTemplateId: plan.monShiftTemplateId ?? null,
      tueShiftTemplateId: plan.tueShiftTemplateId ?? null,
      wedShiftTemplateId: plan.wedShiftTemplateId ?? null,
      thuShiftTemplateId: plan.thuShiftTemplateId ?? null,
      friShiftTemplateId: plan.friShiftTemplateId ?? null,
      satShiftTemplateId: plan.satShiftTemplateId ?? null,
      sunShiftTemplateId: plan.sunShiftTemplateId ?? null,
      monStartMinute: plan.monStartMinute ?? null,
      monEndMinute: plan.monEndMinute ?? null,
      tueStartMinute: plan.tueStartMinute ?? null,
      tueEndMinute: plan.tueEndMinute ?? null,
      wedStartMinute: plan.wedStartMinute ?? null,
      wedEndMinute: plan.wedEndMinute ?? null,
      thuStartMinute: plan.thuStartMinute ?? null,
      thuEndMinute: plan.thuEndMinute ?? null,
      friStartMinute: plan.friStartMinute ?? null,
      friEndMinute: plan.friEndMinute ?? null,
      satStartMinute: plan.satStartMinute ?? null,
      satEndMinute: plan.satEndMinute ?? null,
      sunStartMinute: plan.sunStartMinute ?? null,
      sunEndMinute: plan.sunEndMinute ?? null,
    };
    return NextResponse.json({ item });
  } catch (err: any) {
    console.error("[api/employees/[id]/weekly-plan][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST /api/employees/[id]/weekly-plan
// Body JSON: { weekStartDate: 'YYYY-MM-DD', monStart: 'HH:mm', monEnd: 'HH:mm', ... }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Only ADMIN or HR can modify shift plans
    if (session.role !== "SYSTEM_ADMIN" && session.role !== "HR_OPERATOR") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.weekStartDate !== "string") {
      return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
    }
    const weekStart = body.weekStartDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "INVALID_WEEK" }, { status: 400 });
    }
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";

    // Parse times to minutes; undefined or invalid strings become null
    const planInput: any = {
      employeeId: id,
      weekStartDate: weekStart,
      // Optional: week-level default template + day overrides (Stage 3)
      shiftTemplateId: typeof body.shiftTemplateId === "string" ? body.shiftTemplateId : null,
      monShiftTemplateId: typeof body.monShiftTemplateId === "string" ? body.monShiftTemplateId : null,
      tueShiftTemplateId: typeof body.tueShiftTemplateId === "string" ? body.tueShiftTemplateId : null,
      wedShiftTemplateId: typeof body.wedShiftTemplateId === "string" ? body.wedShiftTemplateId : null,
      thuShiftTemplateId: typeof body.thuShiftTemplateId === "string" ? body.thuShiftTemplateId : null,
      friShiftTemplateId: typeof body.friShiftTemplateId === "string" ? body.friShiftTemplateId : null,
      satShiftTemplateId: typeof body.satShiftTemplateId === "string" ? body.satShiftTemplateId : null,
      sunShiftTemplateId: typeof body.sunShiftTemplateId === "string" ? body.sunShiftTemplateId : null,
      monStartMinute: parseTimeToMinutes(body.monStart),
      monEndMinute: parseTimeToMinutes(body.monEnd),
      tueStartMinute: parseTimeToMinutes(body.tueStart),
      tueEndMinute: parseTimeToMinutes(body.tueEnd),
      wedStartMinute: parseTimeToMinutes(body.wedStart),
      wedEndMinute: parseTimeToMinutes(body.wedEnd),
      thuStartMinute: parseTimeToMinutes(body.thuStart),
      thuEndMinute: parseTimeToMinutes(body.thuEnd),
      friStartMinute: parseTimeToMinutes(body.friStart),
      friEndMinute: parseTimeToMinutes(body.friEnd),
      satStartMinute: parseTimeToMinutes(body.satStart),
      satEndMinute: parseTimeToMinutes(body.satEnd),
      sunStartMinute: parseTimeToMinutes(body.sunStart),
      sunEndMinute: parseTimeToMinutes(body.sunEnd),
    };

    // ✅ Eksik-3.5: Day override / custom minutes sadece employed günlere yazılabilir.
    // Week-level default template (shiftTemplateId) overlap varsa kalabilir; ama day-level yazım “validity” dışına çıkamaz.
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(DateTime.fromISO(weekStart, { zone: tz }).plus({ days: i }).toISODate()!);
    }

    // Determine which days are explicitly being overridden/customized
    const dayOverrideDayKeys: string[] = [];
    if (hasDayOverride({ tplId: planInput.monShiftTemplateId, startMin: planInput.monStartMinute, endMin: planInput.monEndMinute })) dayOverrideDayKeys.push(weekDays[0]);
    if (hasDayOverride({ tplId: planInput.tueShiftTemplateId, startMin: planInput.tueStartMinute, endMin: planInput.tueEndMinute })) dayOverrideDayKeys.push(weekDays[1]);
    if (hasDayOverride({ tplId: planInput.wedShiftTemplateId, startMin: planInput.wedStartMinute, endMin: planInput.wedEndMinute })) dayOverrideDayKeys.push(weekDays[2]);
    if (hasDayOverride({ tplId: planInput.thuShiftTemplateId, startMin: planInput.thuStartMinute, endMin: planInput.thuEndMinute })) dayOverrideDayKeys.push(weekDays[3]);
    if (hasDayOverride({ tplId: planInput.friShiftTemplateId, startMin: planInput.friStartMinute, endMin: planInput.friEndMinute })) dayOverrideDayKeys.push(weekDays[4]);
    if (hasDayOverride({ tplId: planInput.satShiftTemplateId, startMin: planInput.satStartMinute, endMin: planInput.satEndMinute })) dayOverrideDayKeys.push(weekDays[5]);
    if (hasDayOverride({ tplId: planInput.sunShiftTemplateId, startMin: planInput.sunStartMinute, endMin: planInput.sunEndMinute })) dayOverrideDayKeys.push(weekDays[6]);

    if (dayOverrideDayKeys.length > 0) {
      const notEmployed = await findNotEmployedDayKeysForEmployee({
        employeeId: id,
        dayKeys: dayOverrideDayKeys,
      });
      if (notEmployed.length > 0) {
        return NextResponse.json(
          {
            error: "EMPLOYEE_NOT_EMPLOYED_ON_DATES",
            message: "Personel employment validity dışında olan günlere day override / custom minutes kaydedilemez.",
            meta: {
              weekStartDate: weekStart,
              days: notEmployed,
            },
          },
          { status: 400 }
        );
      }
    }

    // Save plan
    await saveWeeklyShiftPlan(planInput);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/employees/[id]/weekly-plan][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}