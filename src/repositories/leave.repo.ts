import { prisma } from "@/src/repositories/prisma";

/**
 * Create a new leave entry for an employee.  The companyId is inferred
 * from the employee record.  Dates must be provided in UTC.
 */
export async function createEmployeeLeave(data: {
  employeeId: string;
  dateFrom: Date;
  dateTo: Date;
  type: string;
  note?: string;
}) {
  // Fetch the employee to determine the company context
  const emp = await prisma.employee.findUnique({
    where: { id: data.employeeId },
    select: { companyId: true },
  });
  if (!emp) throw new Error("employee_not_found");

  return prisma.employeeLeave.create({
    data: {
      companyId: emp.companyId,
      employeeId: data.employeeId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      // Cast type to the enum. Prisma will validate this string against the LeaveType enum.
      type: data.type as any,
      note: data.note ?? null,
   },
  });
}

/**
 * List all leave entries for an employee.  Optionally filters by overlapping
 * date range.  A leave is included if it intersects with the provided
 * [from, to] window.
 */
export async function findLeavesForEmployee(
  employeeId: string,
  from?: Date,
  to?: Date
) {
  return prisma.employeeLeave.findMany({
    where: {
      employeeId,
      ...(from && to
        ? {
            AND: [
              { dateFrom: { lte: to } },
              { dateTo: { gte: from } },
            ],
          }
        : from
        ? { dateTo: { gte: from } }
        : to
        ? { dateFrom: { lte: to } }
        : {}),
    },
    orderBy: { dateFrom: "asc" },
  });
}

/**
 * Same as findLeaveOverlap but excludes a given leaveId (for updates).
 */
export async function findLeaveOverlapExcludingId(
  employeeId: string,
  excludeLeaveId: string,
  newFromUtc: Date,
  newToUtc: Date
) {
  return prisma.employeeLeave.findFirst({
    where: {
      employeeId,
      NOT: { id: excludeLeaveId },
      dateFrom: { lte: newToUtc },
      dateTo: { gte: newFromUtc },
    },
    orderBy: { dateFrom: "asc" },
  });
}

export async function updateEmployeeLeave(data: {
  leaveId: string;
  employeeId: string;
  dateFrom: Date;
  dateTo: Date;
  type: string;
  note?: string | null;
}) {
  // Ownership check
  const existing = await prisma.employeeLeave.findUnique({
    where: { id: data.leaveId },
    select: { id: true, employeeId: true },
  });
  if (!existing || existing.employeeId !== data.employeeId) {
    throw new Error("leave_not_found");
  }

  return prisma.employeeLeave.update({
    where: { id: data.leaveId },
    data: {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      type: data.type as any,
      note: data.note ?? null,
    },
  });
}

/**
 * Find a leave entry that overlaps a specific day.  Returns the earliest
 * overlapping leave or null.
 */
export async function findLeaveOnDate(
  employeeId: string,
  dayStartUtc: Date,
  dayEndUtc: Date
) {
  return prisma.employeeLeave.findFirst({
    where: {
      employeeId,
      dateFrom: { lte: dayEndUtc },
      dateTo: { gte: dayStartUtc },
    },
    orderBy: { dateFrom: "asc" },
  });
}

/**
 * Find any leave entry that overlaps the provided [newFromUtc, newToUtc] window.
 * Overlap definition (inclusive):
 *   existing.dateFrom <= newToUtc AND existing.dateTo >= newFromUtc
 * Returns the earliest overlapping leave or null.
 */
export async function findLeaveOverlap(
  employeeId: string,
  newFromUtc: Date,
  newToUtc: Date
) {
  return prisma.employeeLeave.findFirst({
    where: {
      employeeId,
      dateFrom: { lte: newToUtc },
      dateTo: { gte: newFromUtc },
    },
    orderBy: { dateFrom: "asc" },
  });
}

/**
 * Delete a leave entry belonging to an employee. Throws if not found
 * or mismatched employee.
 */
export async function deleteEmployeeLeave(
  employeeId: string,
  leaveId: string
) {
  // Verify ownership
  const leave = await prisma.employeeLeave.findUnique({
    where: { id: leaveId },
    select: { id: true, employeeId: true },
  });
  if (!leave || leave.employeeId !== employeeId) {
    throw new Error("leave_not_found");
  }
  return prisma.employeeLeave.delete({ where: { id: leaveId } });
}