import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

type WorkScheduleDbClient = Prisma.TransactionClient | typeof prisma;
export type WorkScheduleMutationTx = Prisma.TransactionClient;

const patternInclude = {
  days: { orderBy: { dayIndex: "asc" as const } },
};

const assignmentInclude = {
  pattern: true,
  employeeGroup: true,
  employeeSubgroup: true,
  branch: true,
  employee: true,
};

async function findWorkSchedulePatternByIdWithDb(db: WorkScheduleDbClient, companyId: string, id: string) {
  return db.workSchedulePattern.findFirst({
    where: { companyId, id },
    include: patternInclude,
  });
}

async function findWorkSchedulePatternByCodeWithDb(db: WorkScheduleDbClient, companyId: string, code: string) {
  return db.workSchedulePattern.findFirst({
    where: { companyId, code },
    include: patternInclude,
  });
}

async function findWorkSchedulePatternByNameWithDb(db: WorkScheduleDbClient, companyId: string, name: string) {
  return db.workSchedulePattern.findFirst({
    where: {
      companyId,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    include: patternInclude,
  });
}

async function createWorkSchedulePatternWithDb(
  db: WorkScheduleDbClient,
  input: {
    companyId: string;
    code: string;
    name: string;
    cycleLengthDays: number;
    referenceDate: Date;
    dayShiftTemplateIds: Array<string | null>;
    isActive?: boolean;
  }
) {
  const now = new Date();
  const pattern = await db.workSchedulePattern.create({
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      cycleLengthDays: input.cycleLengthDays,
      referenceDate: input.referenceDate,
      dayShiftTemplateIds: (input.dayShiftTemplateIds ?? []).map((x) => String(x ?? "").trim()),
      isActive: input.isActive ?? true,
    },
  });

  await db.workSchedulePatternDay.createMany({
    data: (input.dayShiftTemplateIds ?? []).map((raw, dayIndex) => {
      const v = String(raw ?? "").trim();
      return {
        companyId: input.companyId,
        patternId: pattern.id,
        dayIndex,
        shiftTemplateId: v ? v : null,
        createdAt: now,
        updatedAt: now,
      };
    }),
  });

    return db.workSchedulePattern.findFirstOrThrow({
    where: { companyId: input.companyId, id: pattern.id },
    include: patternInclude,
  });
}

async function updateWorkSchedulePatternWithDb(
  db: WorkScheduleDbClient,
  input: {
    companyId: string;
    id: string;
    code?: string;
    name?: string;
    cycleLengthDays?: number;
    referenceDate?: Date;
    dayShiftTemplateIds?: Array<string | null>;
    isActive?: boolean;
  }
) {
  const now = new Date();
  const updated = await db.workSchedulePattern.update({
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
    await db.workSchedulePatternDay.deleteMany({
      where: { companyId: input.companyId, patternId: input.id },
    });
    await db.workSchedulePatternDay.createMany({
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

    return db.workSchedulePattern.findFirstOrThrow({
    where: { companyId: input.companyId, id: updated.id },
    include: patternInclude,
  });
}

async function findWorkScheduleAssignmentsByIdsWithDb(db: WorkScheduleDbClient, companyId: string, ids: string[]) {
  if (!ids.length) return [];
  return db.workScheduleAssignment.findMany({
    where: {
      companyId,
      id: { in: ids },
    },
    include: assignmentInclude,
  });
}

export async function listWorkSchedulePatterns(companyId: string) {
  return prisma.workSchedulePattern.findMany({
    where: { companyId },
    include: patternInclude,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function findWorkSchedulePatternById(companyId: string, id: string) {
  return findWorkSchedulePatternByIdWithDb(prisma, companyId, id);
}

export async function findWorkSchedulePatternByIdInTx(tx: WorkScheduleMutationTx, companyId: string, id: string) {
  return findWorkSchedulePatternByIdWithDb(tx, companyId, id);
}

export async function findWorkSchedulePatternByCode(companyId: string, code: string) {
  return findWorkSchedulePatternByCodeWithDb(prisma, companyId, code);
}

export async function findWorkSchedulePatternByCodeInTx(tx: WorkScheduleMutationTx, companyId: string, code: string) {
  return findWorkSchedulePatternByCodeWithDb(tx, companyId, code);
}

export async function findWorkSchedulePatternByName(companyId: string, name: string) {
  return findWorkSchedulePatternByNameWithDb(prisma, companyId, name);
}

export async function findWorkSchedulePatternByNameInTx(tx: WorkScheduleMutationTx, companyId: string, name: string) {
  return findWorkSchedulePatternByNameWithDb(tx, companyId, name);
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
  return prisma.$transaction(async (tx) => createWorkSchedulePatternWithDb(tx, input));
}

export async function createWorkSchedulePatternInTx(
  tx: WorkScheduleMutationTx,
  input: {
    companyId: string;
    code: string;
    name: string;
    cycleLengthDays: number;
    referenceDate: Date;
    dayShiftTemplateIds: Array<string | null>;
    isActive?: boolean;
  }
) {
  return createWorkSchedulePatternWithDb(tx, input);
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
  return prisma.$transaction(async (tx) => updateWorkSchedulePatternWithDb(tx, input));
}

    export async function updateWorkSchedulePatternInTx(
  tx: WorkScheduleMutationTx,
  input: {
    companyId: string;
    id: string;
    code?: string;
    name?: string;
    cycleLengthDays?: number;
    referenceDate?: Date;
    dayShiftTemplateIds?: Array<string | null>;
    isActive?: boolean;
  }
) {
  return updateWorkSchedulePatternWithDb(tx, input);
}

export async function deleteWorkSchedulePattern(companyId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.workSchedulePattern.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        code: true,
        name: true,
        cycleLengthDays: true,
        referenceDate: true,
        isActive: true,
        _count: {
          select: {
            days: true,
            assignments: true,
          },
        },
      },
    });
    if (!current) return null;

    await tx.workSchedulePattern.delete({ where: { id } });

    return {
      id: current.id,
      code: current.code,
      name: current.name,
      cycleLengthDays: current.cycleLengthDays,
      referenceDate: current.referenceDate,
      isActive: current.isActive,
      deletedDayCount: current._count.days,
      deletedAssignmentCount: current._count.assignments,
    };
  });
}

export async function listWorkScheduleAssignments(companyId: string) {
  return prisma.workScheduleAssignment.findMany({
    where: { companyId },
    include: assignmentInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function findWorkScheduleAssignmentsByIds(companyId: string, ids: string[]) {
  return findWorkScheduleAssignmentsByIdsWithDb(prisma, companyId, ids);
}

export async function findWorkScheduleAssignmentsByIdsInTx(
  tx: WorkScheduleMutationTx,
  companyId: string,
  ids: string[]
) {
  return findWorkScheduleAssignmentsByIdsWithDb(tx, companyId, ids);
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

export async function createWorkScheduleAssignmentsInTx(
  tx: WorkScheduleMutationTx,
  input: {
    companyId: string;
    items: Array<{
      scope: any;
      priority?: number;
      validFrom?: Date | null;
      validTo?: Date | null;
      patternId: string;
      employeeId?: string | null;
      employeeSubgroupId?: string | null;
      employeeGroupId?: string | null;
      branchId?: string | null;
    }>;
  }
) {
  if (!input.items.length) return 0;
  const created = await tx.workScheduleAssignment.createMany({
    data: input.items.map((item) => ({
      companyId: input.companyId,
      scope: item.scope,
      priority: item.priority ?? 0,
      validFrom: item.validFrom ?? null,
      validTo: item.validTo ?? null,
      patternId: item.patternId,
      employeeId: item.employeeId ?? null,
      employeeSubgroupId: item.employeeSubgroupId ?? null,
      employeeGroupId: item.employeeGroupId ?? null,
      branchId: item.branchId ?? null,
    })),
  });
  return created.count;
}

export async function deleteWorkScheduleAssignment(companyId: string, id: string) {
  return prisma.workScheduleAssignment.deleteMany({ where: { companyId, id } });
}

export async function deleteWorkScheduleAssignmentsByIdsInTx(
  tx: WorkScheduleMutationTx,
  companyId: string,
  ids: string[]
) {
  if (!ids.length) return 0;
  const deleted = await tx.workScheduleAssignment.deleteMany({
    where: {
      companyId,
      id: { in: ids },
    },
  });
  return deleted.count;
}