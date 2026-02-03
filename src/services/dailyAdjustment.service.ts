import { DateTime } from "luxon";
import { getCompanyBundle } from "@/src/services/company.service";
import {
 getDailyAdjustment,
  upsertDailyAdjustment,
  deleteDailyAdjustment,
} from "@/src/repositories/dailyAdjustment.repo";
import { DailyStatus } from "@prisma/client";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

/**
 * Canonicalize a day string into a UTC Date at 00:00:00Z for that same calendar day.
 *
 * IMPORTANT (canonical day)
 * We store `DailyAdjustment.date` in a `@db.Date` column and want it to match
 * `DailyAttendance.workDate`, which is written as `new Date(`${iso}T00:00:00.000Z`)`.
 *
 * Therefore this helper does NOT shift the date based on timezone offsets.
 * The `tz` argument is kept for backward compatibility with callers but is
 * intentionally not used.
 *
 * Accepts:
 * - "YYYY-MM-DD" (preferred)
 * - "dd.MM.yyyy" (defensive/legacy)
 */
export function normalizeToUtcMidnight(date: string, tz: string): Date | null {
  if (!date) return null;

  let dt: DateTime;

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dt = DateTime.fromISO(date, { zone: "utc" });
  }
  // TR: dd.MM.yyyy
  else if (/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
    dt = DateTime.fromFormat(date, "dd.MM.yyyy", { zone: "utc" });
  } else {
    return null;
  }

  if (!dt.isValid) return null;
  const iso = dt.toISODate();
  if (!iso) return null;
  return dbDateFromDayKey(iso);
}

/**
 * Retrieve the adjustment record for an employee on a given day.  The date
 * parameter should be provided as "YYYY-MM-DD" in local policy timezone.
 * Returns null if no adjustment exists.
 */
export async function getDailyAdjustmentForEmployeeOnDate(
  employeeId: string,
  date: string,
) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const utc = normalizeToUtcMidnight(date, tz);
  if (!utc) return null;
  return getDailyAdjustment(employeeId, utc);
}

/**
 * Create or update an adjustment for an employee on a given day.  The date
 * should be provided as YYYY-MM-DD in local policy timezone.  Undefined
 * override values are ignored, whereas null clears the override.
 */
export async function upsertDailyAdjustmentForEmployeeOnDate(
  employeeId: string,
  date: string,
  overrides: {
    statusOverride?: DailyStatus | null;
    workedMinutesOverride?: number | null;
    overtimeMinutesOverride?: number | null;
   overtimeEarlyMinutesOverride?: number | null;
    overtimeLateMinutesOverride?: number | null;
    lateMinutesOverride?: number | null;
    earlyLeaveMinutesOverride?: number | null;
    note?: string | null;
  },
) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const utc = normalizeToUtcMidnight(date, tz);
  if (!utc) throw new Error("INVALID_DATE");
  return upsertDailyAdjustment({
    employeeId,
    date: utc,
    data: overrides,
  });
}

/**
 * Delete/clear an adjustment for the given employee on the specified date.  No
 * error is thrown if no record exists.  The date should be YYYY-MM-DD in
 * local policy timezone.
 */
export async function deleteDailyAdjustmentForEmployeeOnDate(
  employeeId: string,
  date: string,
) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const utc = normalizeToUtcMidnight(date, tz);
  if (!utc) throw new Error("INVALID_DATE");
  return deleteDailyAdjustment(employeeId, utc);
}