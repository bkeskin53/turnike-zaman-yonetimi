import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { upsertWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";
import { findEmployeesNotOverlappingEmploymentRange } from "@/src/services/employmentGuard.service";
import { auditLog } from "@/src/services/audit.service";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pickDayFields(p: {
  monShiftTemplateId: string | null;
  tueShiftTemplateId: string | null;
  wedShiftTemplateId: string | null;
  thuShiftTemplateId: string | null;
  friShiftTemplateId: string | null;
  satShiftTemplateId: string | null;
  sunShiftTemplateId: string | null;
}): Array<string | null> {
  return [
    p.monShiftTemplateId ?? null,
    p.tueShiftTemplateId ?? null,
    p.wedShiftTemplateId ?? null,
    p.thuShiftTemplateId ?? null,
    p.friShiftTemplateId ?? null,
    p.satShiftTemplateId ?? null,
    p.sunShiftTemplateId ?? null,
  ];
}

export async function GET(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";

    const url = new URL(req.url);
    const weekStartDate = String(url.searchParams.get("weekStartDate") ?? "").trim();
    if (!weekStartDate) return NextResponse.json({ error: "WEEK_START_REQUIRED" }, { status: 400 });
    if (!isISODate(weekStartDate)) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    const dt = DateTime.fromISO(weekStartDate, { zone: tz });
    if (!dt.isValid) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    if (dt.weekday !== 1) return NextResponse.json({ error: "WEEK_START_MUST_BE_MONDAY" }, { status: 400 });

    const weekStartUTC = computeWeekStartUTC(weekStartDate, tz);

    const plans = await prisma.weeklyShiftPlan.findMany({
      where: { companyId, weekStartDate: weekStartUTC },
      select: {
        employeeId: true,
        shiftTemplateId: true,
        monShiftTemplateId: true,
        tueShiftTemplateId: true,
        wedShiftTemplateId: true,
        thuShiftTemplateId: true,
        friShiftTemplateId: true,
        satShiftTemplateId: true,
        sunShiftTemplateId: true,
      },
    });

    const plansByEmployeeId: Record<
      string,
      { employeeId: string; weekTemplateId: string | null; dayTemplateIds: Array<string | null> }
    > = {};
    for (const p of plans) {
      plansByEmployeeId[p.employeeId] = {
        employeeId: p.employeeId,
        weekTemplateId: p.shiftTemplateId ?? null,
        dayTemplateIds: pickDayFields(p),
      };
    }

    return NextResponse.json({ ok: true, weekStartDate, plansByEmployeeId });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-assignments/planner] GET unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";

    const body: any = await req.json().catch(() => ({}));
    const weekStartDate = String(body?.weekStartDate ?? "").trim();
    const plans: any[] = Array.isArray(body?.plans) ? body.plans : [];

    if (!weekStartDate) return NextResponse.json({ error: "WEEK_START_REQUIRED" }, { status: 400 });
    if (!isISODate(weekStartDate)) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });

    const dt = DateTime.fromISO(weekStartDate, { zone: tz });
    if (!dt.isValid) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    if (dt.weekday !== 1) return NextResponse.json({ error: "WEEK_START_MUST_BE_MONDAY" }, { status: 400 });
    if (plans.length === 0) return NextResponse.json({ error: "PLANS_REQUIRED" }, { status: 400 });

    // Normalize + validate plan inputs
    const normalizedPlans: Array<{
      employeeId: string;
      weekTemplateId: string | null;
      dayTemplateIds: Array<string | null>; // length 7
    }> = [];

    for (const p of plans) {
      const employeeId = String(p?.employeeId ?? "").trim();
      if (!employeeId) return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });
      const weekTemplateId = p?.weekTemplateId ? String(p.weekTemplateId).trim() : null;
      const dayTemplateIdsRaw: any[] = Array.isArray(p?.dayTemplateIds) ? p.dayTemplateIds : [];
      if (dayTemplateIdsRaw.length !== 7) {
        return NextResponse.json({ error: "DAY_TEMPLATE_IDS_LENGTH_INVALID" }, { status: 400 });
      }
      const dayTemplateIds = dayTemplateIdsRaw.map((x) => (x ? String(x).trim() : null));
      normalizedPlans.push({ employeeId, weekTemplateId, dayTemplateIds });
    }

    const uniqEmployeeIds = Array.from(new Set(normalizedPlans.map((p) => p.employeeId)));
    const existing = await prisma.employee.findMany({
      where: { companyId, id: { in: uniqEmployeeIds } },
      select: { id: true },
    });
    if (existing.length !== uniqEmployeeIds.length) {
      return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }

    const weekStartUTC = computeWeekStartUTC(weekStartDate, tz);
    const weekEndDate = DateTime.fromISO(weekStartDate, { zone: tz }).plus({ days: 6 }).toISODate()!;

    // Employment validity guard (same as bulk week assignment)
    const notOkIds = await findEmployeesNotOverlappingEmploymentRange({
      companyId,
      employeeIds: uniqEmployeeIds,
      fromDayKey: weekStartDate,
      toDayKey: weekEndDate,
    });
    if (notOkIds.length > 0) {
      const bad = await prisma.employee.findMany({
       where: { companyId, id: { in: notOkIds } },
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
        orderBy: [{ employeeCode: "asc" }],
      });
      return NextResponse.json(
       {
          error: "EMPLOYEE_NOT_EMPLOYED_ON_WEEK",
          message: "Bazı personeller seçilen hafta aralığında employment validity dışında olduğu için plan yazılamadı.",
          meta: {
            weekStartDate,
           weekEndDate,
            count: bad.length,
            employees: bad.map((e) => ({
              employeeId: e.id,
              employeeCode: e.employeeCode,
              fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
            })),
          },
        },
        { status: 400 }
      );
    }

    // Validate shift template IDs belong to this company (cross-company guard)
   const allTemplateIds = new Set<string>();
    for (const p of normalizedPlans) {
      if (p.weekTemplateId) allTemplateIds.add(p.weekTemplateId);
      for (const x of p.dayTemplateIds) if (x) allTemplateIds.add(x);
   }
    if (allTemplateIds.size > 0) {
      const ids = Array.from(allTemplateIds);
      const tpls = await prisma.shiftTemplate.findMany({
        where: { companyId, id: { in: ids } },
        select: { id: true },
      });
      if (tpls.length !== ids.length) {
        return NextResponse.json({ error: "SHIFT_TEMPLATE_NOT_FOUND" }, { status: 404 });
      }
    }

    const updates = normalizedPlans.map((p) => {
      const day = p.dayTemplateIds;

      // Important: planner manages TEMPLATE IDs.
      // When a day template is explicitly set, we clear legacy custom minutes for that day
      // so precedence becomes deterministic (DAY_TEMPLATE wins, CUSTOM removed).
     const clearIfSet = (tplId: string | null) => (tplId ? { clear: true } : { clear: false });

      const mon = clearIfSet(day[0]);
      const tue = clearIfSet(day[1]);
     const wed = clearIfSet(day[2]);
      const thu = clearIfSet(day[3]);
      const fri = clearIfSet(day[4]);
      const sat = clearIfSet(day[5]);
      const sun = clearIfSet(day[6]);

      return upsertWeeklyShiftPlan({
        companyId,
        employeeId: p.employeeId,
        weekStartDate: weekStartUTC,
        shiftTemplateId: p.weekTemplateId,

        monShiftTemplateId: day[0],
        tueShiftTemplateId: day[1],
        wedShiftTemplateId: day[2],
        thuShiftTemplateId: day[3],
        friShiftTemplateId: day[4],
        satShiftTemplateId: day[5],
        sunShiftTemplateId: day[6],

        monStartMinute: mon.clear ? null : undefined,
        monEndMinute: mon.clear ? null : undefined,
        tueStartMinute: tue.clear ? null : undefined,
        tueEndMinute: tue.clear ? null : undefined,
        wedStartMinute: wed.clear ? null : undefined,
        wedEndMinute: wed.clear ? null : undefined,
        thuStartMinute: thu.clear ? null : undefined,
        thuEndMinute: thu.clear ? null : undefined,
        friStartMinute: fri.clear ? null : undefined,
        friEndMinute: fri.clear ? null : undefined,
        satStartMinute: sat.clear ? null : undefined,
        satEndMinute: sat.clear ? null : undefined,
        sunStartMinute: sun.clear ? null : undefined,
        sunEndMinute: sun.clear ? null : undefined,
     });
    });

    await prisma.$transaction(updates);

    auditLog({
     action: "SHIFT_PLANNER_SAVE",
      companyId,
      actorUserId: session.userId,
      actorRole: session.role,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
      meta: {
        weekStartDate,
        weekStartUTC: weekStartUTC.toISOString(),
        employees: uniqEmployeeIds.length,
      },
    });

    return NextResponse.json({ ok: true, updated: uniqEmployeeIds.length });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-assignments/planner] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}