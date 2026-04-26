import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dayKeyToday, dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";

type WarningLevel = "W0" | "W1" | "W2" | "W3";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function addOneDay(dayKey: string): string {
  return DateTime.fromISO(dayKey, { zone: "utc" }).plus({ days: 1 }).toISODate()!;
}

function minDayKey(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function maxDayKey(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function diffWindowStart(oldStart: string | null, newStart: string | null): string | null {
  if (oldStart === newStart) return null;
  return minDayKey(oldStart, newStart);
}

function diffWindowEndForStartChange(oldStart: string | null, newStart: string | null): string | null {
  if (oldStart === newStart) return null;
  const later = maxDayKey(oldStart, newStart);
  if (!later) return null;
  return addOneDay(later);
}

function diffWindowStartForEndChange(oldEnd: string | null, newEnd: string | null, todayKey: string): string | null {
  const oldEffective = oldEnd ?? todayKey;
  const newEffective = newEnd ?? todayKey;
  if (oldEffective === newEffective) return null;
  const earlier = minDayKey(oldEffective, newEffective);
  if (!earlier) return null;
  return addOneDay(earlier);
}

function diffWindowEnd(oldEnd: string | null, newEnd: string | null, todayKey: string): string | null {
  const oldEffective = oldEnd ?? todayKey;
  const newEffective = newEnd ?? todayKey;
  if (oldEffective === newEffective) return null;
  return maxDayKey(oldEffective, newEffective);
}

function daysInclusive(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = DateTime.fromISO(start, { zone: "utc" });
  const e = DateTime.fromISO(end, { zone: "utc" });
  if (!s.isValid || !e.isValid || e < s) return 0;
  return Math.floor(e.diff(s, "days").days) + 1;
}

function buildImpactRange(args: {
  oldStart: string | null;
  oldEnd: string | null;
  newStart: string | null;
  newEnd: string | null;
  todayKey: string;
}) {
  const startChangeStart = diffWindowStart(args.oldStart, args.newStart);
  const startChangeEnd = diffWindowEndForStartChange(args.oldStart, args.newStart);

  const endChangeStart = diffWindowStartForEndChange(args.oldEnd, args.newEnd, args.todayKey);
  const endChangeEnd = diffWindowEnd(args.oldEnd, args.newEnd, args.todayKey);

  const impactStart = minDayKey(startChangeStart, endChangeStart);
  const impactEnd = maxDayKey(startChangeEnd, endChangeEnd);

  return {
    impactStart,
    impactEnd,
    impactDays: daysInclusive(impactStart, impactEnd),
    changedStartDate: args.oldStart !== args.newStart,
    changedEndDate: (args.oldEnd ?? args.todayKey) !== (args.newEnd ?? args.todayKey),
  };
}

function deriveWarningLevel(args: {
  impactDays: number;
  rawEventCount: number;
  dailyCount: number;
  touchedClosedPeriods: number;
}): WarningLevel {
  if (
    args.touchedClosedPeriods > 0 ||
    args.rawEventCount >= 50 ||
    args.dailyCount >= 15 ||
    args.impactDays >= 31
  ) {
    return "W3";
  }
  if (args.rawEventCount > 0 || args.dailyCount > 0) {
    return "W2";
  }
  if (args.impactDays > 0) {
    return "W1";
  }
  return "W0";
}

function warningTitle(level: WarningLevel): string {
  switch (level) {
    case "W3":
      return "Bu değişiklik kritik geçmiş verileri etkileyebilir";
    case "W2":
      return "Bu değişiklik geçmiş zaman verilerini etkileyebilir";
    case "W1":
      return "Bu değişiklik kapsam görünümünü güncelleyecek";
    default:
      return "Bu değişiklik için zaman verisi etkisi bulunmadı";
  }
}

function warningMessages(args: {
  level: WarningLevel;
  impactStart: string | null;
  impactEnd: string | null;
  rawEventCount: number;
  dailyCount: number;
  touchedClosedPeriods: Array<{ month: string; status: string }>;
}) {
  const lines: string[] = [];

  if (args.impactStart && args.impactEnd) {
    lines.push(`Etkilenen aralık: ${args.impactStart} → ${args.impactEnd}`);
  }

  if (args.rawEventCount > 0) {
    lines.push(`Bu aralıkta ${args.rawEventCount} ham zaman verisi bulundu.`);
  }

  if (args.dailyCount > 0) {
    lines.push(`Bu aralıkta ${args.dailyCount} DailyAttendance günü etkilenebilir.`);
  }

  if (args.touchedClosedPeriods.length > 0) {
    const label = args.touchedClosedPeriods.map((p) => `${p.month} (${p.status})`).join(", ");
    lines.push(`Kapanış etkisi olan dönemler: ${label}`);
  }

  if (args.level === "W2" || args.level === "W3") {
    lines.push("Gerekirse manuel olay girişi ve recompute işlemi yapılmalıdır.");
  }

  if (args.level === "W0" && lines.length === 0) {
    lines.push("Seçilen değişiklik için etki oluşturan zaman verisi bulunmadı.");
  }

  return lines;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ROLE_SETS.OPS_WRITE);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  try {
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
    }

    const proposedStartDateRaw = body.startDate == null ? null : String(body.startDate).trim();
    const proposedEndDateRaw = body.endDate == null ? null : String(body.endDate).trim();

    if (proposedStartDateRaw && !isISODate(proposedStartDateRaw)) {
      return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });
    }
    if (proposedEndDateRaw && !isISODate(proposedEndDateRaw)) {
      return NextResponse.json({ error: "INVALID_END_DATE" }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        hiredAt: true,
        terminatedAt: true,
        employmentPeriods: {
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          take: 12,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const targetScope =
      employee.employmentPeriods.find((p) => !p.endDate) ??
      employee.employmentPeriods[0] ??
      null;

    if (!targetScope) {
      return NextResponse.json({ error: "NO_SCOPE_FOUND" }, { status: 400 });
    }

    const oldStart = toDayKey(targetScope.startDate);
    const oldEnd = toDayKey(targetScope.endDate);

    const newStart = proposedStartDateRaw ?? oldStart;
    const newEnd = proposedEndDateRaw ?? oldEnd;

    if (!newStart) {
      return NextResponse.json({ error: "START_DATE_REQUIRED" }, { status: 400 });
    }
    if (newEnd && newEnd < newStart) {
      return NextResponse.json({ error: "END_BEFORE_START" }, { status: 400 });
    }

    const {
      impactStart,
      impactEnd,
      impactDays,
      changedStartDate,
      changedEndDate,
    } = buildImpactRange({
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      todayKey,
    });

    let rawEventCount = 0;
    let firstRawEventAt: string | null = null;
    let lastRawEventAt: string | null = null;
    let dailyCount = 0;
    let touchedPeriods: Array<{ month: string; status: string }> = [];

    if (impactStart && impactEnd && impactDays > 0) {
      const impactStartUtc = DateTime.fromISO(impactStart, { zone: tz }).startOf("day").toUTC().toJSDate();
      const impactEndUtcExclusive = DateTime.fromISO(addOneDay(impactEnd), { zone: tz }).startOf("day").toUTC().toJSDate();

      const impactStartDb = dbDateFromDayKey(impactStart);
      const impactEndDb = dbDateFromDayKey(impactEnd);

      const [rawAgg, firstRaw, lastRaw, dailyAgg] = await Promise.all([
        prisma.rawEvent.aggregate({
          where: {
            companyId,
            employeeId: id,
            occurredAt: {
              gte: impactStartUtc,
              lt: impactEndUtcExclusive,
            },
          },
          _count: { _all: true },
        }),
        prisma.rawEvent.findFirst({
          where: {
            companyId,
            employeeId: id,
            occurredAt: {
              gte: impactStartUtc,
              lt: impactEndUtcExclusive,
            },
          },
          orderBy: { occurredAt: "asc" },
          select: { occurredAt: true },
        }),
        prisma.rawEvent.findFirst({
          where: {
            companyId,
            employeeId: id,
            occurredAt: {
              gte: impactStartUtc,
              lt: impactEndUtcExclusive,
            },
          },
          orderBy: { occurredAt: "desc" },
          select: { occurredAt: true },
        }),
        prisma.dailyAttendance.aggregate({
          where: {
            companyId,
            employeeId: id,
            workDate: {
              gte: impactStartDb,
              lte: impactEndDb,
            },
          },
          _count: { _all: true },
        }),
      ]);

      rawEventCount = rawAgg._count._all ?? 0;
      firstRawEventAt = firstRaw?.occurredAt?.toISOString() ?? null;
      lastRawEventAt = lastRaw?.occurredAt?.toISOString() ?? null;
      dailyCount = dailyAgg._count._all ?? 0;

      const startMonth = impactStart.slice(0, 7);
      const endMonth = impactEnd.slice(0, 7);
      const months: string[] = [];
      let cursor = DateTime.fromISO(`${startMonth}-01`, { zone: "utc" });
      const endCursor = DateTime.fromISO(`${endMonth}-01`, { zone: "utc" });
      while (cursor <= endCursor) {
        months.push(cursor.toISODate()!.slice(0, 7));
        cursor = cursor.plus({ months: 1 });
      }

      const periods = await prisma.payrollPeriod.findMany({
        where: {
          companyId,
          month: { in: months },
          status: { in: ["PRE_CLOSED", "CLOSED"] },
        },
        select: { month: true, status: true },
        orderBy: { month: "asc" },
      });

      touchedPeriods = periods.map((p) => ({ month: p.month, status: p.status }));
    }

    const level = deriveWarningLevel({
      impactDays,
      rawEventCount,
      dailyCount,
      touchedClosedPeriods: touchedPeriods.length,
    });

    return NextResponse.json({
      ok: true,
      item: {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        },
        targetScope: {
          periodId: targetScope.id,
          oldStartDate: oldStart,
          oldEndDate: oldEnd,
          newStartDate: newStart,
          newEndDate: newEnd,
          changedStartDate,
          changedEndDate,
        },
        impact: {
          startDate: impactStart,
          endDate: impactEnd,
          dayCount: impactDays,
          rawEventCount,
          firstRawEventAt,
          lastRawEventAt,
          dailyAttendanceCount: dailyCount,
          touchedClosedPeriods: touchedPeriods,
        },
        warning: {
          level,
          title: warningTitle(level),
          messages: warningMessages({
            level,
            impactStart,
            impactEnd,
            rawEventCount,
            dailyCount,
            touchedClosedPeriods: touchedPeriods,
          }),
          requiresConfirmation: level !== "W0",
        },
        recomputeSuggestion: {
          suggested: rawEventCount > 0 || dailyCount > 0,
          rangeStart: impactStart,
          rangeEnd: impactEnd,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/card-scope/preview][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}