import { DailyComputed, computeOvertimeDynamicBreak } from "@/src/domain/attendance/computeDaily";
import type { NormalizationResult } from "@/src/domain/attendance/normalizePunches";

type UnscheduledWorkBehavior = "IGNORE" | "FLAG_ONLY" | "COUNT_AS_OT";
type LeaveEntryBehavior = "IGNORE" | "FLAG" | "COUNT_AS_OT";

function sumSegmentMinutes(
  segments: Array<{ inAt: Date; outAt: Date }>
): number {
  let total = 0;
  for (const seg of segments) {
    total += Math.max(0, Math.round((seg.outAt.getTime() - seg.inAt.getTime()) / 60000));
  }
  return total;
}

function intersectSegmentWithWindow(
  seg: { inAt: Date; outAt: Date },
  windowStart: Date,
  windowEnd: Date
): { inAt: Date; outAt: Date } | null {
  const inAt = seg.inAt > windowStart ? seg.inAt : windowStart;
  const outAt = seg.outAt < windowEnd ? seg.outAt : windowEnd;
  return outAt > inAt ? { inAt, outAt } : null;
}

function buildNormalizedFromSegments(
  segments: Array<{ inAt: Date; outAt: Date }>
): NormalizationResult {
  const acceptedEvents: Array<{ occurredAt: Date; direction: "IN" | "OUT" }> = [];
  for (const seg of segments) {
    acceptedEvents.push({ occurredAt: seg.inAt, direction: "IN" });
    acceptedEvents.push({ occurredAt: seg.outAt, direction: "OUT" });
  }

  return {
    decisions: {},
    acceptedEvents,
    segments,
    firstIn: segments[0]?.inAt ?? null,
    lastOut: segments.length > 0 ? segments[segments.length - 1]!.outAt : null,
    anomalies: [],
    hasOpenIn: false,
  };
}

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function allocateWorkedBuckets(args: {
  rawScheduledWorkedMinutes: number;
  rawUnscheduledWorkedMinutes: number;
  breakDeductAppliedMinutes: number;
  gracePaidMinutes: number;
}) {
  let scheduled = clampNonNegativeInt(args.rawScheduledWorkedMinutes);
  let unscheduled = clampNonNegativeInt(args.rawUnscheduledWorkedMinutes);

  let remainingBreak = Math.min(
    clampNonNegativeInt(args.breakDeductAppliedMinutes),
    scheduled + unscheduled
  );

  if (remainingBreak > 0 && scheduled > 0) {
    const take = Math.min(scheduled, remainingBreak);
    scheduled -= take;
    remainingBreak -= take;
  }

  if (remainingBreak > 0 && unscheduled > 0) {
    const take = Math.min(unscheduled, remainingBreak);
    unscheduled -= take;
    remainingBreak -= take;
  }

  // Paid grace is a scheduled-time semantic. It must never create unscheduled work.
  scheduled += clampNonNegativeInt(args.gracePaidMinutes);

  return {
    scheduledWorkedMinutes: clampNonNegativeInt(scheduled),
    unscheduledWorkedMinutes: clampNonNegativeInt(unscheduled),
  };
}

function getUnscheduledWorkBehavior(raw: unknown): UnscheduledWorkBehavior {
  const v = String(raw ?? "FLAG_ONLY").toUpperCase();
  if (v === "IGNORE") return "IGNORE";
  if (v === "COUNT_AS_OT") return "COUNT_AS_OT";
  return "FLAG_ONLY";
}

function getLeaveEntryBehavior(raw: unknown): LeaveEntryBehavior {
  const v = String(raw ?? "FLAG").toUpperCase();
  if (v === "IGNORE") return "IGNORE";
  if (v === "COUNT_AS_OT") return "COUNT_AS_OT";
  return "FLAG";
}

export function evaluateAttendanceDay(args: {
  computed: DailyComputed;
  fullNorm: NormalizationResult;
  visibleEventCount: number;
  isLeaveDay: boolean;
  isOffDay: boolean;
  leaveEntryBehaviorRaw?: unknown;
  unscheduledWorkBehaviorRaw?: unknown;
  shiftStartMinute?: number | null;
  shiftEndMinute?: number | null;
  dayStartUtc: Date;
  otBreakInterval?: number;
  otBreakDuration?: number;
  hasVisibleRestViolation: boolean;
  hasReferenceShift: boolean;
}) {
  const leaveEntryBehavior = getLeaveEntryBehavior(args.leaveEntryBehaviorRaw);
  const baseUnscheduledBehavior = getUnscheduledWorkBehavior(args.unscheduledWorkBehaviorRaw);

  const unscheduledBehavior: UnscheduledWorkBehavior =
    args.isLeaveDay
      ? leaveEntryBehavior === "IGNORE"
        ? "IGNORE"
        : leaveEntryBehavior === "COUNT_AS_OT"
        ? "COUNT_AS_OT"
        : "FLAG_ONLY"
      : baseUnscheduledBehavior;

  let finalComputed: DailyComputed = { ...args.computed };

  if (args.isLeaveDay) {
    const hasAnyPunch =
      args.visibleEventCount > 0 || args.fullNorm.acceptedEvents.length > 0;
    const anomalies = new Set(args.computed.anomalies);
    anomalies.delete("NO_PLAN");

    if (!hasAnyPunch) {
      finalComputed = {
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
        status: "LEAVE",
        anomalies: [],
      };
    } else if (leaveEntryBehavior === "IGNORE") {
      anomalies.add("LEAVE_PUNCH_IGNORED");
      finalComputed = {
        ...args.computed,
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        otBreakCount: 0,
        otBreakDeductMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "LEAVE",
        anomalies: Array.from(anomalies),
      };
    } else if (leaveEntryBehavior === "COUNT_AS_OT") {
      anomalies.add("LEAVE_PUNCH_OT");
      const otAdjusted = computeOvertimeDynamicBreak({
        overtimeMinutes: args.computed.workedMinutes,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: args.computed.workedMinutes,
        otBreakInterval: args.otBreakInterval,
        otBreakDuration: args.otBreakDuration,
      });
      finalComputed = {
        ...args.computed,
        overtimeMinutes: otAdjusted.overtimeMinutes,
        overtimeEarlyMinutes: otAdjusted.overtimeEarlyMinutes,
        overtimeLateMinutes: otAdjusted.overtimeLateMinutes,
        otBreakCount: otAdjusted.otBreakCount,
        otBreakDeductMinutes: otAdjusted.otBreakDeductMinutes,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "LEAVE",
        anomalies: Array.from(anomalies),
      };
    } else {
      anomalies.add("LEAVE_PUNCH_FLAG");
      finalComputed = {
        ...args.computed,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        otBreakCount: 0,
        otBreakDeductMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "LEAVE",
        anomalies: Array.from(anomalies),
      };
    }
  }

  const computedRef = finalComputed;

  const canUseShiftWindowSplit = args.hasReferenceShift && !args.isOffDay;

  const shiftStartMinute =
    typeof args.shiftStartMinute === "number" ? args.shiftStartMinute : 0;
  const shiftEndMinute =
    typeof args.shiftEndMinute === "number" ? args.shiftEndMinute : 0;

  const shiftStartUtc = new Date(args.dayStartUtc.getTime() + shiftStartMinute * 60000);
  let shiftEndUtc = new Date(args.dayStartUtc.getTime() + shiftEndMinute * 60000);
  if (shiftEndMinute <= shiftStartMinute) {
    shiftEndUtc = new Date(shiftEndUtc.getTime() + 24 * 60 * 60000);
  }

  const scheduledSegments: Array<{ inAt: Date; outAt: Date }> = [];
  const unscheduledSegments: Array<{ inAt: Date; outAt: Date }> = [];

  if (canUseShiftWindowSplit) {
    for (const seg of args.fullNorm.segments) {
      const overlap = intersectSegmentWithWindow(seg, shiftStartUtc, shiftEndUtc);
      if (overlap) scheduledSegments.push(overlap);

      if (seg.inAt < shiftStartUtc) {
        const earlyOut = seg.outAt < shiftStartUtc ? seg.outAt : shiftStartUtc;
        if (earlyOut > seg.inAt) {
          unscheduledSegments.push({ inAt: seg.inAt, outAt: earlyOut });
        }
      }

      if (seg.outAt > shiftEndUtc) {
        const lateIn = seg.inAt > shiftEndUtc ? seg.inAt : shiftEndUtc;
        if (seg.outAt > lateIn) {
          unscheduledSegments.push({ inAt: lateIn, outAt: seg.outAt });
        }
      }
    }
  } else {
    for (const seg of args.fullNorm.segments) {
      unscheduledSegments.push(seg);
    }
  }

  const rawScheduledWorkedMinutes = sumSegmentMinutes(scheduledSegments);
  const rawUnscheduledWorkedMinutes = sumSegmentMinutes(unscheduledSegments);
  const rawVisibleWorkedMinutes = rawScheduledWorkedMinutes + rawUnscheduledWorkedMinutes;

  const rawWorkedFromComputed = clampNonNegativeInt(
    Number(args.computed.rawWorkedMinutes ?? rawVisibleWorkedMinutes)
  );
  const gracePaidMinutes = clampNonNegativeInt(
    Number(args.computed.gracePaidMinutes ?? 0)
  );
  const breakDeductAppliedMinutes = clampNonNegativeInt(
    Number(
      args.computed.breakDeductAppliedMinutes ??
        Math.max(
          0,
          rawWorkedFromComputed + gracePaidMinutes - Number(args.computed.workedMinutes ?? 0)
        )
    )
  );

  let scheduledWorkedMinutes = 0;
  let unscheduledWorkedMinutes = 0;
  let scheduledOvertimeMinutes = Math.max(0, Number(args.computed.overtimeMinutes ?? 0));
  let unscheduledOvertimeMinutes = 0;

  if (args.hasVisibleRestViolation && !computedRef.anomalies.includes("REST_VIOLATION")) {
    computedRef.anomalies.push("REST_VIOLATION");
  }

  const hasOutsideWindowSameDayWork =
    rawUnscheduledWorkedMinutes > 0;
  const outsideWindowWorkedMinutes =
    unscheduledBehavior !== "IGNORE" ? rawUnscheduledWorkedMinutes : 0;

  if (
    hasOutsideWindowSameDayWork &&
    computedRef.firstIn === null &&
    computedRef.lastOut === null &&
    computedRef.workedMinutes === 0
  ) {
    const outsideNorm = buildNormalizedFromSegments(unscheduledSegments);
    computedRef.firstIn = outsideNorm.firstIn;
    computedRef.lastOut = outsideNorm.lastOut;
    computedRef.lateMinutes = 0;
    computedRef.earlyLeaveMinutes = 0;
    computedRef.overtimeMinutes = 0;
    computedRef.overtimeEarlyMinutes = 0;
    computedRef.overtimeLateMinutes = 0;
    computedRef.otBreakCount = 0;
    computedRef.otBreakDeductMinutes = 0;
    computedRef.status = "PRESENT";
  }

  if (hasOutsideWindowSameDayWork && unscheduledBehavior !== "COUNT_AS_OT") {
    const outsideWindowWorkAnomaly = args.isOffDay ? "OFF_DAY_WORK" : "UNSCHEDULED_WORK";
    const oppositeAnomaly = args.isOffDay ? "UNSCHEDULED_WORK" : "OFF_DAY_WORK";

    computedRef.anomalies = computedRef.anomalies.filter((a) => a !== oppositeAnomaly);
    if (!computedRef.anomalies.includes(outsideWindowWorkAnomaly)) {
      computedRef.anomalies.push(outsideWindowWorkAnomaly);
    }
  }

  if (args.isLeaveDay) {
    scheduledWorkedMinutes = 0;
    unscheduledWorkedMinutes = 0;
    scheduledOvertimeMinutes = Math.max(0, Number(computedRef.overtimeMinutes ?? 0));
    unscheduledOvertimeMinutes = 0;
  } else {
    const alloc = allocateWorkedBuckets({
      rawScheduledWorkedMinutes,
      rawUnscheduledWorkedMinutes:
        unscheduledBehavior === "IGNORE" ? 0 : rawUnscheduledWorkedMinutes,
      breakDeductAppliedMinutes,
      gracePaidMinutes,
    });

    scheduledWorkedMinutes = alloc.scheduledWorkedMinutes;
    unscheduledWorkedMinutes = alloc.unscheduledWorkedMinutes;

    computedRef.workedMinutes = scheduledWorkedMinutes + unscheduledWorkedMinutes;
    computedRef.rawWorkedMinutes = rawWorkedFromComputed;
    computedRef.breakDeductAppliedMinutes = Math.min(
      breakDeductAppliedMinutes,
      rawScheduledWorkedMinutes +
        (unscheduledBehavior === "IGNORE" ? 0 : rawUnscheduledWorkedMinutes)
    );
    computedRef.gracePaidMinutes = gracePaidMinutes;

    // When all retained work is outside shift / no-plan / off-day work,
    // late/early penalties must not survive from base scheduled-day math.
    if (scheduledWorkedMinutes === 0 && unscheduledWorkedMinutes > 0) {
      computedRef.lateMinutes = 0;
      computedRef.earlyLeaveMinutes = 0;
    }

    if (
      unscheduledBehavior === "COUNT_AS_OT" &&
      unscheduledWorkedMinutes > 0
    ) {
      const otAdjusted = computeOvertimeDynamicBreak({
        overtimeMinutes: unscheduledWorkedMinutes,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: unscheduledWorkedMinutes,
        otBreakInterval: args.otBreakInterval,
        otBreakDuration: args.otBreakDuration,
      });

      unscheduledOvertimeMinutes = otAdjusted.overtimeMinutes;
      scheduledOvertimeMinutes = Math.max(0, Number(args.computed.overtimeMinutes ?? 0));
      computedRef.overtimeMinutes = scheduledOvertimeMinutes + unscheduledOvertimeMinutes;
      computedRef.overtimeEarlyMinutes =
        Math.max(0, Number(args.computed.overtimeEarlyMinutes ?? 0)) + otAdjusted.overtimeEarlyMinutes;
      computedRef.overtimeLateMinutes =
        Math.max(0, Number(args.computed.overtimeLateMinutes ?? 0)) + otAdjusted.overtimeLateMinutes;
      computedRef.otBreakCount =
        Math.max(0, Number(args.computed.otBreakCount ?? 0)) + otAdjusted.otBreakCount;
      computedRef.otBreakDeductMinutes =
        Math.max(0, Number(args.computed.otBreakDeductMinutes ?? 0)) + otAdjusted.otBreakDeductMinutes;
    }
  }

  if (unscheduledBehavior !== "COUNT_AS_OT") {
    scheduledOvertimeMinutes = Math.max(0, Number(computedRef.overtimeMinutes ?? 0));
    unscheduledOvertimeMinutes = 0;
  }

  if (computedRef.status !== "OFF" && computedRef.status !== "LEAVE" && !args.hasReferenceShift) {
    if (
      computedRef.workedMinutes > 0 ||
      computedRef.firstIn !== null ||
      computedRef.lastOut !== null
    ) {
      if (!computedRef.anomalies.includes("NO_PLAN")) {
        computedRef.anomalies.push("NO_PLAN");
      }
    }
  }

  return {
    computed: computedRef,
    scheduledWorkedMinutes,
    unscheduledWorkedMinutes,
    scheduledOvertimeMinutes,
    unscheduledOvertimeMinutes,
    leaveEntryBehavior,
    unscheduledBehavior,
  };
}