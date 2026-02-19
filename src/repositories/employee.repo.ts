import { prisma } from "@/src/repositories/prisma";

export async function hardDeleteEmployeeRepo(companyId: string, employeeId: string) {
  return prisma.$transaction(async (tx) => {
    // 0) Employment periods + HR actions
    await tx.employeeEmploymentPeriod.deleteMany({ where: { companyId, employeeId } });
    await tx.employeeAction.deleteMany({ where: { companyId, employeeId } });
    // 1) Attendance kayıtları
    await tx.dailyAttendance.deleteMany({
      where: { companyId, employeeId },
    });

    // 2) Normalized (RawEvent'e FK varsa önce bunu silmek gerekir)
    await tx.normalizedEvent.deleteMany({
      where: { companyId, employeeId },
    });

    // 3) Raw events
    await tx.rawEvent.deleteMany({
      where: { companyId, employeeId },
    });

    // 4) Employee
    await tx.employee.deleteMany({
      where: { id: employeeId, companyId },
    });

    return { ok: true };
  });
}

export type CreateEmployeeInput = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  isActive?: boolean;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export async function listEmployeesRepo(companyId: string, opts?: { includeInactive?: boolean }) {
  const includeInactive = opts?.includeInactive ?? false;

  return prisma.employee.findMany({
    where: {
      companyId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ employeeCode: "asc" }],
  });
}

export async function createEmployeeRepo(companyId: string, input: CreateEmployeeInput) {
  return prisma.employee.create({
    data: {
      companyId,
      employeeCode: input.employeeCode.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.trim() || null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateEmployeeRepo(companyId: string, id: string, input: UpdateEmployeeInput) {
  await prisma.employee.updateMany({
    where: { id, companyId },
    data: {
      ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode.trim() } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  const updated = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!updated) throw new Error("EMPLOYEE_NOT_FOUND");
  return updated;
}

export async function deactivateEmployeeRepo(companyId: string, id: string) {
  // Soft delete: isActive=false
  return updateEmployeeRepo(companyId, id, { isActive: false });
}
