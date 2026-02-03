import { DateTime } from "luxon";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listDailyAttendance, listDailyAttendanceRange } from "@/src/repositories/attendance.repo";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export async function getDailyReport(date: string) {
  const companyId = await getActiveCompanyId();
  const workDate = dbDateFromDayKey(date);
  const items = await listDailyAttendance(companyId, workDate);
  return { date, items };
}

export async function getMonthlyReport(month: string) {
  // month: YYYY-MM
  const companyId = await getActiveCompanyId();

  const start = DateTime.fromISO(`${month}-01`, { zone: "utc" }).startOf("month").toJSDate();
  const end = DateTime.fromISO(`${month}-01`, { zone: "utc" }).startOf("month").plus({ months: 1 }).toJSDate();

  const rows = await listDailyAttendanceRange(companyId, start, end);

  const map = new Map<string, {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    workedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    presentDays: number;
    absentDays: number;
    missingPunchDays: number;
  }>();

  for (const r of rows) {
    const key = r.employeeId;
    const current = map.get(key) ?? {
      employeeId: r.employeeId,
      employeeCode: r.employee.employeeCode,
      fullName: `${r.employee.firstName} ${r.employee.lastName}`,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      presentDays: 0,
      absentDays: 0,
      missingPunchDays: 0,
    };

    current.workedMinutes += r.workedMinutes;
    current.lateMinutes += r.lateMinutes;
    current.earlyLeaveMinutes += r.earlyLeaveMinutes;

    if (r.status === "PRESENT") current.presentDays += 1;
    if (r.status === "ABSENT") current.absentDays += 1;
    if (r.anomalies.includes("MISSING_PUNCH")) current.missingPunchDays += 1;

    map.set(key, current);
  }

  return { month, items: Array.from(map.values()).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode)) };
}
