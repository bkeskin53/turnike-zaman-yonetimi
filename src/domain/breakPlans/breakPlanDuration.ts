import {
  assertDurationMinutes,
  formatDurationMinutesAsDecimalHoursText,
  formatDurationMinutesAsHumanText,
  parseDecimalHoursDurationToMinutes,
} from "@/src/domain/time/decimalHoursDuration";

export const BREAK_PLAN_CODE_LENGTH = 4;
export const BREAK_PLAN_MAX_DURATION_MINUTES = 12 * 60;

export type BreakPlanDurationInput = {
  code: string;
  name: string;
  plannedBreakHours?: string | number | null;
  plannedBreakMinutes?: number | null;
  isPaid?: boolean | null;
};

export type BreakPlanDuration = {
  code: string;
  name: string;
  plannedBreakMinutes: number;
  plannedBreakHoursText: string;
  plannedBreakHumanText: string;
  isPaid: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

export function normalizeBreakPlanCode(value: string | null | undefined): string {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) fail("BREAK_PLAN_CODE_REQUIRED");
  if (!/^[A-Z0-9]{4}$/.test(code)) fail("BREAK_PLAN_CODE_INVALID_FORMAT");
  return code;
}

export function normalizeBreakPlanName(value: string | null | undefined): string {
  const name = String(value ?? "").trim();
  if (!name) fail("BREAK_PLAN_NAME_REQUIRED");
  if (name.length > 120) fail("BREAK_PLAN_NAME_TOO_LONG");
  return name;
}

export function parseBreakDurationDecimalHoursToMinutes(value: string | number): number {
  return parseDecimalHoursDurationToMinutes(value, {
    maxMinutes: BREAK_PLAN_MAX_DURATION_MINUTES,
    hoursErrorPrefix: "BREAK_DURATION_HOURS",
    maxErrorCode: "BREAK_DURATION_HOURS_MAX_12_HOURS",
  });
}

export function assertBreakDurationMinutes(value: number): number {
  return assertDurationMinutes(value, {
    maxMinutes: BREAK_PLAN_MAX_DURATION_MINUTES,
    minutesErrorPrefix: "BREAK_DURATION_MINUTES",
    maxErrorCode: "BREAK_DURATION_MINUTES_MAX_12_HOURS",
  });
}

export function formatBreakMinutesAsDecimalHoursText(minutes: number): string {
  return formatDurationMinutesAsDecimalHoursText(assertBreakDurationMinutes(minutes));
}

export function formatBreakMinutesAsHumanDurationText(minutes: number): string {
  return formatDurationMinutesAsHumanText(assertBreakDurationMinutes(minutes));
}

function hasPlannedBreakMinutes(input: BreakPlanDurationInput): boolean {
  return input.plannedBreakMinutes != null;
}

function hasPlannedBreakHours(input: BreakPlanDurationInput): boolean {
  if (input.plannedBreakHours == null) return false;
  return String(input.plannedBreakHours).trim() !== "";
}

export function deriveBreakPlanDuration(input: BreakPlanDurationInput): BreakPlanDuration {
  const code = normalizeBreakPlanCode(input.code);
  const name = normalizeBreakPlanName(input.name);

  let plannedBreakMinutes: number;
  if (hasPlannedBreakMinutes(input)) {
    plannedBreakMinutes = assertBreakDurationMinutes(Number(input.plannedBreakMinutes));
  } else if (hasPlannedBreakHours(input)) {
    plannedBreakMinutes = parseBreakDurationDecimalHoursToMinutes(input.plannedBreakHours as string | number);
  } else {
    fail("BREAK_DURATION_HOURS_REQUIRED");
  }

  return {
    code,
    name,
    plannedBreakMinutes,
    plannedBreakHoursText: formatBreakMinutesAsDecimalHoursText(plannedBreakMinutes),
    plannedBreakHumanText: formatBreakMinutesAsHumanDurationText(plannedBreakMinutes),
    isPaid: input.isPaid === true,
  };
}