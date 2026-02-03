import { DateTime } from "luxon";

/**
 * Canonical work-day key (dayKey)
 * - Always derived in policy.timezone.
 * - Represented as ISO date string: "YYYY-MM-DD".
 */
export function dayKeyToday(tz: string): string {
  return DateTime.now().setZone(tz).toISODate()!;
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * DB transport for @db.Date fields (DailyAttendance.workDate, DailyAdjustment.date)
 *
 * IMPORTANT:
 * - This does NOT compute the dayKey.
 * - It only converts an already-decided dayKey ("YYYY-MM-DD") into a stable JS Date
 *   pinned to UTC midnight of that same calendar day.
 * - This matches existing system behavior and avoids timezone drift.
 */
export function dbDateFromDayKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}
