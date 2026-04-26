import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession, withCompanyEmployeeWhere } from "@/src/auth/scope";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { upsertWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";
import { findEmployeesNotOverlappingEmploymentRange } from "@/src/services/employmentGuard.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole, RecomputeReason } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildDayKeys(startISO: string, endISO: string): string[] {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid || !e.isValid) return [];
  const days = Math.floor(e.diff(s, "days").days) + 1;
  const safeDays = Math.max(1, Math.min(days, 62)); // UI ile aynı guard
  const out: string[] = [];
  for (let i = 0; i < safeDays; i++) out.push(s.plus({ days: i }).toISODate()!);
  return out;
}

function dayIndexInWeekFromISO(iso: string): number {
  const dt = DateTime.fromISO(iso);
  // Mon=1..Sun=7 => 0..6
  return dt.isValid ? dt.weekday - 1 : 0;
}

function getDayFieldName(dayIndex: number) {
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dayIndex] ?? "mon";
}

function parseEmployeeIds(url: URL): string[] {
  const csv = String(url.searchParams.get("employeeIds") ?? "").trim();
  if (!csv) return [];
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  ).slice(0, 200);
}

export async function GET(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";

    const url = new URL(req.url);
    const rangeStartDate = String(url.searchParams.get("rangeStartDate") ?? "").trim();
    const rangeEndDate = String(url.searchParams.get("rangeEndDate") ?? "").trim();
    if (!rangeStartDate || !rangeEndDate) return NextResponse.json({ error: "RANGE_REQUIRED" }, { status: 400 });
    if (!isISODate(rangeStartDate) || !isISODate(rangeEndDate)) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });
    const s = DateTime.fromISO(rangeStartDate, { zone: tz });
    const e = DateTime.fromISO(rangeEndDate, { zone: tz });
    if (!s.isValid || !e.isValid || e < s) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });

    const dayKeys = buildDayKeys(rangeStartDate, rangeEndDate);
    if (dayKeys.length === 0) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });

    const requestedEmployeeIds = parseEmployeeIds(url);
    const scopeWhere = await getEmployeeScopeWhereForSession(session);
    const employeeWhere: any = withCompanyEmployeeWhere(companyId, scopeWhere);
    if (requestedEmployeeIds.length > 0) {
      employeeWhere.id = { in: requestedEmployeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true },
      orderBy: [{ employeeCode: "asc" }],
    });

    if (employees.length === 0) {
      return NextResponse.json({ ok: true, rangeStartDate, rangeEndDate, plansByEmployeeId: {} });
    }

    const scopedEmployeeIds = employees.map((e) => e.id);

    // range içinde geçen haftaları bul (weeklyShiftPlan key’i: weekStartUTC)
    const weekStartISOSet = new Set<string>();
    for (const dayKey of dayKeys) {
      const d = DateTime.fromISO(dayKey, { zone: tz });
      if (!d.isValid) continue;
      const monday = d.minus({ days: d.weekday - 1 }).toISODate();
      if (monday) weekStartISOSet.add(monday);
    }
    const weekStartISOs = Array.from(weekStartISOSet).sort();
    const weekStartUTCs = weekStartISOs.map((iso) => computeWeekStartUTC(iso, tz));

    const plans = await prisma.weeklyShiftPlan.findMany({
      where: { companyId, employeeId: { in: scopedEmployeeIds }, weekStartDate: { in: weekStartUTCs } },
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
        weekStartDate: true,
      },
    });

    // index: employeeId + weekStartUTC ISO string
    const byEmpWeek: Record<string, any> = {};
    for (const p of plans) {
      const k = `${p.employeeId}:${new Date(p.weekStartDate).toISOString()}`;
      byEmpWeek[k] = p;
    }

    // Build per-employee N-day plan
    const plansByEmployeeId: Record<string, { employeeId: string; rangeTemplateId: string | null; dayTemplateIds: Array<string | null> }> = {};

    // For determinism: rangeTemplateId sadece tüm haftalarda aynıysa set et, aksi halde null (mixed)
    function getDayTemplateFromWeekly(w: any, dayIndex0: number): string | null {
      if (!w) return null;
      switch (dayIndex0) {
        case 0: return w.monShiftTemplateId ?? null;
        case 1: return w.tueShiftTemplateId ?? null;
        case 2: return w.wedShiftTemplateId ?? null;
        case 3: return w.thuShiftTemplateId ?? null;
        case 4: return w.friShiftTemplateId ?? null;
        case 5: return w.satShiftTemplateId ?? null;
        case 6: return w.sunShiftTemplateId ?? null;
        default: return null;
      }
    }

    for (const emp of employees) {
      const dayTemplateIds: Array<string | null> = [];
      const weekDefaults = new Set<string | null>();

      for (const dayKey of dayKeys) {
        const d = DateTime.fromISO(dayKey, { zone: tz });
        const mondayISO = d.minus({ days: d.weekday - 1 }).toISODate()!;
        const weekUTC = computeWeekStartUTC(mondayISO, tz);
        const w = byEmpWeek[`${emp.id}:${weekUTC.toISOString()}`];
        weekDefaults.add((w?.shiftTemplateId ?? null) as (string | null));
        dayTemplateIds.push(getDayTemplateFromWeekly(w, dayIndexInWeekFromISO(dayKey)));
      }

      const uniqDefaults = Array.from(weekDefaults);
      const rangeTemplateId = uniqDefaults.length === 1 ? (uniqDefaults[0] ?? null) : null;

      plansByEmployeeId[emp.id] = {
        employeeId: emp.id,
        rangeTemplateId,
        dayTemplateIds,
      };
    }

    return NextResponse.json({ ok: true, rangeStartDate, rangeEndDate, plansByEmployeeId });
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
    const rangeStartDate = String(body?.rangeStartDate ?? "").trim();
    const rangeEndDate = String(body?.rangeEndDate ?? "").trim();
    const plans: any[] = Array.isArray(body?.plans) ? body.plans : [];

    if (!rangeStartDate || !rangeEndDate) return NextResponse.json({ error: "RANGE_REQUIRED" }, { status: 400 });
    if (!isISODate(rangeStartDate) || !isISODate(rangeEndDate)) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });
    const s = DateTime.fromISO(rangeStartDate, { zone: tz });
    const e = DateTime.fromISO(rangeEndDate, { zone: tz });
    if (!s.isValid || !e.isValid || e < s) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });
    if (plans.length === 0) return NextResponse.json({ error: "PLANS_REQUIRED" }, { status: 400 });

    const dayKeys = buildDayKeys(rangeStartDate, rangeEndDate);
    if (dayKeys.length === 0) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });

    // Normalize + validate plan inputs
    const normalizedPlans: Array<{
      employeeId: string;
      rangeTemplateId: string | null;
      dayTemplateIds: Array<string | null>; // length = rangeDays
    }> = [];

    for (const p of plans) {
      const employeeId = String(p?.employeeId ?? "").trim();
      if (!employeeId) return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });
      const rangeTemplateId = p?.rangeTemplateId ? String(p.rangeTemplateId).trim() : null;
      const dayTemplateIdsRaw: any[] = Array.isArray(p?.dayTemplateIds) ? p.dayTemplateIds : [];
      if (dayTemplateIdsRaw.length !== dayKeys.length) {
        return NextResponse.json({ error: "DAY_TEMPLATE_IDS_LENGTH_INVALID" }, { status: 400 });
      }
      const dayTemplateIds = dayTemplateIdsRaw.map((x) => (x ? String(x).trim() : null));
      normalizedPlans.push({ employeeId, rangeTemplateId, dayTemplateIds });
    }

    const uniqEmployeeIds = Array.from(new Set(normalizedPlans.map((p) => p.employeeId)));
    const existing = await prisma.employee.findMany({
      where: { companyId, id: { in: uniqEmployeeIds } },
      select: { id: true },
    });
    if (existing.length !== uniqEmployeeIds.length) {
      return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }

    const rangeStart = rangeStartDate;
    const rangeEnd = rangeEndDate;

    // Employment validity guard (same as bulk week assignment)
    const notOkIds = await findEmployeesNotOverlappingEmploymentRange({
      companyId,
      employeeIds: uniqEmployeeIds,
      fromDayKey: rangeStart,
      toDayKey: rangeEnd,
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
            rangeStartDate: rangeStart,
            rangeEndDate: rangeEnd,
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
      if (p.rangeTemplateId) allTemplateIds.add(p.rangeTemplateId);
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

    // Weeks touched by range
    const weekStartISOSet = new Set<string>();
    for (const dk of dayKeys) {
      const d = DateTime.fromISO(dk, { zone: tz });
      const mondayISO = d.minus({ days: d.weekday - 1 }).toISODate();
      if (mondayISO) weekStartISOSet.add(mondayISO);
    }
    const weekStartISOs = Array.from(weekStartISOSet).sort();
    const weekStartUTCs = weekStartISOs.map((iso) => computeWeekStartUTC(iso, tz));

    // Load existing weekly plans for affected employees+weeks (to avoid wiping days outside range)
    const existingWeekly = await prisma.weeklyShiftPlan.findMany({
      where: { companyId, employeeId: { in: uniqEmployeeIds }, weekStartDate: { in: weekStartUTCs } },
      select: {
        employeeId: true,
        weekStartDate: true,
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
    const existingMap: Record<string, any> = {};
    for (const w of existingWeekly) {
      existingMap[`${w.employeeId}:${new Date(w.weekStartDate).toISOString()}`] = w;
    }

    function mergeDayTemplates(base: any) {
      return {
        monShiftTemplateId: base?.monShiftTemplateId ?? null,
        tueShiftTemplateId: base?.tueShiftTemplateId ?? null,
        wedShiftTemplateId: base?.wedShiftTemplateId ?? null,
        thuShiftTemplateId: base?.thuShiftTemplateId ?? null,
        friShiftTemplateId: base?.friShiftTemplateId ?? null,
        satShiftTemplateId: base?.satShiftTemplateId ?? null,
        sunShiftTemplateId: base?.sunShiftTemplateId ?? null,
      };
    }

    const updates: any[] = [];

    for (const p of normalizedPlans) {
      // Per employee, per week payload
      const perWeek: Record<string, { weekStartUTC: Date; dayIds: Array<string | null | undefined> }> = {};
      // init each touched week with undefined (do not touch), later fill only touched days
      for (const wsISO of weekStartISOs) {
        const wsUTC = computeWeekStartUTC(wsISO, tz);
        perWeek[wsUTC.toISOString()] = { weekStartUTC: wsUTC, dayIds: Array.from({ length: 7 }).map(() => undefined) };
      }

      // Assign each range day into its week/day index slot
      for (let i = 0; i < dayKeys.length; i++) {
        const dayKey = dayKeys[i]!;
        const d = DateTime.fromISO(dayKey, { zone: tz });
        const mondayISO = d.minus({ days: d.weekday - 1 }).toISODate()!;
        const wsUTC = computeWeekStartUTC(mondayISO, tz);
        const idx0 = d.weekday - 1;
        perWeek[wsUTC.toISOString()]!.dayIds[idx0] = p.dayTemplateIds[i] ?? null; // explicit null allowed
      }

      // Build upsert calls
      for (const entry of Object.values(perWeek)) {
        const wsUTC = entry.weekStartUTC;
        const base = existingMap[`${p.employeeId}:${wsUTC.toISOString()}`];
        const merged = mergeDayTemplates(base);

        // Apply touched days (undefined means untouched)
        const nextDays = [...entry.dayIds];
        const finalMon = nextDays[0] === undefined ? merged.monShiftTemplateId : (nextDays[0] as any);
        const finalTue = nextDays[1] === undefined ? merged.tueShiftTemplateId : (nextDays[1] as any);
        const finalWed = nextDays[2] === undefined ? merged.wedShiftTemplateId : (nextDays[2] as any);
        const finalThu = nextDays[3] === undefined ? merged.thuShiftTemplateId : (nextDays[3] as any);
        const finalFri = nextDays[4] === undefined ? merged.friShiftTemplateId : (nextDays[4] as any);
        const finalSat = nextDays[5] === undefined ? merged.satShiftTemplateId : (nextDays[5] as any);
        const finalSun = nextDays[6] === undefined ? merged.sunShiftTemplateId : (nextDays[6] as any);

        // Enterprise determinism (range-safe):
        // Sadece range içinde dokunduğumuz günlerin custom minutes’larını temizle.
        const clear0 = nextDays[0] !== undefined;
        const clear1 = nextDays[1] !== undefined;
        const clear2 = nextDays[2] !== undefined;
        const clear3 = nextDays[3] !== undefined;
        const clear4 = nextDays[4] !== undefined;
        const clear5 = nextDays[5] !== undefined;
        const clear6 = nextDays[6] !== undefined;

        updates.push(
          upsertWeeklyShiftPlan({
            companyId,
            employeeId: p.employeeId,
            weekStartDate: wsUTC,
            // range default template: bu haftaya da yaz (rangeTemplateId null olabilir)
            shiftTemplateId: p.rangeTemplateId,

            monShiftTemplateId: finalMon,
            tueShiftTemplateId: finalTue,
            wedShiftTemplateId: finalWed,
            thuShiftTemplateId: finalThu,
            friShiftTemplateId: finalFri,
            satShiftTemplateId: finalSat,
            sunShiftTemplateId: finalSun,

            monStartMinute: clear0 ? null : undefined,
            monEndMinute: clear0 ? null : undefined,
            tueStartMinute: clear1 ? null : undefined,
            tueEndMinute: clear1 ? null : undefined,
            wedStartMinute: clear2 ? null : undefined,
            wedEndMinute: clear2 ? null : undefined,
            thuStartMinute: clear3 ? null : undefined,
            thuEndMinute: clear3 ? null : undefined,
            friStartMinute: clear4 ? null : undefined,
            friEndMinute: clear4 ? null : undefined,
            satStartMinute: clear5 ? null : undefined,
            satEndMinute: clear5 ? null : undefined,
            sunStartMinute: clear6 ? null : undefined,
            sunEndMinute: clear6 ? null : undefined,
          })
        );
      }
    }

    await prisma.$transaction(updates);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_ASSIGNMENT_UPDATED,
      targetType: AuditTargetType.SHIFT_ASSIGNMENT,
      // Bulk action: single targetId yok
      targetId: null,
      details: {
        op: "PLANNER_SAVE",
        rangeStartDate,
        rangeEndDate,
        employeeCount: uniqEmployeeIds.length,
        employeeIds: uniqEmployeeIds,
      },
    });

    // Recompute orchestration: bu ekran plan atamasını değiştiriyor -> range belli
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_ASSIGNMENT_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: rangeStartDate,
      rangeEndDayKey: rangeEndDate,
    });

    return NextResponse.json({ ok: true, updated: uniqEmployeeIds.length });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-assignments/planner] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}