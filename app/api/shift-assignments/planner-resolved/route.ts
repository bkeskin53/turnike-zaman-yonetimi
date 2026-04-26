import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import {
  computeWeekStartUTC,
  resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan,
} from "@/src/services/shiftPlan.service";
import { resolveWorkScheduleShiftsForEmployeesOnDate } from "@/src/services/workSchedule.service";
import { getEmployeeScopeWhereForSession, withCompanyEmployeeWhere } from "@/src/auth/scope";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hhmmFromMinute(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildDayKeys(startISO: string, endISO: string): string[] {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid || !e.isValid) return [];
  const days = Math.floor(e.diff(s, "days").days) + 1;
  const safeDays = Math.max(1, Math.min(days, 62)); // 2 ay guard
  const out: string[] = [];
  for (let i = 0; i < safeDays; i++) out.push(s.plus({ days: i }).toISODate()!);
  return out;
}

function shiftBadgeFromMinutes(startMinute: number, endMinute: number): string {
  return `${hhmmFromMinute(startMinute)}–${hhmmFromMinute(endMinute)}`;
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

type ResolvedDay = {
  dayKey: string;
  shiftTimezone: string;
  shiftSource: string | null;
  shiftCode: string | null;
  shiftSignature: string | null;
  shiftBadge: string;
  shiftStartMinute: number | null;
  shiftEndMinute: number | null;
  shiftSpansMidnight: boolean;
};

export async function GET(req: NextRequest) {
  try {
    // Planner page is visible to SUPERVISOR too (read-only), so allow it here.
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const companyId = await getActiveCompanyId();

    const url = new URL(req.url);
    const rangeStartDate = String(url.searchParams.get("rangeStartDate") ?? "").trim();
    const rangeEndDate = String(url.searchParams.get("rangeEndDate") ?? "").trim();
    if (!rangeStartDate || !rangeEndDate) {
      return NextResponse.json({ error: "RANGE_REQUIRED" }, { status: 400 });
    }
    if (!isISODate(rangeStartDate) || !isISODate(rangeEndDate)) {
      return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });
    }

    const { policy } = await getCompanyBundle();
    const tz = String(policy?.timezone ?? "Europe/Istanbul");

    const s = DateTime.fromISO(rangeStartDate, { zone: tz });
    const e = DateTime.fromISO(rangeEndDate, { zone: tz });
    if (!s.isValid || !e.isValid) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });
    if (e < s) return NextResponse.json({ error: "RANGE_INVALID" }, { status: 400 });

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
      select: {
        id: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
        branchId: true,
      },
      orderBy: [{ employeeCode: "asc" }],
    });

    if (employees.length === 0) {
      return NextResponse.json({ ok: true, rangeStartDate, rangeEndDate, resolvedByEmployeeId: {} });
    }

    const employeeIds = employees.map((e) => e.id);

    const weekStartISOSet = new Set<string>();
    for (const dayKey of dayKeys) {
      const d = DateTime.fromISO(dayKey, { zone: tz });
      if (!d.isValid) continue;
      const mondayISO = d.minus({ days: d.weekday - 1 }).toISODate();
      if (mondayISO) weekStartISOSet.add(mondayISO);
    }
    const weekStartISOs = Array.from(weekStartISOSet).sort();
    const weekStartUTCs = weekStartISOs.map((iso) => computeWeekStartUTC(iso, tz));

    const weeklyPlans = await prisma.weeklyShiftPlan.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        weekStartDate: { in: weekStartUTCs },
      },
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
        monStartMinute: true,
        monEndMinute: true,
        tueStartMinute: true,
        tueEndMinute: true,
        wedStartMinute: true,
        wedEndMinute: true,
        thuStartMinute: true,
        thuEndMinute: true,
        friStartMinute: true,
        friEndMinute: true,
        satStartMinute: true,
        satEndMinute: true,
        sunStartMinute: true,
        sunEndMinute: true,
      },
    });

    const weeklyPlanMap = new Map<string, (typeof weeklyPlans)[number]>();
    for (const row of weeklyPlans) {
      weeklyPlanMap.set(`${row.employeeId}:${new Date(row.weekStartDate).toISOString()}`, row);
    }

    const workScheduleByDayKey = new Map<string, Map<string, any>>();
    for (const dayKey of dayKeys) {
      const ws = await resolveWorkScheduleShiftsForEmployeesOnDate({
        companyId,
        employees,
        dayKey,
        timezone: tz,
      });
      workScheduleByDayKey.set(dayKey, ws);
    }

    const resolvedByEmployeeId: Record<string, ResolvedDay[]> = {};

    for (const employee of employees) {
      const days: ResolvedDay[] = [];
      for (const dayKey of dayKeys) {
        const dt = DateTime.fromISO(dayKey, { zone: tz });
        const mondayISO = dt.minus({ days: dt.weekday - 1 }).toISODate()!;
        const weekUTC = computeWeekStartUTC(mondayISO, tz);
        const weeklyPlan = weeklyPlanMap.get(`${employee.id}:${weekUTC.toISOString()}`) ?? null;
        const workSchedule = workScheduleByDayKey.get(dayKey)?.get(employee.id);

        const resolved = await resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan({
          companyId,
          employeeId: employee.id,
          date: dayKey,
          timezone: tz,
          policy,
          weeklyPlan,
          workSchedule,
        });

        const isOff = !!resolved.isOffDay || String(resolved.signature ?? "").trim() === "OFF";
        const resolvedShiftCode = String(resolved.shiftCode ?? "").trim() || null;
        const hasMinutes = typeof resolved.startMinute === "number" && typeof resolved.endMinute === "number";
        const timeRange = hasMinutes
          ? shiftBadgeFromMinutes(resolved.startMinute!, resolved.endMinute!)
          : null;
        const badge = isOff
          ? "OFF"
          : resolvedShiftCode
            ? timeRange
              ? `${resolvedShiftCode} (${timeRange}${resolved.spansMidnight ? "+1" : ""})`
              : resolvedShiftCode
            : hasMinutes
              ? `${timeRange}${resolved.spansMidnight ? "+1" : ""}`
              : String(resolved.signature ?? "—").trim() || "—";

        days.push({
          dayKey,
          shiftTimezone: tz,
          shiftSource: resolved.source ?? null,
          shiftCode: resolvedShiftCode,
          shiftSignature: String(resolved.signature ?? "").trim() || null,
          shiftBadge: badge,
          shiftStartMinute: resolved.startMinute ?? null,
          shiftEndMinute: resolved.endMinute ?? null,
          shiftSpansMidnight: !!resolved.spansMidnight,
        });
      }
      resolvedByEmployeeId[employee.id] = days;
    }

    return NextResponse.json({ ok: true, rangeStartDate, rangeEndDate, resolvedByEmployeeId });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-assignments/planner-resolved] GET unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}