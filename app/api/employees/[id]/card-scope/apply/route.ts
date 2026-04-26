import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { RecomputeReason } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";

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

function isDayWithinInclusiveRange(
  dayKey: string,
  startDayKey: string | null,
  endDayKey: string | null,
) {
  if (!startDayKey) return false;
  if (dayKey < startDayKey) return false;
  if (endDayKey && dayKey > endDayKey) return false;
  return true;
}

async function purgeInvalidDailyAttendanceRows(args: {
  tx: any;
  companyId: string;
  employeeId: string;
  rangeStartDayKey: string | null;
  rangeEndDayKey: string | null;
}) {
  if (!args.rangeStartDayKey || !args.rangeEndDayKey) {
    return {
      scannedCount: 0,
      deletedCount: 0,
      deletedDayKeys: [] as string[],
    };
  }

  const rangeStartDb = dbDateFromDayKey(args.rangeStartDayKey);
  const rangeEndDb = dbDateFromDayKey(args.rangeEndDayKey);

  const [rows, periods] = await Promise.all([
    args.tx.dailyAttendance.findMany({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        workDate: {
          gte: rangeStartDb,
          lte: rangeEndDb,
        },
      },
      select: {
        id: true,
        workDate: true,
      },
      orderBy: { workDate: "asc" },
    }),
    args.tx.employeeEmploymentPeriod.findMany({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        startDate: { lte: rangeEndDb },
        OR: [{ endDate: null }, { endDate: { gte: rangeStartDb } }],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
      orderBy: [{ startDate: "asc" }],
    }),
  ]);

  const invalidRows = rows.filter((row: { id: string; workDate: Date }) => {
    const dayKey = toDayKey(row.workDate);
    if (!dayKey) return false;
    return !periods.some((p: { startDate: Date; endDate: Date | null }) =>
      isDayWithinInclusiveRange(dayKey, toDayKey(p.startDate), toDayKey(p.endDate)),
    );
  });

  if (invalidRows.length === 0) {
    return {
      scannedCount: rows.length,
      deletedCount: 0,
      deletedDayKeys: [] as string[],
    };
  }

  await args.tx.dailyAttendance.deleteMany({
    where: {
      id: { in: invalidRows.map((r: { id: string }) => r.id) },
    },
  });

  return {
    scannedCount: rows.length,
    deletedCount: invalidRows.length,
    deletedDayKeys: invalidRows.map((r: { workDate: Date }) => toDayKey(r.workDate)).filter(Boolean),
  };
}

async function buildPreview(args: {
  companyId: string;
  employeeId: string;
  tz: string;
  todayKey: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const employee = await prisma.employee.findFirst({
    where: { id: args.employeeId, companyId: args.companyId },
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
    return { ok: false as const, status: 404, body: { error: "NOT_FOUND" } };
  }

  const targetScope =
    employee.employmentPeriods.find((p) => !p.endDate) ??
    employee.employmentPeriods[0] ??
    null;

  if (!targetScope) {
    return { ok: false as const, status: 400, body: { error: "NO_SCOPE_FOUND" } };
  }

  const oldStart = toDayKey(targetScope.startDate);
  const oldEnd = toDayKey(targetScope.endDate);

  const newStart = args.startDate ?? oldStart;
  const newEnd = args.endDate ?? oldEnd;

  if (!newStart) {
    return { ok: false as const, status: 400, body: { error: "START_DATE_REQUIRED" } };
  }
  if (newEnd && newEnd < newStart) {
    return { ok: false as const, status: 400, body: { error: "END_BEFORE_START" } };
  }

  const range = buildImpactRange({
    oldStart,
    oldEnd,
    newStart,
    newEnd,
    todayKey: args.todayKey,
  });

  let rawEventCount = 0;
  let firstRawEventAt: string | null = null;
  let lastRawEventAt: string | null = null;
  let dailyCount = 0;
  let touchedPeriods: Array<{ month: string; status: string }> = [];

  if (range.impactStart && range.impactEnd && range.impactDays > 0) {
    const impactStartUtc = DateTime.fromISO(range.impactStart, { zone: args.tz }).startOf("day").toUTC().toJSDate();
    const impactEndUtcExclusive = DateTime.fromISO(addOneDay(range.impactEnd), { zone: args.tz }).startOf("day").toUTC().toJSDate();

    const impactStartDb = dbDateFromDayKey(range.impactStart);
    const impactEndDb = dbDateFromDayKey(range.impactEnd);

    const [rawAgg, firstRaw, lastRaw, dailyAgg] = await Promise.all([
      prisma.rawEvent.aggregate({
        where: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          occurredAt: {
            gte: impactStartUtc,
            lt: impactEndUtcExclusive,
          },
        },
        _count: { _all: true },
      }),
      prisma.rawEvent.findFirst({
        where: {
          companyId: args.companyId,
          employeeId: args.employeeId,
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
          companyId: args.companyId,
          employeeId: args.employeeId,
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
          companyId: args.companyId,
          employeeId: args.employeeId,
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

    const startMonth = range.impactStart.slice(0, 7);
    const endMonth = range.impactEnd.slice(0, 7);
    const months: string[] = [];
    let cursor = DateTime.fromISO(`${startMonth}-01`, { zone: "utc" });
    const endCursor = DateTime.fromISO(`${endMonth}-01`, { zone: "utc" });
    while (cursor <= endCursor) {
      months.push(cursor.toISODate()!.slice(0, 7));
      cursor = cursor.plus({ months: 1 });
    }

    const periods = await prisma.payrollPeriod.findMany({
      where: {
        companyId: args.companyId,
        month: { in: months },
        status: { in: ["PRE_CLOSED", "CLOSED"] },
      },
      select: { month: true, status: true },
      orderBy: { month: "asc" },
    });

    touchedPeriods = periods.map((p) => ({ month: p.month, status: p.status }));
  }

  const level = deriveWarningLevel({
    impactDays: range.impactDays,
    rawEventCount,
    dailyCount,
    touchedClosedPeriods: touchedPeriods.length,
  });

  return {
    ok: true as const,
    status: 200,
    body: {
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
        changedStartDate: range.changedStartDate,
        changedEndDate: range.changedEndDate,
      },
      impact: {
        startDate: range.impactStart,
        endDate: range.impactEnd,
        dayCount: range.impactDays,
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
          impactStart: range.impactStart,
          impactEnd: range.impactEnd,
          rawEventCount,
          dailyCount,
          touchedClosedPeriods: touchedPeriods,
        }),
        requiresConfirmation: level !== "W0",
      },
      recomputeSuggestion: {
        suggested: rawEventCount > 0 || dailyCount > 0,
        rangeStart: range.impactStart,
        rangeEnd: range.impactEnd,
      },
    },
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session: { userId: string; role: string } | null = null;
  try {
    session = await requireRole(ROLE_SETS.OPS_WRITE);
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
    const note = body.note == null ? null : String(body.note).trim();
    const forceConfirm = body.forceConfirm === true;

    if (proposedStartDateRaw && !isISODate(proposedStartDateRaw)) {
      return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });
    }
    if (proposedEndDateRaw && !isISODate(proposedEndDateRaw)) {
      return NextResponse.json({ error: "INVALID_END_DATE" }, { status: 400 });
    }

    const preview = await buildPreview({
      companyId,
      employeeId: id,
      tz,
      todayKey,
      startDate: proposedStartDateRaw,
      endDate: proposedEndDateRaw,
    });

    if (!preview.ok) {
      return NextResponse.json(preview.body, { status: preview.status });
    }

    if (
      preview.body.warning.requiresConfirmation &&
      !forceConfirm
    ) {
      return NextResponse.json(
        {
          error: "CONFIRM_REQUIRED",
          preview: preview.body,
        },
        { status: 409 },
      );
    }

    const targetScope = preview.body.targetScope;
    const newStartDb = dbDateFromDayKey(targetScope.newStartDate!);
    const newEndDb = targetScope.newEndDate ? dbDateFromDayKey(targetScope.newEndDate) : null;
    const recomputeRangeStart = preview.body.recomputeSuggestion.rangeStart;
    const recomputeRangeEnd = preview.body.recomputeSuggestion.rangeEnd;

    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.employeeEmploymentPeriod.findFirst({
        where: {
          id: targetScope.periodId,
          companyId,
          employeeId: id,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true,
        },
      });

      if (!current) {
        return { ok: false as const, status: 404, body: { error: "SCOPE_NOT_FOUND" } };
      }

      const overlapWhere: any = {
        companyId,
        employeeId: id,
        NOT: { id: current.id },
        OR: [{ endDate: null }, { endDate: { gte: newStartDb } }],
      };

      if (newEndDb) {
        overlapWhere.startDate = { lte: newEndDb };
      }

      const overlap = await tx.employeeEmploymentPeriod.findFirst({
        where: overlapWhere,
        select: { id: true },
      });

      if (overlap) {
        return { ok: false as const, status: 400, body: { error: "EMPLOYMENT_OVERLAP" } };
      }

      const updatedPeriod = await tx.employeeEmploymentPeriod.update({
        where: { id: current.id },
        data: {
          startDate: newStartDb,
          endDate: newEndDb,
          reason: note || current.reason || null,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const derivedIsActive =
        targetScope.newStartDate <= todayKey &&
        (!targetScope.newEndDate || targetScope.newEndDate >= todayKey);

      const updatedEmployee = await tx.employee.update({
        where: { id, companyId },
        data: {
          hiredAt: newStartDb,
          terminatedAt: newEndDb,
          isActive: derivedIsActive,
        },
        select: {
          id: true,
          isActive: true,
          hiredAt: true,
          terminatedAt: true,
        },
      });

      const cleanup = await purgeInvalidDailyAttendanceRows({
        tx,
        companyId,
        employeeId: id,
        rangeStartDayKey: recomputeRangeStart,
        rangeEndDayKey: recomputeRangeEnd,
      });

      await tx.employeeAction.create({
        data: {
          companyId,
          employeeId: id,
          type: "UPDATE",
          effectiveDate: newStartDb,
          note: note || null,
          actorUserId: session?.userId ?? null,
          details: {
            action: "CARD_SCOPE_EDIT",
            forceConfirm,
            actorRole: session?.role ?? null,
            scopeId: current.id,
            before: {
              startDate: toDayKey(current.startDate),
              endDate: toDayKey(current.endDate),
              reason: current.reason ?? null,
            },
            after: {
              startDate: targetScope.newStartDate,
              endDate: targetScope.newEndDate,
              reason: note || current.reason || null,
            },
            warning: preview.body.warning,
            impact: preview.body.impact,
            cleanup: {
              staleDailyAttendanceScanned: cleanup.scannedCount,
              staleDailyAttendanceDeleted: cleanup.deletedCount,
              staleDailyAttendanceDeletedDayKeys: cleanup.deletedDayKeys,
            },
            recomputeSuggestion: preview.body.recomputeSuggestion,
          },
        },
      });

      return {
        ok: true as const,
        status: 200,
        body: {
          ok: true,
          item: {
            scope: {
              periodId: updatedPeriod.id,
              startDate: toDayKey(updatedPeriod.startDate),
              endDate: toDayKey(updatedPeriod.endDate),
              reason: updatedPeriod.reason ?? null,
              updatedAt: updatedPeriod.updatedAt,
            },
            employee: {
              id: updatedEmployee.id,
              isActive: updatedEmployee.isActive,
              hiredAt: toDayKey(updatedEmployee.hiredAt),
              terminatedAt: toDayKey(updatedEmployee.terminatedAt),
            },
            cleanup: {
              staleDailyAttendanceScanned: cleanup.scannedCount,
              staleDailyAttendanceDeleted: cleanup.deletedCount,
              staleDailyAttendanceDeletedDayKeys: cleanup.deletedDayKeys,
            },
          },
          preview: preview.body,
        },
      };
    });

    if (
      saved.status === 200 &&
      recomputeRangeStart &&
      recomputeRangeEnd
    ) {
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORKFORCE_UPDATED,
        createdByUserId: session?.userId ?? null,
        rangeStartDayKey: recomputeRangeStart,
        rangeEndDayKey: recomputeRangeEnd,
      });
    }

    return NextResponse.json(saved.body, { status: saved.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/card-scope/apply][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}