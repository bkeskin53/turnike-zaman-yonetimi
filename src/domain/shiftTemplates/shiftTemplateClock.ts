import {
  assertDurationMinutes,
  formatDurationMinutesAsDecimalHoursText,
  formatDurationMinutesAsHumanText,
  parseDecimalHoursDurationToMinutes,
} from "@/src/domain/time/decimalHoursDuration";

export const SHIFT_TEMPLATE_MAX_PLANNED_WORK_MINUTES = 12 * 60;
export const DEFAULT_SHIFT_TEMPLATE_START_TIME = "00:00";

export type ShiftTemplateClock = {
  plannedWorkMinutes: number;
  plannedWorkHoursText: string;
  plannedWorkHumanText: string;
  expectedWorkMinutes: number;
  expectedWorkHoursText: string;
  expectedWorkHumanText: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  signature: string;
};

export type ShiftTemplateBreakPlanForExpectedWork = {
  plannedBreakMinutes?: number | null;
  isPaid?: boolean | null;
} | null | undefined;

type PlannedWorkParseOptions = {
  allowZero?: boolean;
};

type TimeParts = {
  hour: number;
  minute: number;
};

export function parsePlannedWorkDecimalHoursToMinutes(
  value: string | number,
  options: PlannedWorkParseOptions = {}
): number {
  return parseDecimalHoursDurationToMinutes(value, {
    allowZero: options.allowZero,
    maxMinutes: SHIFT_TEMPLATE_MAX_PLANNED_WORK_MINUTES,
    hoursErrorPrefix: "PLANNED_WORK_HOURS",
    maxErrorCode: "PLANNED_WORK_HOURS_MAX_12_HOURS",
  });
}

export function assertPlannedWorkMinutes(value: number, options: PlannedWorkParseOptions = {}): number {
  return assertDurationMinutes(value, {
    allowZero: options.allowZero,
    maxMinutes: SHIFT_TEMPLATE_MAX_PLANNED_WORK_MINUTES,
    minutesErrorPrefix: "PLANNED_WORK_MINUTES",
    maxErrorCode: "PLANNED_WORK_MINUTES_MAX_12_HOURS",
  });
}

export function formatMinutesAsDecimalHoursText(minutes: number): string {
  const safeMinutes = assertPlannedWorkMinutes(minutes, { allowZero: true });
  return formatDurationMinutesAsDecimalHoursText(safeMinutes);
}

export function formatMinutesAsHumanDurationText(minutes: number): string {
  const safeMinutes = assertPlannedWorkMinutes(minutes, { allowZero: true });
  return formatDurationMinutesAsHumanText(safeMinutes);
}

function fail(message: string): never {
  throw new Error(message);
}

function parseTimeParts(value: string): TimeParts {
  const text = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (!match) fail("SHIFT_START_TIME_INVALID_FORMAT");

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) fail("SHIFT_START_TIME_INVALID_FORMAT");
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) fail("SHIFT_START_TIME_INVALID_RANGE");
  return { hour, minute };
}

function minuteToTime(totalMinutes: number): string {
  const dayMinute = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(dayMinute / 60);
  const minute = dayMinute % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeToMinute(time: string): number {
  const { hour, minute } = parseTimeParts(time);
  return hour * 60 + minute;
}

export function normalizeShiftStartTime(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_SHIFT_TEMPLATE_START_TIME;
  const { hour, minute } = parseTimeParts(raw);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function deriveShiftEndTime(startTime: string, plannedWorkMinutes: number): string {
  const normalizedStart = normalizeShiftStartTime(startTime);
  const safePlannedMinutes = assertPlannedWorkMinutes(plannedWorkMinutes);
  return minuteToTime(timeToMinute(normalizedStart) + safePlannedMinutes);
}

export function deriveShiftStartTimeFromEndTime(endTime: string, plannedWorkMinutes: number): string {
  const normalizedEnd = normalizeShiftStartTime(endTime);
  const safePlannedMinutes = assertPlannedWorkMinutes(plannedWorkMinutes);
  return minuteToTime(timeToMinute(normalizedEnd) - safePlannedMinutes);
}

export function deriveExpectedWorkMinutes(input: {
  plannedWorkMinutes: number;
  breakPlan?: ShiftTemplateBreakPlanForExpectedWork;
}): number {
  const plannedWorkMinutes = assertPlannedWorkMinutes(input.plannedWorkMinutes, { allowZero: true });
  const breakPlan = input.breakPlan;
  if (!breakPlan) return plannedWorkMinutes;

  const plannedBreakMinutes = Number(breakPlan.plannedBreakMinutes ?? 0);
  if (!Number.isInteger(plannedBreakMinutes) || plannedBreakMinutes < 0) {
    fail("BREAK_PLAN_MINUTES_INVALID");
  }

  if (plannedBreakMinutes > plannedWorkMinutes) {
    fail("BREAK_PLAN_EXCEEDS_PLANNED_WORK");
  }

  if (breakPlan.isPaid === true) {
    return plannedWorkMinutes;
  }

  return plannedWorkMinutes - plannedBreakMinutes;
}

export function derivePlannedWorkMinutesFromShiftTimes(
  startTime: string,
  endTime: string,
  options: PlannedWorkParseOptions = {}
): number {
  const normalizedStart = normalizeShiftStartTime(startTime);
  const normalizedEnd = normalizeShiftStartTime(endTime);
  const startMinute = timeToMinute(normalizedStart);
  const endMinute = timeToMinute(normalizedEnd);
  const rawDuration = endMinute - startMinute;
  const duration = rawDuration <= 0 ? rawDuration + 1440 : rawDuration;
  return assertPlannedWorkMinutes(duration, options);
}

export function isOffShiftTemplateCode(value?: string | null): boolean {
  return String(value ?? "").trim().toUpperCase() === "OFF";
}

export function deriveShiftTemplateClock(input: {
  plannedWorkHours?: string | number | null;
  plannedWorkMinutes?: number | null;
  startTime?: string | null;
  shiftCode?: string | null;
}): ShiftTemplateClock {
  const allowZero = isOffShiftTemplateCode(input.shiftCode);
  const plannedWorkMinutes = input.plannedWorkMinutes != null
    ? assertPlannedWorkMinutes(input.plannedWorkMinutes, { allowZero })
    : parsePlannedWorkDecimalHoursToMinutes(input.plannedWorkHours ?? "", { allowZero });

  const startTime = allowZero && plannedWorkMinutes === 0
    ? DEFAULT_SHIFT_TEMPLATE_START_TIME
    : normalizeShiftStartTime(input.startTime);
  const startMinute = timeToMinute(startTime);
  const endTime = plannedWorkMinutes === 0
    ? startTime
    : minuteToTime(startMinute + plannedWorkMinutes);
  const spansMidnight = plannedWorkMinutes > 0 && startMinute + plannedWorkMinutes >= 1440;
  const signature = allowZero && plannedWorkMinutes === 0
    ? "OFF"
    : `${startTime.replace(":", "")}-${endTime.replace(":", "")}${spansMidnight ? "+1" : ""}`;

  return {
    plannedWorkMinutes,
    plannedWorkHoursText: formatMinutesAsDecimalHoursText(plannedWorkMinutes),
    plannedWorkHumanText: formatMinutesAsHumanDurationText(plannedWorkMinutes),
    expectedWorkMinutes: plannedWorkMinutes,
    expectedWorkHoursText: formatMinutesAsDecimalHoursText(plannedWorkMinutes),
    expectedWorkHumanText: formatMinutesAsHumanDurationText(plannedWorkMinutes),
    startTime,
    endTime,
    spansMidnight,
    signature,
  };
}
