import { DateTime } from "luxon";

export type ShiftInstanceSource =
  | "PREVIOUS_DAY"
  | "CURRENT_DAY"
  | "NEXT_DAY";

export type ShiftInstance = {
  source: ShiftInstanceSource;
  logicalDayKey: string;
  timezone: string;

  shiftSource: string | null;
  shiftSignature: string | null;
  shiftTemplateId: string | null;

  isOffDay: boolean;
  spansMidnight: boolean;

  plannedStartMinute: number | null;
  plannedEndMinute: number | null;

  plannedStartUtc: Date | null;
  plannedEndUtc: Date | null;

  earlyInToleranceStartUtc: Date | null;
  lateOutToleranceEndUtc: Date | null;
};

export function buildShiftInstance(args: {
  source: ShiftInstanceSource;
  logicalDayKey: string;
  timezone: string;
  shiftSource?: string | null;
  shiftSignature?: string | null;
  shiftTemplateId?: string | null;
  isOffDay?: boolean;
  spansMidnight?: boolean;
  plannedStartMinute?: number | null;
  plannedEndMinute?: number | null;
  ownershipEarlyInMinutes: number;
  ownershipNextShiftLookaheadMinutes?: number;
  ownershipLateOutMinutes: number;
}): ShiftInstance {
  const tz = args.timezone || "Europe/Istanbul";
  const isOffDay = !!args.isOffDay;

  const plannedStartMinute =
    typeof args.plannedStartMinute === "number" ? args.plannedStartMinute : null;
  const plannedEndMinute =
    typeof args.plannedEndMinute === "number" ? args.plannedEndMinute : null;

  if (isOffDay || plannedStartMinute === null || plannedEndMinute === null) {
    return {
      source: args.source,
      logicalDayKey: args.logicalDayKey,
      timezone: tz,
      shiftSource: args.shiftSource ?? null,
      shiftSignature: args.shiftSignature ?? null,
      shiftTemplateId: args.shiftTemplateId ?? null,
      isOffDay,
      spansMidnight: !!args.spansMidnight,
      plannedStartMinute,
      plannedEndMinute,
      plannedStartUtc: null,
      plannedEndUtc: null,
      earlyInToleranceStartUtc: null,
      lateOutToleranceEndUtc: null,
    };
  }

  const dayStart = DateTime.fromISO(args.logicalDayKey, { zone: tz }).startOf("day");
  const spansMidnight =
    typeof args.spansMidnight === "boolean"
      ? args.spansMidnight
      : plannedEndMinute <= plannedStartMinute;

  const plannedStart = dayStart.plus({ minutes: plannedStartMinute });
  const plannedEnd = spansMidnight
    ? dayStart.plus({ days: 1, minutes: plannedEndMinute })
    : dayStart.plus({ minutes: plannedEndMinute });

  const baseEarlyInToleranceMinutes = Math.max(0, args.ownershipEarlyInMinutes);
  const nextShiftLookaheadMinutes = Math.max(
    0,
    args.ownershipNextShiftLookaheadMinutes ?? 0
  );

  const effectiveEarlyInToleranceMinutes =
    args.source === "NEXT_DAY"
      ? Math.max(baseEarlyInToleranceMinutes, nextShiftLookaheadMinutes)
      : baseEarlyInToleranceMinutes;

  return {
    source: args.source,
    logicalDayKey: args.logicalDayKey,
    timezone: tz,
    shiftSource: args.shiftSource ?? null,
    shiftSignature: args.shiftSignature ?? null,
    shiftTemplateId: args.shiftTemplateId ?? null,
    isOffDay,
    spansMidnight,
    plannedStartMinute,
    plannedEndMinute,
    plannedStartUtc: plannedStart.toUTC().toJSDate(),
    plannedEndUtc: plannedEnd.toUTC().toJSDate(),
    earlyInToleranceStartUtc: plannedStart
      .minus({ minutes: effectiveEarlyInToleranceMinutes })
      .toUTC()
      .toJSDate(),
    lateOutToleranceEndUtc: plannedEnd
     .plus({ minutes: Math.max(0, args.ownershipLateOutMinutes) })
      .toUTC()
      .toJSDate(),
  };
}

export function getShiftInstanceDurationMinutes(instance: ShiftInstance): number {
  if (!instance.plannedStartUtc || !instance.plannedEndUtc) return 0;
  return Math.max(
    0,
    Math.round((instance.plannedEndUtc.getTime() - instance.plannedStartUtc.getTime()) / 60000)
  );
}

export function isEventInsideInstanceToleranceWindow(
  instance: ShiftInstance,
  occurredAt: Date
): boolean {
  if (!instance.earlyInToleranceStartUtc || !instance.lateOutToleranceEndUtc) return false;
  return (
    occurredAt >= instance.earlyInToleranceStartUtc &&
    occurredAt <= instance.lateOutToleranceEndUtc
  );
}

export function diffFromPlannedStartMinutes(instance: ShiftInstance, occurredAt: Date): number | null {
  if (!instance.plannedStartUtc) return null;
  return Math.round((occurredAt.getTime() - instance.plannedStartUtc.getTime()) / 60000);
}

export function diffFromPlannedEndMinutes(instance: ShiftInstance, occurredAt: Date): number | null {
  if (!instance.plannedEndUtc) return null;
  return Math.round((occurredAt.getTime() - instance.plannedEndUtc.getTime()) / 60000);
}