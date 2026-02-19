import { prisma } from "@/src/repositories/prisma";

export async function listWorkSchedulePatterns(companyId: string) {
  return prisma.workSchedulePattern.findMany({
    where: { companyId },
    include: { days: { orderBy: { dayIndex: "asc" } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function findWorkSchedulePatternById(companyId: string, id: string) {
  return prisma.workSchedulePattern.findFirst({
    where: { companyId, id },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
}

export async function findWorkSchedulePatternByCode(companyId: string, code: string) {
  return prisma.workSchedulePattern.findFirst({
    where: { companyId, code },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
}

export async function createWorkSchedulePattern(input: {
  companyId: string;
  code: string;
  name: string;
  cycleLengthDays: number;
  referenceDate: Date;
  dayShiftTemplateIds: Array<string | null>;
  isActive?: boolean;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const pattern = await tx.workSchedulePattern.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        cycleLengthDays: input.cycleLengthDays,
        referenceDate: input.referenceDate,
        // Legacy: empty string means OFF (kept for backward compatibility)
        dayShiftTemplateIds: (input.dayShiftTemplateIds ?? []).map((x) => String(x ?? "").trim()),
        isActive: input.isActive ?? true,
      },
    });

    await tx.workSchedulePatternDay.createMany({
      data: (input.dayShiftTemplateIds ?? []).map((raw, dayIndex) => {
        const v = String(raw ?? "").trim();
        return {
          companyId: input.companyId,
          patternId: pattern.id,
          dayIndex,
          shiftTemplateId: v ? v : null, // NULL => OFF
          createdAt: now,
          updatedAt: now,
        };
      }),
    });

    return tx.workSchedulePattern.findFirstOrThrow({
      where: { companyId: input.companyId, id: pattern.id },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    });
  });
}

export async function updateWorkSchedulePattern(input: {
  companyId: string;
  id: string;
  code?: string;
  name?: string;
  cycleLengthDays?: number;
  referenceDate?: Date;
  dayShiftTemplateIds?: Array<string | null>;
  isActive?: boolean;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workSchedulePattern.update({
      where: { id: input.id },
      data: {
        companyId: input.companyId,
        ...(input.code != null ? { code: input.code } : {}),
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.cycleLengthDays != null ? { cycleLengthDays: input.cycleLengthDays } : {}),
        ...(input.referenceDate != null ? { referenceDate: input.referenceDate } : {}),
        ...(input.dayShiftTemplateIds != null
          ? { dayShiftTemplateIds: input.dayShiftTemplateIds.map((x) => String(x ?? "").trim()) }
          : {}),
        ...(input.isActive != null ? { isActive: input.isActive } : {}),
      },
    });

    if (input.dayShiftTemplateIds != null) {
      await tx.workSchedulePatternDay.deleteMany({
        where: { companyId: input.companyId, patternId: input.id },
      });
      await tx.workSchedulePatternDay.createMany({
        data: input.dayShiftTemplateIds.map((raw, dayIndex) => {
          const v = String(raw ?? "").trim();
          return {
            companyId: input.companyId,
            patternId: input.id,
            dayIndex,
            shiftTemplateId: v ? v : null,
            createdAt: now,
            updatedAt: now,
          };
        }),
      });
    }

    return tx.workSchedulePattern.findFirstOrThrow({
      where: { companyId: input.companyId, id: updated.id },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    });
  });
}

export async function listWorkScheduleAssignments(companyId: string) {
  return prisma.workScheduleAssignment.findMany({
    where: { companyId },
    include: { pattern: true, employeeGroup: true, employeeSubgroup: true, branch: true, employee: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createWorkScheduleAssignment(input: {
  companyId: string;
  scope: any;
  priority?: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  patternId: string;
  employeeId?: string | null;
  employeeSubgroupId?: string | null;
  employeeGroupId?: string | null;
  branchId?: string | null;
}) {
  return prisma.workScheduleAssignment.create({
    data: {
      companyId: input.companyId,
      scope: input.scope,
      priority: input.priority ?? 0,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      patternId: input.patternId,
      employeeId: input.employeeId ?? null,
      employeeSubgroupId: input.employeeSubgroupId ?? null,
      employeeGroupId: input.employeeGroupId ?? null,
      branchId: input.branchId ?? null,
    },
  });
}

export async function deleteWorkScheduleAssignment(companyId: string, id: string) {
  return prisma.workScheduleAssignment.deleteMany({ where: { companyId, id } });
}