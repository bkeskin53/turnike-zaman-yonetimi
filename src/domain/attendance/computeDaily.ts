import { DateTime } from "luxon";
import { EventDirection } from "@prisma/client";
import { normalizePunches, NormalizationResult } from "@/src/domain/attendance/normalizePunches";

export type OffDayEntryBehavior = "IGNORE" | "FLAG" | "COUNT_AS_OT";

export type ComputePolicy = {
  timezone?: string;

  shiftStartMinute?: number; // minutes since 00:00
  shiftEndMinute?: number;   // minutes since 00:00

  breakAutoDeductEnabled?: boolean;
  breakMinutes?: number;

  lateGraceMinutes?: number;
  earlyLeaveGraceMinutes?: number;

  offDayEntryBehavior?: OffDayEntryBehavior;
  overtimeEnabled?: boolean;
};

export type ComputeEvent = {
  occurredAt: Date;
  direction: EventDirection;
};

export type DailyComputed = {
  firstIn: Date | null;
  lastOut: Date | null;

  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;

  status: "PRESENT" | "ABSENT" | "OFF";
  anomalies: string[];
};

function toMinuteInt(n: number) {
  return Math.max(0, Math.floor(n));
}

function diffMinutes(a: Date, b: Date) {
  // b - a
  return toMinuteInt((b.getTime() - a.getTime()) / 60000);
}

export function computeDailyAttendance(input: {
  date: string; // YYYY-MM-DD
  timezone: string;
  policy: ComputePolicy;
  events?: ComputeEvent[];
  normalized?: NormalizationResult;
}): DailyComputed {
  const tz = input.timezone || "Europe/Istanbul";

  const policy = input.policy ?? {};
  const shiftStartMinute = policy.shiftStartMinute ?? 8 * 60; // default 08:00
  const shiftEndMinute = policy.shiftEndMinute ?? 17 * 60;    // default 17:00

  const breakAutoDeductEnabled = !!policy.breakAutoDeductEnabled;
  const breakMinutes = policy.breakMinutes ?? 0;

  const lateGraceMinutes = policy.lateGraceMinutes ?? 0;
  const earlyLeaveGraceMinutes = policy.earlyLeaveGraceMinutes ?? 0;

  const offDayEntryBehavior: OffDayEntryBehavior = policy.offDayEntryBehavior ?? "IGNORE";
  const overtimeEnabled = !!policy.overtimeEnabled;

  const norm =
    input.normalized ??
    normalizePunches((input.events ?? []).map((e) => ({ occurredAt: e.occurredAt, direction: e.direction })));

  // Build base date in timezone
  const dayStart = DateTime.fromISO(input.date, { zone: tz }).startOf("day");
  const shiftStart = dayStart.plus({ minutes: shiftStartMinute });
  const shiftEnd = dayStart.plus({ minutes: shiftEndMinute });

  const weekday = dayStart.weekday; // 1..7
  const isOffDay = weekday === 6 || weekday === 7;

  // worked = sum of valid IN->OUT segments
  let workedMinutes = 0;
  for (const seg of norm.segments) {
    workedMinutes += diffMinutes(seg.inAt, seg.outAt);
  }

  if (breakAutoDeductEnabled && workedMinutes > 0) {
    workedMinutes = Math.max(0, workedMinutes - breakMinutes);
  }

  // Convert first/last to local for comparisons
  const firstIn = norm.firstIn;
  const lastOut = norm.lastOut;

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  // Off day behavior
  if (isOffDay) {
    const hasAnyPunch = (input.events?.length ?? 0) > 0 || norm.acceptedEvents.length > 0;

    const anomalies = new Set(norm.anomalies);

    if (!hasAnyPunch) {
      return {
        firstIn: null,
        lastOut: null,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status: "OFF",
        anomalies: [],
      };
    }

    if (offDayEntryBehavior === "IGNORE") {
      anomalies.add("OFF_DAY_IGNORED");
      return {
        firstIn,
        lastOut,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status: "OFF",
        anomalies: Array.from(anomalies),
      };
    }

    anomalies.add("OFF_DAY_WORK");

    if (offDayEntryBehavior === "COUNT_AS_OT") {
      return {
        firstIn,
        lastOut,
        workedMinutes,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: workedMinutes,
        status: "OFF",
        anomalies: Array.from(anomalies),
      };
    }

    // FLAG: keep worked, but no OT (v1 basit)
    return {
      firstIn,
      lastOut,
      workedMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      status: "OFF",
      anomalies: Array.from(anomalies),
    };
  }

  // Regular day
  const status: "PRESENT" | "ABSENT" = firstIn ? "PRESENT" : "ABSENT";

  if (firstIn) {
    const firstLocal = DateTime.fromJSDate(firstIn, { zone: "utc" }).setZone(tz);
    const lateRaw = toMinuteInt(firstLocal.diff(shiftStart, "minutes").minutes) - lateGraceMinutes;
    lateMinutes = Math.max(0, lateRaw);
  }

  if (lastOut) {
    const lastLocal = DateTime.fromJSDate(lastOut, { zone: "utc" }).setZone(tz);

    // Early leave: shiftEnd - lastOut if lastOut before shiftEnd
    const earlyRaw = toMinuteInt(shiftEnd.diff(lastLocal, "minutes").minutes) - earlyLeaveGraceMinutes;
    earlyLeaveMinutes = Math.max(0, earlyRaw);

    // OT: lastOut - shiftEnd if after shiftEnd
    if (overtimeEnabled) {
      const otRaw = toMinuteInt(lastLocal.diff(shiftEnd, "minutes").minutes);
      overtimeMinutes = Math.max(0, otRaw);
    }
  }

  return {
    firstIn,
    lastOut,
    workedMinutes: status === "PRESENT" ? workedMinutes : 0,
    lateMinutes: status === "PRESENT" ? lateMinutes : 0,
    earlyLeaveMinutes: status === "PRESENT" ? earlyLeaveMinutes : 0,
    overtimeMinutes: status === "PRESENT" ? overtimeMinutes : 0,
    status,
    anomalies: norm.anomalies,
  };
}
