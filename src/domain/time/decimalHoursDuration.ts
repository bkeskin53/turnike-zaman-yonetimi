export type DecimalHoursDurationOptions = {
  allowZero?: boolean;
  maxMinutes?: number;
  hoursErrorPrefix?: string;
  minutesErrorPrefix?: string;
  maxErrorCode?: string;
};

const DEFAULT_MAX_MINUTES = 12 * 60;

function fail(message: string): never {
  throw new Error(message);
}

function normalizeDecimalInput(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("DECIMAL_DURATION_HOURS_INVALID");
    return String(value).replace(".", ",");
  }
  return String(value ?? "").trim().replace(".", ",");
}

function parseDecimalHoursParts(
  value: string | number,
  hoursErrorPrefix: string
): { wholeHours: number; hundredths: number } {
  const text = normalizeDecimalInput(value);
  if (!text) fail(`${hoursErrorPrefix}_REQUIRED`);
  if (!/^\d+(?:,\d{1,2})?$/.test(text)) fail(`${hoursErrorPrefix}_INVALID_FORMAT`);

  const [wholeRaw, fractionRaw = ""] = text.split(",");
  const wholeHours = Number(wholeRaw);
  const hundredths = Number(fractionRaw.padEnd(2, "0"));

  if (!Number.isInteger(wholeHours) || !Number.isInteger(hundredths)) {
    fail(`${hoursErrorPrefix}_INVALID_FORMAT`);
  }

  return { wholeHours, hundredths };
}

export function parseDecimalHoursDurationToMinutes(
  value: string | number,
  options: DecimalHoursDurationOptions = {}
): number {
  const maxMinutes = options.maxMinutes ?? DEFAULT_MAX_MINUTES;
  const hoursErrorPrefix = options.hoursErrorPrefix ?? "DECIMAL_DURATION_HOURS";
  const { wholeHours, hundredths } = parseDecimalHoursParts(value, hoursErrorPrefix);
  const totalHundredths = wholeHours * 100 + hundredths;
  const maxHundredths = (maxMinutes * 100) / 60;

  if (totalHundredths === 0 && options.allowZero) return 0;
  if (totalHundredths <= 0) fail(`${hoursErrorPrefix}_MUST_BE_POSITIVE`);
  if (totalHundredths > maxHundredths) {
    fail(options.maxErrorCode ?? `${hoursErrorPrefix}_MAX_EXCEEDED`);
  }

  return Math.round((totalHundredths * 60) / 100);
}

export function assertDurationMinutes(
  value: number,
  options: DecimalHoursDurationOptions = {}
): number {
  const maxMinutes = options.maxMinutes ?? DEFAULT_MAX_MINUTES;
  const minutesErrorPrefix = options.minutesErrorPrefix ?? "DECIMAL_DURATION_MINUTES";

  if (!Number.isInteger(value)) fail(`${minutesErrorPrefix}_INVALID`);
  if (value === 0 && options.allowZero) return 0;
  if (value <= 0) fail(`${minutesErrorPrefix}_MUST_BE_POSITIVE`);
  if (value > maxMinutes) {
    fail(options.maxErrorCode ?? `${minutesErrorPrefix}_MAX_EXCEEDED`);
  }

  return value;
}

export function formatDurationMinutesAsDecimalHoursText(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) fail("DECIMAL_DURATION_MINUTES_INVALID");
  const hundredths = Math.round((minutes * 100) / 60);
  const whole = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}

export function formatDurationMinutesAsHumanText(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) fail("DECIMAL_DURATION_MINUTES_INVALID");
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} saat ${String(remainder).padStart(2, "0")} dakika`;
}