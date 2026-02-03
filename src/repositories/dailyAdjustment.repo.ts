import { prisma } from "@/src/repositories/prisma";
import { DailyStatus } from "@prisma/client";

/**
 * Retrieve the daily adjustment for an employee on a specific UTC day.
 * The date should be normalized to UTC midnight representing the local day.
 * Returns null if no adjustment exists.
 *
 * @param employeeId The employee identifier
 * @param date The normalized UTC Date representing the day (at midnight)
 */
export async function getDailyAdjustment(employeeId: string, date: Date) {
  return prisma.dailyAdjustment.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
   },
  });
}

/**
 * Create or update a daily adjustment for a given employee on a specific day.
 * The date must be normalized to a UTC midnight representing the desired local
 * day.  Unique constraint on (employeeId, date) ensures only one adjustment
 * record exists per day per employee.  All override fields are optional –
 * undefined values will not overwrite existing values, whereas null values
 * explicitly clear the corresponding override.  The companyId is inferred
 * from the employee record.
 */
export async function upsertDailyAdjustment(args: {
  employeeId: string;
  date: Date;
  data: {
    statusOverride?: DailyStatus | null;
    workedMinutesOverride?: number | null;
    overtimeMinutesOverride?: number | null;
    overtimeEarlyMinutesOverride?: number | null;
    overtimeLateMinutesOverride?: number | null;
    lateMinutesOverride?: number | null;
    earlyLeaveMinutesOverride?: number | null;
    note?: string | null;
  };
}) {
  const { employeeId, date, data } = args;
  // Infer companyId from employee
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  });
  if (!emp) {
    throw new Error("employee_not_found");
  }

  return prisma.dailyAdjustment.upsert({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
    update: {
      ...(data.statusOverride !== undefined ? { statusOverride: data.statusOverride } : {}),
      ...(data.workedMinutesOverride !== undefined
        ? { workedMinutesOverride: data.workedMinutesOverride }
        : {}),
      ...(data.overtimeMinutesOverride !== undefined
        ? { overtimeMinutesOverride: data.overtimeMinutesOverride }
        : {}),
        ...(data.overtimeEarlyMinutesOverride !== undefined 
          ? { overtimeEarlyMinutesOverride: data.overtimeEarlyMinutesOverride } 
          : {}),
      ...(data.overtimeLateMinutesOverride !== undefined 
        ? { overtimeLateMinutesOverride: data.overtimeLateMinutesOverride } 
        : {}),
      ...(data.lateMinutesOverride !== undefined
        ? { lateMinutesOverride: data.lateMinutesOverride }
        : {}),
      ...(data.earlyLeaveMinutesOverride !== undefined
        ? { earlyLeaveMinutesOverride: data.earlyLeaveMinutesOverride }
        : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
    create: {
      companyId: emp.companyId,
      employeeId,
      date,
      statusOverride: data.statusOverride ?? null,
      workedMinutesOverride: data.workedMinutesOverride ?? null,
      overtimeMinutesOverride: data.overtimeMinutesOverride ?? null,
      overtimeEarlyMinutesOverride: data.overtimeEarlyMinutesOverride ?? null,
      overtimeLateMinutesOverride: data.overtimeLateMinutesOverride ?? null,
      lateMinutesOverride: data.lateMinutesOverride ?? null,
      earlyLeaveMinutesOverride: data.earlyLeaveMinutesOverride ?? null,
      note: data.note ?? null,
    },
  });
}

/**
 * Delete a daily adjustment for a given employee and date.  If no record
 * exists, this is a no-op.  Accepts the date normalized to UTC midnight.
 */
export async function deleteDailyAdjustment(
  employeeId: string,
  date: Date,
) {
  await prisma.dailyAdjustment.deleteMany({ where: { employeeId, date } });
}