import type { DailyStatus } from "@prisma/client";

/**
 * Represents the override values stored in a DailyAdjustment record.
 */
export interface DailyAdjustmentData {
  statusOverride?: DailyStatus | null;
  workedMinutesOverride?: number | null;
  overtimeMinutesOverride?: number | null;
  overtimeEarlyMinutesOverride?: number | null;
  overtimeLateMinutesOverride?: number | null;
  lateMinutesOverride?: number | null;
  earlyLeaveMinutesOverride?: number | null;
  note?: string | null;
}

/**
 * Minimal representation of a computed daily attendance summary.
 */
export interface DailyComputedInput {
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes?: number;
  overtimeLateMinutes?: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: DailyStatus;
  anomalies: string[];
}

/**
 * Apply a manual daily adjustment on top of a computed summary.
 *
 * For each override field present in the adjustment and not null, this helper
 * writes the override value over the computed value. Fields set to null are
 * ignored, leaving the computed values unchanged.
 *
 * This helper returns a new object and never mutates its inputs.
 */
export function applyDailyAdjustment<T extends DailyComputedInput>(
  computed: T,
  adjustment: DailyAdjustmentData | null | undefined,
): T {
  // Clone the computed summary to avoid mutating the original.
  const result: any = { ...computed };
  if (adjustment) {
    if (adjustment.statusOverride !== undefined && adjustment.statusOverride !== null) {
      result.status = adjustment.statusOverride;
    }
    if (
      adjustment.workedMinutesOverride !== undefined &&
      adjustment.workedMinutesOverride !== null
    ) {
      result.workedMinutes = adjustment.workedMinutesOverride;
    }
    if (
      adjustment.overtimeMinutesOverride !== undefined &&
      adjustment.overtimeMinutesOverride !== null
    ) {
      result.overtimeMinutes = adjustment.overtimeMinutesOverride;
      // When total overtime is overridden, keep a consistent breakdown.
      // We don't know the true early/late split, so store all in late.
      if ("overtimeEarlyMinutes" in result) result.overtimeEarlyMinutes = 0;
      if ("overtimeLateMinutes" in result) result.overtimeLateMinutes = result.overtimeMinutes;
    }
    // Split overtime overrides (SAP-style) have higher priority than the computed breakdown.
    // If any of them are provided, we recalculate total overtime as early+late.
    const hasEarly =
      adjustment.overtimeEarlyMinutesOverride !== undefined &&
      adjustment.overtimeEarlyMinutesOverride !== null;
    const hasLate =
      adjustment.overtimeLateMinutesOverride !== undefined &&
      adjustment.overtimeLateMinutesOverride !== null;
    if (hasEarly || hasLate) {
      const baseEarly = typeof (result as any).overtimeEarlyMinutes === "number" ? (result as any).overtimeEarlyMinutes : 0;
      const baseLate = typeof (result as any).overtimeLateMinutes === "number" ? (result as any).overtimeLateMinutes : 0;
      const early = hasEarly ? (adjustment.overtimeEarlyMinutesOverride as number) : baseEarly;
      const late = hasLate ? (adjustment.overtimeLateMinutesOverride as number) : baseLate;
      (result as any).overtimeEarlyMinutes = early;
      (result as any).overtimeLateMinutes = late;
      result.overtimeMinutes = early + late;
    }
    if (
      adjustment.lateMinutesOverride !== undefined &&
      adjustment.lateMinutesOverride !== null
    ) {
      result.lateMinutes = adjustment.lateMinutesOverride;
    }
    if (
      adjustment.earlyLeaveMinutesOverride !== undefined &&
      adjustment.earlyLeaveMinutesOverride !== null
    ) {
      result.earlyLeaveMinutes = adjustment.earlyLeaveMinutesOverride;
    }
  }
  return result;
}