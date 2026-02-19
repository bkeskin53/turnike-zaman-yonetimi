import { DateTime } from "luxon";
import { EventDirection } from "@prisma/client";
import { normalizePunches, NormalizationResult } from "@/src/domain/attendance/normalizePunches";

export type OffDayEntryBehavior = "IGNORE" | "FLAG" | "COUNT_AS_OT";

export type ComputePolicy = {
  timezone?: string;

  // Enterprise OFF flag coming from resolver (Pattern NULL day => OFF)
  isOffDay?: boolean;

  shiftStartMinute?: number; // minutes since 00:00
  shiftEndMinute?: number;   // minutes since 00:00

  breakAutoDeductEnabled?: boolean;
  breakMinutes?: number;

  lateGraceMinutes?: number;
  earlyLeaveGraceMinutes?: number;

  offDayEntryBehavior?: OffDayEntryBehavior;
  overtimeEnabled?: boolean;
  /**
   * Overtime calculation mode (SAP-style).
   * - BOTH: early + late overtime are counted
   * - EARLY_ONLY: only pre-shift overtime
   * - LATE_ONLY: only post-shift overtime
   */
  overtimeMode?: "BOTH" | "EARLY_ONLY" | "LATE_ONLY";
  // Opsiyonel: grace dakikaları worked'e dahil edilsin mi?
  graceAffectsWorked?: boolean;
  /**
   * Grace mode for handling grace minutes.
   * - ROUND_ONLY: grace minutes are only used as tolerance for late/early leave.
   *               They do not contribute to workedMinutes.
   * - PAID_PARTIAL: grace minutes within late/early thresholds are added to workedMinutes.
   * If undefined, the mode will be inferred from graceAffectsWorked for backwards compatibility.
   */
  graceMode?: "ROUND_ONLY" | "PAID_PARTIAL";
  // Opsiyonel: exit süreleri break'ten düşülsün mü?
  exitConsumesBreak?: boolean;
  // Opsiyonel: tek bir çıkış için maksimum dakika
  maxSingleExitMinutes?: number;
  // Opsiyonel: günlük toplam exit dakikası
  maxDailyExitMinutes?: number;
  // Opsiyonel: exit limitleri aşınca ne yapılsın
  exitExceedAction?: "IGNORE" | "WARN" | "FLAG";

  /**
   * Worked minutes calculation mode.
   * - ACTUAL: workedMinutes is based on accepted IN->OUT segments (existing behavior).
   * - CLAMP_TO_SHIFT: segments are clamped to [shiftStart, shiftEnd] so early/late time doesn't inflate worked.
   */
  workedCalculationMode?: "ACTUAL" | "CLAMP_TO_SHIFT";

  /**
   * Overtime dynamic break (enterprise): deduct break minutes from computed overtime.
   * Example: every 180 minutes of overtime -> 30 minutes break.
   *
   * If undefined, the feature is disabled.
   */
  otBreakInterval?: number;
  otBreakDuration?: number;
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
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakCount: number;
  otBreakDeductMinutes: number;

  /**
   * Status of the day:
   * - PRESENT: Employee has valid punches and is working
   * - ABSENT: No punches on a scheduled work day
   * - OFF: Weekend or configured off day
   * - LEAVE: Employee is on an approved leave; computed in attendance.service
   */
  status: "PRESENT" | "ABSENT" | "OFF" | "LEAVE";
  anomalies: string[];
};

function toMinuteInt(n: number) {
  // En yakına yuvarla: ms/saniye kaymalarını personel aleyhine kırpma
  return Math.max(0, Math.round(n));
}

function diffMinutes(a: Date, b: Date) {
  // b - a
  return toMinuteInt((b.getTime() - a.getTime()) / 60000);
}

function computeOutsideShiftMinutesDetailed(
  segments: Array<{ inAt: Date; outAt: Date }>,
  shiftStartUtc: Date,
  shiftEndUtc: Date
): { early: number; late: number } {
  let early = 0;
  let late = 0;
  for (const seg of segments) {
    const segStart = seg.inAt;
    const segEnd = seg.outAt;
    if (segEnd <= segStart) continue;

    // Portion before shift start => EARLY OT
    if (segStart < shiftStartUtc) {
      const beforeEnd = segEnd < shiftStartUtc ? segEnd : shiftStartUtc;
      if (beforeEnd > segStart) early += diffMinutes(segStart, beforeEnd);
    }

    // Portion after shift end => LATE OT
    if (segEnd > shiftEndUtc) {
      const afterStart = segStart > shiftEndUtc ? segStart : shiftEndUtc;
      if (segEnd > afterStart) late += diffMinutes(afterStart, segEnd);
    }
  }
  return { early, late };
}

function computeOutsideShiftMinutes(
  segments: Array<{ inAt: Date; outAt: Date }>,
  shiftStartUtc: Date,
  shiftEndUtc: Date
): number {
  let outside = 0;
  for (const seg of segments) {
    const segStart = seg.inAt;
    const segEnd = seg.outAt;
    if (segEnd <= segStart) continue;

    // Portion before shift start
    if (segStart < shiftStartUtc) {
      const beforeEnd = segEnd < shiftStartUtc ? segEnd : shiftStartUtc;
      if (beforeEnd > segStart) outside += diffMinutes(segStart, beforeEnd);
    }

    // Portion after shift end
    if (segEnd > shiftEndUtc) {
      const afterStart = segStart > shiftEndUtc ? segStart : shiftEndUtc;
      if (segEnd > afterStart) outside += diffMinutes(afterStart, segEnd);
    }
  }
  return outside;
}

export function computeOvertimeDynamicBreak(args: {
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakInterval?: number;
  otBreakDuration?: number;
}): {
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakCount: number;
  otBreakDeductMinutes: number;
} {
  const interval = args.otBreakInterval;
  const duration = args.otBreakDuration;

  const base = () => ({
    overtimeMinutes: args.overtimeMinutes,
    overtimeEarlyMinutes: args.overtimeEarlyMinutes,
    overtimeLateMinutes: args.overtimeLateMinutes,
    otBreakCount: 0,
    otBreakDeductMinutes: 0,
  });

  // Feature disabled unless both are positive ints.
  if (!interval || !duration || interval <= 0 || duration <= 0) return base();
  if (args.overtimeMinutes <= 0) return base();

  const breakCount = Math.floor(args.overtimeMinutes / interval);
  if (breakCount <= 0) return base();

  const totalDeduct = breakCount * duration;
  if (totalDeduct <= 0) return base();

  let remaining = Math.min(totalDeduct, args.overtimeMinutes);
  let late = args.overtimeLateMinutes;
  let early = args.overtimeEarlyMinutes;

  // Keep totals consistent: deduct from LATE first (more common for OT), then EARLY.
  if (late > 0 && remaining > 0) {
    const take = Math.min(late, remaining);
    late -= take;
    remaining -= take;
  }
  if (early > 0 && remaining > 0) {
    const take = Math.min(early, remaining);
    early -= take;
    remaining -= take;
  }

  const total = Math.max(0, early + late);
  return {
    overtimeMinutes: total,
    overtimeEarlyMinutes: early,
    overtimeLateMinutes: late,
    otBreakCount: breakCount,
    otBreakDeductMinutes: Math.min(totalDeduct, args.overtimeMinutes),
  };
}

// Backwards-compatible helper (keeps old call sites valid if any remain)
export function applyOvertimeDynamicBreak(args: {
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakInterval?: number;
  otBreakDuration?: number;
}): { overtimeMinutes: number; overtimeEarlyMinutes: number; overtimeLateMinutes: number } {
  const r = computeOvertimeDynamicBreak(args);
  return {
    overtimeMinutes: r.overtimeMinutes,
    overtimeEarlyMinutes: r.overtimeEarlyMinutes,
    overtimeLateMinutes: r.overtimeLateMinutes,
  };
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
  const overtimeMode: "BOTH" | "EARLY_ONLY" | "LATE_ONLY" = policy.overtimeMode ?? "BOTH";
  const workedCalculationMode: "ACTUAL" | "CLAMP_TO_SHIFT" =
    policy.workedCalculationMode ?? "ACTUAL";
  // Determine grace mode: use explicit graceMode if provided. If undefined, derive from
  // graceAffectsWorked for backwards compatibility. Default is ROUND_ONLY.
  const graceMode: "ROUND_ONLY" | "PAID_PARTIAL" =
    policy.graceMode ?? "ROUND_ONLY";

  const norm =
    input.normalized ??
    normalizePunches((input.events ?? []).map((e) => ({ occurredAt: e.occurredAt, direction: e.direction })));

  // Base date in timezone
  const dayStart = DateTime.fromISO(input.date, { zone: tz }).startOf("day");
  const shiftStart = dayStart.plus({ minutes: shiftStartMinute });

  // ✅ Gece vardiyası desteği:
  // Eğer bitiş dakikası başlangıçtan küçük/eşitse => ertesi gün kabul et
  let shiftEnd = dayStart.plus({ minutes: shiftEndMinute });
  if (shiftEndMinute <= shiftStartMinute) {
    shiftEnd = shiftEnd.plus({ days: 1 });
  }

  // Shift boundaries in UTC for comparing with normalized segment timestamps (which are UTC Dates)
  const shiftStartUtc = shiftStart.toUTC().toJSDate();
  const shiftEndUtc = shiftEnd.toUTC().toJSDate();

  const weekday = dayStart.weekday; // 1..7
  const isWeekendOff = weekday === 6 || weekday === 7;
  const isOffDay = policy.isOffDay === true || isWeekendOff;

  // OFF day: shift window clamp is meaningless; force ACTUAL to avoid weird clamp behavior.
  const effectiveWorkedMode: "ACTUAL" | "CLAMP_TO_SHIFT" = isOffDay ? "ACTUAL" : workedCalculationMode;

  // worked = sum of valid IN->OUT segments
  let workedMinutes = 0;
  for (const seg of norm.segments) {
    if (effectiveWorkedMode === "CLAMP_TO_SHIFT") {
      const inAt = seg.inAt < shiftStartUtc ? shiftStartUtc : seg.inAt;
      const outAt = seg.outAt > shiftEndUtc ? shiftEndUtc : seg.outAt;
      if (outAt > inAt) {
        workedMinutes += diffMinutes(inAt, outAt);
      }
    } else {
      workedMinutes += diffMinutes(seg.inAt, seg.outAt);
    }
  }

  if (breakAutoDeductEnabled && workedMinutes > 0) {
    const exitConsumesBreak = !!policy.exitConsumesBreak;
    if (exitConsumesBreak) {
      // Sum all OUT→IN gaps between consecutive segments. These represent exit durations
      // during the shift where the employee was not clocked in.
      let exitGapMinutes = 0;
      for (let i = 0; i < norm.segments.length - 1; i++) {
        const segA = norm.segments[i];
        const segB = norm.segments[i + 1];
        exitGapMinutes += diffMinutes(segA.outAt, segB.inAt);
      }
      // The total potential working time, including exits, is workedMinutes (actual IN→OUT
      // durations) plus exitGapMinutes.
      //
      // IMPORTANT:
      // - In CLAMP_TO_SHIFT mode, cap this at the scheduled shift duration to prevent early/late
      //   time from inflating worked.
      // - In ACTUAL mode, keep the full potentialTotal; worked may exceed the shift duration.
       
      const shiftDuration = toMinuteInt(shiftEnd.diff(shiftStart, "minutes").minutes);
      const potentialTotal = workedMinutes + exitGapMinutes;
      const baseMinutes =
        effectiveWorkedMode === "CLAMP_TO_SHIFT"
          ? Math.min(potentialTotal, shiftDuration)
          : potentialTotal;
      // Deduct whichever is greater: the configured break or the total exit gap.
      const deduct = Math.max(breakMinutes, exitGapMinutes);
      workedMinutes = Math.max(0, baseMinutes - deduct);
    } else {
      // Default behavior: subtract only the fixed break from actual worked minutes.
      workedMinutes = Math.max(0, workedMinutes - breakMinutes);
    }
  }

  const firstIn = norm.firstIn;
  const lastOut = norm.lastOut;

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  let overtimeEarlyMinutes = 0;
  let overtimeLateMinutes = 0;
  let otBreakCount = 0;
  let otBreakDeductMinutes = 0;

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
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        otBreakCount: 0,
        otBreakDeductMinutes: 0,
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
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        otBreakCount: 0,
        otBreakDeductMinutes: 0,
        status: "OFF",
        anomalies: Array.from(anomalies),
      };
    }

    anomalies.add("OFF_DAY_WORK");

    if (offDayEntryBehavior === "COUNT_AS_OT") {
      const otAdjusted = computeOvertimeDynamicBreak({
        overtimeMinutes: workedMinutes,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: workedMinutes,
        otBreakInterval: policy.otBreakInterval,
        otBreakDuration: policy.otBreakDuration,
      });
      return {
        firstIn,
        lastOut,
        workedMinutes,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: otAdjusted.overtimeMinutes,
        overtimeEarlyMinutes: otAdjusted.overtimeEarlyMinutes,
        overtimeLateMinutes: otAdjusted.overtimeLateMinutes,
        otBreakCount: otAdjusted.otBreakCount,
        otBreakDeductMinutes: otAdjusted.otBreakDeductMinutes,
        status: "OFF",
        anomalies: Array.from(anomalies),
      };
    }

    // FLAG
    return {
      firstIn,
      lastOut,
      workedMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      overtimeEarlyMinutes: 0,
      overtimeLateMinutes: 0,
      otBreakCount: 0,
      otBreakDeductMinutes: 0,
      status: "OFF",
      anomalies: Array.from(anomalies),
    };
  }

  // Regular day
  // Build anomaly set (we may enrich/override some raw-normalization anomalies below).
  const anomalies = new Set(norm.anomalies);

  // Detect whether any normalized IN→OUT segment overlaps the scheduled shift window.
  // Used for premium mismatch classification and (in CLAMP mode) presence.
  const hasAnySegment = norm.segments.length > 0;
  let hasAnyOverlapWithShift = false;
  if (hasAnySegment) {
    for (const seg of norm.segments) {
      const inAt = seg.inAt < shiftStartUtc ? shiftStartUtc : seg.inAt;
      const outAt = seg.outAt > shiftEndUtc ? shiftEndUtc : seg.outAt;
      if (outAt > inAt) {
        hasAnyOverlapWithShift = true;
        break;
      }
    }
  }

  // Premium anomaly classification:
  // If there are segments but NONE overlaps the shift window, do not show ORPHAN_OUT.
  // Instead, mark the day as "unscheduled work" (ACTUAL) or "outside shift ignored" (CLAMP).
  if (hasAnySegment && !hasAnyOverlapWithShift) {
    if (effectiveWorkedMode === "CLAMP_TO_SHIFT") {
      anomalies.add("OUTSIDE_SHIFT_IGNORED");
    } else {
      anomalies.add("UNSCHEDULED_WORK");
    }
    anomalies.delete("ORPHAN_OUT");
  }
  
  // IMPORTANT (CLAMP_TO_SHIFT):
  // Presence should be derived from accepted work within the scheduled shift window.
  // Otherwise, a shift-mismatched segment (e.g., day punches on a night shift) would
  // incorrectly mark the day as PRESENT even though workedMinutes is clamped to 0.
  let hasShiftOverlap = false;
  if (firstIn && effectiveWorkedMode === "CLAMP_TO_SHIFT") {
    hasShiftOverlap = hasAnyOverlapWithShift;
  }
  const status: "PRESENT" | "ABSENT" = firstIn
    ? effectiveWorkedMode === "CLAMP_TO_SHIFT"
      ? hasShiftOverlap
        ? "PRESENT"
        : "ABSENT"
      : "PRESENT"
    : "ABSENT";

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

  }

  // OT (SAP mantığına uygun): shift dışına taşan kabul edilmiş segment parçalarının toplamı
  // - Erken giriş (shiftStart öncesi) + geç çıkış (shiftEnd sonrası)
  // - Overnight vardiya için shiftEnd zaten +1 gün ayarlı
  if (status === "PRESENT" && overtimeEnabled) {
    const detailed = computeOutsideShiftMinutesDetailed(norm.segments, shiftStartUtc, shiftEndUtc);
    overtimeEarlyMinutes = detailed.early;
    overtimeLateMinutes = detailed.late;

    // Apply SAP-style overtime mode
    if (overtimeMode === "EARLY_ONLY") {
      overtimeLateMinutes = 0;
    } else if (overtimeMode === "LATE_ONLY") {
      overtimeEarlyMinutes = 0;
    }

    overtimeMinutes = overtimeEarlyMinutes + overtimeLateMinutes;

    // Enterprise: overtime dynamic break deduction (parametric, per-company)
    // Example: every 180 minutes of OT => 30 minutes break.
    const otAdjusted = computeOvertimeDynamicBreak({
      overtimeMinutes,
      overtimeEarlyMinutes,
      overtimeLateMinutes,
      otBreakInterval: policy.otBreakInterval,
      otBreakDuration: policy.otBreakDuration,
    });
    overtimeMinutes = otAdjusted.overtimeMinutes;
    overtimeEarlyMinutes = otAdjusted.overtimeEarlyMinutes;
    overtimeLateMinutes = otAdjusted.overtimeLateMinutes;
    otBreakCount = otAdjusted.otBreakCount;
    otBreakDeductMinutes = otAdjusted.otBreakDeductMinutes;
  }

  // ROUND_ONLY: grace minutes are only tolerance for late/early penalties.
  // They MUST NOT increase workedMinutes.
  if (status === "PRESENT" && graceMode === "ROUND_ONLY") {
    // IMPORTANT:
    // Only CLAMP_TO_SHIFT mode enforces an upper bound (shift duration minus break).
    // ACTUAL mode may exceed the shift duration.
    if (workedCalculationMode === "CLAMP_TO_SHIFT") {
      // Safety: cap worked to at most shift duration minus break (if auto-deduct is enabled)
      const shiftDuration = toMinuteInt(shiftEnd.diff(shiftStart, "minutes").minutes);
      const maxWorked = Math.max(0, shiftDuration - (breakAutoDeductEnabled ? breakMinutes : 0));
      workedMinutes = Math.min(workedMinutes, maxWorked);
    }
  }

  // In PAID_PARTIAL mode, grace-covered late/early minutes are added to workedMinutes.
  // Do not apply when graceMode is ROUND_ONLY.
  if (status === "PRESENT" && graceMode === "PAID_PARTIAL") {
    let extraGrace = 0;

    if (firstIn) {
      const firstLocal = DateTime.fromJSDate(firstIn, { zone: "utc" }).setZone(tz);
      const lateDiff = toMinuteInt(firstLocal.diff(shiftStart, "minutes").minutes); // >0 means late
      if (lateDiff > 0 && lateGraceMinutes > 0) {
        extraGrace += Math.min(lateDiff, lateGraceMinutes);
      }
    }

    if (lastOut) {
      const lastLocal = DateTime.fromJSDate(lastOut, { zone: "utc" }).setZone(tz);
      const earlyDiff = toMinuteInt(shiftEnd.diff(lastLocal, "minutes").minutes); // >0 means left early
      if (earlyDiff > 0 && earlyLeaveGraceMinutes > 0) {
        extraGrace += Math.min(earlyDiff, earlyLeaveGraceMinutes);
      }
    }

    workedMinutes += extraGrace;

    // IMPORTANT:
    // Only CLAMP_TO_SHIFT mode enforces an upper bound (shift duration minus break).
    // ACTUAL mode may exceed the shift duration.
    if (workedCalculationMode === "CLAMP_TO_SHIFT") {
      // Safety: cap worked to at most shift duration minus break (if auto-deduct is enabled)
      const shiftDuration = toMinuteInt(shiftEnd.diff(shiftStart, "minutes").minutes);
      const maxWorked = Math.max(0, shiftDuration - (breakAutoDeductEnabled ? breakMinutes : 0));
      workedMinutes = Math.min(workedMinutes, maxWorked);
    }
  }

  return {
    firstIn,
    lastOut,
    workedMinutes: status === "PRESENT" ? workedMinutes : 0,
    lateMinutes: status === "PRESENT" ? lateMinutes : 0,
    earlyLeaveMinutes: status === "PRESENT" ? earlyLeaveMinutes : 0,
    overtimeMinutes: status === "PRESENT" ? overtimeMinutes : 0,
    overtimeEarlyMinutes: status === "PRESENT" ? overtimeEarlyMinutes : 0,
    overtimeLateMinutes: status === "PRESENT" ? overtimeLateMinutes : 0,
    otBreakCount: status === "PRESENT" ? otBreakCount : 0,
    otBreakDeductMinutes: status === "PRESENT" ? otBreakDeductMinutes : 0,
    status,
    anomalies: Array.from(anomalies),
  };
}
