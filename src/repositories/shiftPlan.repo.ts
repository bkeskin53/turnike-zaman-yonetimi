import { prisma } from "@/src/repositories/prisma";

/**
 * Retrieve a weekly shift plan for a given employee and week start date.
 * @param companyId The active company id.
 * @param employeeId The employee id.
 * @param weekStartDate Date representing the Monday of the week (UTC).
 */
export async function findWeeklyShiftPlan(
  companyId: string,
  employeeId: string,
  weekStartDate: Date
) {
  return prisma.weeklyShiftPlan.findUnique({
    where: {
      companyId_employeeId_weekStartDate: {
        companyId,
        employeeId,
        weekStartDate,
      },
    },
  });
}

/**
+ * Batch fetch weekly shift plans for multiple employees for the same weekStartDate.
+ * This is the key N+1 breaker for recompute paths.
+ */
export async function findWeeklyShiftPlansForEmployees(
  companyId: string,
  employeeIds: string[],
  weekStartDate: Date
) {
  if (!employeeIds.length) return [];
  return prisma.weeklyShiftPlan.findMany({
    where: {
      companyId,
      weekStartDate,
      employeeId: { in: employeeIds },
    },
  });
}

/**
 * Upsert a weekly shift plan. If a plan already exists for the given company, employee, and week, it is updated; otherwise a new record is created.
 * @param input Plan details including day start/end minutes.
 */
export function upsertWeeklyShiftPlan(input: {
  companyId: string;
  employeeId: string;
  weekStartDate: Date;
  shiftTemplateId?: string | null;
  monShiftTemplateId?: string | null;
  tueShiftTemplateId?: string | null;
  wedShiftTemplateId?: string | null;
  thuShiftTemplateId?: string | null;
  friShiftTemplateId?: string | null;
  satShiftTemplateId?: string | null;
  sunShiftTemplateId?: string | null;
  monStartMinute?: number | null;
  monEndMinute?: number | null;
  tueStartMinute?: number | null;
  tueEndMinute?: number | null;
  wedStartMinute?: number | null;
  wedEndMinute?: number | null;
  thuStartMinute?: number | null;
  thuEndMinute?: number | null;
  friStartMinute?: number | null;
  friEndMinute?: number | null;
  satStartMinute?: number | null;
  satEndMinute?: number | null;
  sunStartMinute?: number | null;
  sunEndMinute?: number | null;
}) {
  const { companyId, employeeId, weekStartDate, ...rest } = input;
  return prisma.weeklyShiftPlan.upsert({
    where: {
      companyId_employeeId_weekStartDate: {
        companyId,
        employeeId,
        weekStartDate,
      },
    },
    update: {
      ...rest,
    },
    create: {
      companyId,
      employeeId,
      weekStartDate,
      ...rest,
    },
  });
}
