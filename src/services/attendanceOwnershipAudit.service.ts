import { getActiveCompanyId } from "@/src/services/company.service";
import { listAttendanceOwnershipAuditForEmployeeDay } from "@/src/repositories/attendanceOwnershipAudit.repo";

export async function getAttendanceOwnershipAuditForEmployeeDay(args: {
  employeeId: string;
  dayKey: string;
}) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(args.employeeId ?? "").trim();
  const dayKey = String(args.dayKey ?? "").trim();

  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error("DAY_KEY_REQUIRED");

  const items = await listAttendanceOwnershipAuditForEmployeeDay({
    companyId,
    employeeId,
    logicalDayKey: dayKey,
  });

  return {
    employeeId,
    dayKey,
    items,
  };
}