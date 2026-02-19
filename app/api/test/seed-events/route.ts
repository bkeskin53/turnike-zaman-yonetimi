// app/api/test/seed-events/route.ts

import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { DateTime } from "luxon";
import { EventDirection, EventSource, Prisma } from "@prisma/client";
import { recomputeAttendanceForDate } from "@/src/services/attendance.service";

type Scenario =
  | "NORMAL"
  | "LATE"
  | "EARLY"
  | "OVERTIME"
  | "MISSING_PUNCH_IN"
  | "MISSING_PUNCH_OUT"
  | "DOUBLE_IN"
  | "DOUBLE_OUT"
  | "OFF_DAY_EVENTS"
  | "NIGHT_SHIFT";

type EmployeeScope = "ACTIVE" | "ALL" | "EMPLOYEE_CODES";

type SeedRequest = {
  fromDay: string; // YYYY-MM-DD
  toDay: string; // YYYY-MM-DD (inclusive)
  employeeScope?: EmployeeScope;
  employeeCodes?: string[];
  scenario?: Scenario;
  jitterMinutes?: number; // random +/- jitter
  daysOfWeek?: number[]; // 1..7 (Luxon weekday) or 0..6 accepted
  recompute?: boolean;
  commit?: boolean;
  maxEvents?: number;
};

function isDayKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampInt(n: unknown, def: number, min: number, max: number) {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : def;
  return Math.max(min, Math.min(max, x));
}

function normalizeWeekdays(input?: number[]): Set<number> | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const set = new Set<number>();
  for (const raw of input) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const v = Math.trunc(raw);
    // Accept both 0..6 (JS) and 1..7 (Luxon)
    if (v >= 0 && v <= 6) {
      // JS: 0=Sun..6=Sat => Luxon: 7=Sun, 1=Mon..6=Sat
      set.add(v === 0 ? 7 : v);
    } else if (v >= 1 && v <= 7) {
      set.add(v);
    }
  }
  return set.size ? set : null;
}

function randJitter(jitterMinutes: number) {
  if (!jitterMinutes) return 0;
  const r = Math.floor(Math.random() * (jitterMinutes * 2 + 1)) - jitterMinutes;
  return r;
}

function buildScenario(args: { scenario: Scenario; baseInMin: number; baseOutMin: number; dayIndex: number }) {
  const { scenario, baseInMin, baseOutMin } = args;

  switch (scenario) {
    case "NORMAL":
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.OUT, minute: baseOutMin },
      ];

    case "LATE":
      return [
        { dir: EventDirection.IN, minute: baseInMin + 12 },
        { dir: EventDirection.OUT, minute: baseOutMin },
      ];

    case "EARLY":
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.OUT, minute: baseOutMin - 40 },
      ];

    case "OVERTIME":
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.OUT, minute: baseOutMin + 180 },
      ];

    case "MISSING_PUNCH_IN":
      // Only OUT (common orphan)
      return [{ dir: EventDirection.OUT, minute: baseOutMin }];

    case "MISSING_PUNCH_OUT":
      // Only IN
      return [{ dir: EventDirection.IN, minute: baseInMin }];

    case "DOUBLE_IN":
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.IN, minute: baseInMin + 2 },
        { dir: EventDirection.OUT, minute: baseOutMin },
      ];

    case "DOUBLE_OUT":
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.OUT, minute: baseOutMin },
        { dir: EventDirection.OUT, minute: baseOutMin + 1 },
      ];

    case "OFF_DAY_EVENTS":
      // Create a couple of events mid-day. The OFF resolution depends on plan/policy.
      return [
        { dir: EventDirection.IN, minute: 12 * 60 },
        { dir: EventDirection.OUT, minute: 13 * 60 },
      ];

    case "NIGHT_SHIFT":
      // Start 22:00, end 06:00 next day (spans midnight)
      return [
        { dir: EventDirection.IN, minute: 22 * 60 },
        { dir: EventDirection.OUT, minute: 6 * 60, nextDay: true },
      ];

    default:
      return [
        { dir: EventDirection.IN, minute: baseInMin },
        { dir: EventDirection.OUT, minute: baseOutMin },
      ];
  }
}

function requireTestMode() {
  // Double-lock: must be explicit and never run in prod.
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.TEST_MODE !== "1") return false;
  return true;
}

export async function POST(req: Request) {
  try {
    if (!requireTestMode()) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

    const body = (await req.json().catch(() => null)) as SeedRequest | null;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const fromDay = String(body.fromDay ?? "");
    const toDay = String(body.toDay ?? "");
    if (!isDayKey(fromDay) || !isDayKey(toDay)) {
      return NextResponse.json({ ok: false, error: "day_required", details: { fromDay, toDay } }, { status: 400 });
    }

    const scenario: Scenario = (body.scenario ?? "NORMAL") as Scenario;
    const employeeScope: EmployeeScope = (body.employeeScope ?? "ACTIVE") as EmployeeScope;
    const employeeCodes = Array.isArray(body.employeeCodes)
      ? body.employeeCodes.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const jitterMinutes = clampInt(body.jitterMinutes, 0, 0, 120);
    const weekdaySet = normalizeWeekdays(body.daysOfWeek);

    const recompute = body.recompute !== false;
    const commit = body.commit !== false;
    const maxEvents = clampInt(body.maxEvents, 250_000, 1_000, 2_000_000);

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";

    // Select employees
    let employees: Array<{ id: string; employeeCode: string }> = [];
    if (employeeScope === "EMPLOYEE_CODES") {
      if (!employeeCodes.length) {
        return NextResponse.json({ ok: false, error: "employee_codes_required" }, { status: 400 });
      }
      employees = await prisma.employee.findMany({
        where: { companyId, employeeCode: { in: employeeCodes } },
        select: { id: true, employeeCode: true },
      });
    } else if (employeeScope === "ALL") {
      employees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, employeeCode: true } });
    } else {
      employees = await prisma.employee.findMany({
        where: { companyId, isActive: true },
        select: { id: true, employeeCode: true },
      });
    }

    if (!employees.length) {
      return NextResponse.json({ ok: false, error: "no_employees" }, { status: 400 });
    }

    const from = DateTime.fromISO(fromDay, { zone: tz }).startOf("day");
    const to = DateTime.fromISO(toDay, { zone: tz }).startOf("day");
    if (!from.isValid || !to.isValid) {
      return NextResponse.json({ ok: false, error: "invalid_day" }, { status: 400 });
    }

    const directionBaseIn = 9 * 60;
    const directionBaseOut = 18 * 60;

    const batchId = `ts_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const note = scenario;

    const data: Prisma.RawEventCreateManyInput[] = [];

    let dayCursor = from;
    let dayIndex = 0;

    while (dayCursor <= to) {
      if (weekdaySet && !weekdaySet.has(dayCursor.weekday)) {
        dayCursor = dayCursor.plus({ days: 1 });
        dayIndex++;
        continue;
      }

      for (const emp of employees) {
        const parts = buildScenario({ scenario, baseInMin: directionBaseIn, baseOutMin: directionBaseOut, dayIndex });

        for (let i = 0; i < parts.length; i++) {
          const p = parts[i] as { dir: EventDirection; minute: number; nextDay?: boolean };
          const jitter = randJitter(jitterMinutes);
          const localBase = (p.nextDay ? dayCursor.plus({ days: 1 }) : dayCursor).plus({ minutes: p.minute + jitter });
          const occurredAt = localBase.toUTC().toJSDate();

          // externalRef must be unique per company
          const externalRef = `${batchId}:${emp.employeeCode}:${dayCursor.toISODate()}:${p.dir}:${i}`;

          data.push({
            companyId,
            employeeId: emp.id,
            occurredAt,
            direction: p.dir,
            source: EventSource.TEST_SEED,
            externalRef,
            batchId,
            note,
          });

          if (data.length >= maxEvents) {
            return NextResponse.json(
              {
                ok: false,
                error: "max_events_exceeded",
                details: { maxEvents, current: data.length },
              },
              { status: 400 },
            );
          }
        }
      }

      dayCursor = dayCursor.plus({ days: 1 });
      dayIndex++;
    }

    const minDayKey = from.toISODate();
    const maxDayKey = to.toISODate();

    if (!commit) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        batchId,
        scenario,
        employeeCount: employees.length,
        plannedEvents: data.length,
        minDayKey,
        maxDayKey,
      });
    }

    const inserted = await prisma.rawEvent.createMany({ data, skipDuplicates: true });

    let recomputeSummary: any = null;
    if (recompute) {
      const days = Math.max(0, to.diff(from, "days").days);
      const results: Array<{
        day: string;
        ok: boolean;
        present?: number;
        absent?: number;
        missingPunch?: number;
        error?: string;
      }> = [];
      for (let d = 0; d <= days; d++) {
        const day = from.plus({ days: d }).toISODate();
        try {
          const r: any = await recomputeAttendanceForDate(day);
          results.push({ day, ok: true, present: r.presentCount, absent: r.absentCount, missingPunch: r.missingPunchCount });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown_error";
          results.push({ day, ok: false, error: msg });
        }
      }
      recomputeSummary = {
        days: results.length,
        failedDays: results.filter((x) => !x.ok).length,
      };
    }

    return NextResponse.json({
      ok: true,
      batchId,
      scenario,
      employeeCount: employees.length,
      requestedEvents: data.length,
      insertedCount: inserted.count,
      minDayKey,
      maxDayKey,
      recompute: recompute ? recomputeSummary : null,
    });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;

    console.error("test seed-events error:", err);
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "server_error", message: process.env.NODE_ENV !== "production" ? message : undefined },
      { status: 500 },
    );
  }
}
