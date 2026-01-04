import { NextResponse } from "next/server";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listDailyAttendanceRange } from "@/src/repositories/attendance.repo";

function parseMonth(month: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]); // 1-12
  if (mon < 1 || mon > 12) return null;
  return { year, mon };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const parsed = parseMonth(month);
  if (!parsed) {
    return NextResponse.json({ error: "invalid month format (YYYY-MM)" }, { status: 400 });
  }

  const { year, mon } = parsed;
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));

  const companyId = await getActiveCompanyId();
  const rows = await listDailyAttendanceRange(companyId, start, end);

  const map = new Map<
    string,
    {
      employeeId: string;
      employeeCode: string;
      fullName: string;
      workedMinutes: number;
      overtimeMinutes: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      presentDays: number;
      absentDays: number;
      offDays: number;
      missingPunchDays: number;
    }
  >();

  for (const r of rows) {
    const emp = (r as any).employee;
    const employeeCode = emp?.employeeCode ?? "";
    const fullName = `${emp?.firstName ?? ""} ${emp?.lastName ?? ""}`.trim();

    const curr =
      map.get(r.employeeId) ??
      {
        employeeId: r.employeeId,
        employeeCode,
        fullName,
        workedMinutes: 0,
        overtimeMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        presentDays: 0,
        absentDays: 0,
        offDays: 0,
        missingPunchDays: 0,
      };

    curr.workedMinutes += r.workedMinutes ?? 0;
    curr.overtimeMinutes += (r as any).overtimeMinutes ?? 0;
    curr.lateMinutes += r.lateMinutes ?? 0;
    curr.earlyLeaveMinutes += r.earlyLeaveMinutes ?? 0;

    if (r.status === "PRESENT") curr.presentDays += 1;
    if (r.status === "ABSENT") curr.absentDays += 1;
    if (r.status === "OFF") curr.offDays += 1;

    const an = (r.anomalies ?? []) as string[];
    if (an.includes("MISSING_PUNCH")) curr.missingPunchDays += 1;

    map.set(r.employeeId, curr);
  }

  const items = Array.from(map.values()).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

  return NextResponse.json({ month, items });
}
