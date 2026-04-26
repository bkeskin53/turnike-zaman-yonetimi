import { DateTime } from "luxon";
import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import { listDailyAttendanceRange } from "@/src/repositories/attendance.repo";
import { prisma } from "@/src/repositories/prisma";
import type { BuildDailyPuantajRowsParams, PuantajDailyRow } from "@/src/services/puantaj/types";
import { resolvePuantajCodes, resolvePuantajGate } from "@/src/services/puantaj/rules";

function parseMonthOrThrow(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("BAD_MONTH");
  }
}

function toIsoOrNull(value: Date | null | undefined, tz: string): string | null {
  if (!value) return null;
  return DateTime.fromJSDate(value, { zone: "utc" }).setZone(tz).toISO();
}

function toDayKey(value: Date, tz: string): string {
  return DateTime.fromJSDate(value, { zone: "utc" }).setZone(tz).toISODate()!;
}

function buildFullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

type LeaveDayMap = Map<string, import("@prisma/client").LeaveType>;

function buildLeaveDayMap(args: {
  tz: string;
  monthStartLocal: DateTime;
  monthEndLocalExclusive: DateTime;
  leaves: Array<{
    employeeId: string;
    dateFrom: Date;
    dateTo: Date;
    type: import("@prisma/client").LeaveType;
  }>;
}): LeaveDayMap {
  const map: LeaveDayMap = new Map();

  for (const leave of args.leaves) {
    let cursor = DateTime.fromJSDate(leave.dateFrom, { zone: "utc" }).setZone(args.tz).startOf("day");
    const leaveEnd = DateTime.fromJSDate(leave.dateTo, { zone: "utc" }).setZone(args.tz).startOf("day");

    while (cursor <= leaveEnd) {
      if (cursor >= args.monthStartLocal && cursor < args.monthEndLocalExclusive) {
        const key = `${leave.employeeId}__${cursor.toISODate()!}`;
        if (!map.has(key)) {
          map.set(key, leave.type);
        }
      }
      cursor = cursor.plus({ days: 1 });
    }
  }

  return map;
}

export async function buildDailyPuantajRows(
  params: BuildDailyPuantajRowsParams
): Promise<PuantajDailyRow[]> {
  parseMonthOrThrow(params.month);

  const monthStartLocal = DateTime.fromISO(`${params.month}-01`, { zone: params.tz }).startOf("month");
  const monthEndLocalExclusive = monthStartLocal.plus({ months: 1 });

  const fromUTC = monthStartLocal.toUTC().toJSDate();
  const toUTC = monthEndLocalExclusive.toUTC().toJSDate();

  const rows = await listDailyAttendanceRange(
    params.companyId,
    fromUTC,
    toUTC,
    params.employeeWhere ?? null
  );

  if (rows.length === 0) {
    return [];
  }

  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId)));

  const [adjustments, leaves] = await Promise.all([
    prisma.dailyAdjustment.findMany({
      where: {
        companyId: params.companyId,
        employeeId: { in: employeeIds },
        date: { gte: fromUTC, lt: toUTC },
      },
      select: {
        employeeId: true,
        date: true,
        statusOverride: true,
        workedMinutesOverride: true,
        overtimeMinutesOverride: true,
        overtimeEarlyMinutesOverride: true,
        overtimeLateMinutesOverride: true,
        lateMinutesOverride: true,
        earlyLeaveMinutesOverride: true,
        note: true,
      },
    }),
    prisma.employeeLeave.findMany({
      where: {
        companyId: params.companyId,
        employeeId: { in: employeeIds },
        dateFrom: { lt: toUTC },
        dateTo: { gte: fromUTC },
      },
      select: {
        employeeId: true,
        dateFrom: true,
        dateTo: true,
        type: true,
      },
    }),
  ]);

  const adjustmentByEmpDay = new Map<string, (typeof adjustments)[number]>();
  for (const adj of adjustments) {
    const key = `${adj.employeeId}__${toDayKey(adj.date, params.tz)}`;
    adjustmentByEmpDay.set(key, adj);
  }

  const leaveByEmpDay = buildLeaveDayMap({
    tz: params.tz,
    monthStartLocal,
    monthEndLocalExclusive,
    leaves,
  });

  const out: PuantajDailyRow[] = [];

  for (const row of rows) {
    const dayKey = toDayKey(row.workDate, params.tz);
    const adjustmentKey = `${row.employeeId}__${dayKey}`;
    const adjustment = adjustmentByEmpDay.get(adjustmentKey) ?? null;

    const adjusted = applyDailyAdjustment(
      {
        firstIn: row.firstIn,
        lastOut: row.lastOut,
        workedMinutes: row.workedMinutes,
        overtimeMinutes: row.overtimeMinutes,
        overtimeEarlyMinutes: row.overtimeEarlyMinutes ?? 0,
        overtimeLateMinutes: row.overtimeLateMinutes ?? 0,
        lateMinutes: row.lateMinutes,
        earlyLeaveMinutes: row.earlyLeaveMinutes,
        status: row.status,
        anomalies: row.anomalies,
      },
      adjustment
    );

    const leaveType = leaveByEmpDay.get(`${row.employeeId}__${dayKey}`) ?? null;
    const gate = resolvePuantajGate({
      requiresReview: row.requiresReview,
      reviewStatus: row.reviewStatus,
    });
    const puantajCodes = resolvePuantajCodes({
      status: adjusted.status,
      leaveType,
      workedMinutes: adjusted.workedMinutes,
      overtimeMinutes: adjusted.overtimeMinutes,
    });

    out.push({
      employeeId: row.employeeId,
      employeeCode: row.employee?.employeeCode ?? "",
      fullName: buildFullName(row.employee?.firstName, row.employee?.lastName),

      dayKey,

      status: adjusted.status,
      leaveType,

      firstIn: toIsoOrNull(adjusted.firstIn, params.tz),
      lastOut: toIsoOrNull(adjusted.lastOut, params.tz),

      workedMinutes: adjusted.workedMinutes,
      overtimeMinutes: adjusted.overtimeMinutes,
      overtimeEarlyMinutes: adjusted.overtimeEarlyMinutes ?? 0,
      overtimeLateMinutes: adjusted.overtimeLateMinutes ?? 0,
      lateMinutes: adjusted.lateMinutes,
      earlyLeaveMinutes: adjusted.earlyLeaveMinutes,

      anomalies: Array.isArray(adjusted.anomalies) ? adjusted.anomalies : [],

      requiresReview: row.requiresReview,
      reviewStatus: row.reviewStatus,
      reviewReasons: Array.isArray(row.reviewReasons) ? row.reviewReasons : [],
      reviewedAt: row.reviewedAt ? toIsoOrNull(row.reviewedAt, params.tz) : null,
      reviewNote: row.reviewNote ?? null,

      manualAdjustmentApplied: !!adjustment,
      adjustmentNote: adjustment?.note ?? null,

      puantajState: gate.puantajState,
      puantajBlockReasons: gate.puantajBlockReasons,
      puantajCodes,
    });
  }

  out.sort((a, b) => {
    const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "tr");
    if (codeCompare !== 0) return codeCompare;
    return a.dayKey.localeCompare(b.dayKey);
  });

  return out;
}