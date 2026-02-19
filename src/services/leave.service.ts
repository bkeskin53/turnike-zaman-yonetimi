import { DateTime } from "luxon";
import { getCompanyBundle } from "@/src/services/company.service";
import {
  findLeavesForEmployee,
  findLeaveOnDate,
  findLeaveOverlap,
  createEmployeeLeave,
  deleteEmployeeLeave,
} from "@/src/repositories/leave.repo";
import { assertEmployeeEmployedForRange, EmploymentNotEmployedError } from "@/src/services/employmentGuard.service";

export class LeaveOverlapError extends Error {
  code = "LEAVE_OVERLAP" as const;

  constructor(message = "Bu tarihlerde zaten izin kaydı var.") {
    super(message);
    this.name = "LeaveOverlapError";
  }
}

export class LeaveInvalidRangeError extends Error {
  code = "LEAVE_INVALID_RANGE" as const;

  constructor(message = "İzin başlangıç tarihi bitiş tarihinden büyük olamaz.") {
    super(message);
    this.name = "LeaveInvalidRangeError";
  }
}

export { EmploymentNotEmployedError };

export async function isEmployeeOnLeave(employeeId: string, date: string) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const startOfDay = DateTime.fromISO(date, { zone: tz })
    .startOf("day")
    .toUTC()
    .toJSDate();
  const endOfDay = DateTime.fromISO(date, { zone: tz })
    .endOf("day")
    .toUTC()
    .toJSDate();
  return findLeaveOnDate(employeeId, startOfDay, endOfDay);
}

export async function listLeavesForEmployee(
  employeeId: string,
  from?: string,
  to?: string
) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const fromDate = from
    ? DateTime.fromISO(from, { zone: tz })
        .startOf("day")
        .toUTC()
        .toJSDate()
    : undefined;
  const toDate = to
    ? DateTime.fromISO(to, { zone: tz })
        .endOf("day")
        .toUTC()
        .toJSDate()
    : undefined;
  const leaves = await findLeavesForEmployee(employeeId, fromDate, toDate);

  // We store dateFrom/dateTo as UTC instants representing day boundaries in policy timezone.
  // When returning to UI, convert back to policy timezone and return yyyy-MM-dd strings
  // to prevent off-by-one-day display when the UI slices UTC ISO strings.
  return leaves.map((l) => {
    const df =
      DateTime.fromJSDate(l.dateFrom, { zone: "utc" }).setZone(tz).toISODate() ??
      l.dateFrom.toISOString().slice(0, 10);
    const dt =
      DateTime.fromJSDate(l.dateTo, { zone: "utc" }).setZone(tz).toISODate() ??
      l.dateTo.toISOString().slice(0, 10);

    return {
      id: l.id,
      dateFrom: df,
      dateTo: dt,
      type: String(l.type),
      note: l.note,
    };
  });
}

export async function createLeaveForEmployee(data: {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  note?: string;
}) {
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  // ✅ Eksik-3: leave sadece employment validity içinde girilebilir (strict)
  await assertEmployeeEmployedForRange({
    employeeId: data.employeeId,
    fromDayKey: data.dateFrom,
    toDayKey: data.dateTo,
  });
  const fromUtc = DateTime.fromISO(data.dateFrom, { zone: tz })
    .startOf("day")
    .toUTC()
    .toJSDate();
  const toUtc = DateTime.fromISO(data.dateTo, { zone: tz })
    .endOf("day")
    .toUTC()
    .toJSDate();
    if (fromUtc.getTime() > toUtc.getTime()) {
    throw new LeaveInvalidRangeError();
  }
    const overlap = await findLeaveOverlap(data.employeeId, fromUtc, toUtc);
  if (overlap) {
    throw new LeaveOverlapError();
  }
  return createEmployeeLeave({
    employeeId: data.employeeId,
    dateFrom: fromUtc,
    dateTo: toUtc,
    type: data.type,
    note: data.note,
  });
}

export async function deleteLeave(employeeId: string, leaveId: string) {
  return deleteEmployeeLeave(employeeId, leaveId);
}