import { prisma } from "@/src/repositories/prisma";
import type { Employee, Prisma } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";

type SetClassificationInput = {
  employeeId: string;
  employeeGroupId?: string | null;
  employeeSubgroupId?: string | null;
};

type ClassificationListFilters = {
  q?: string;
  branchId?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
  assignmentStatus?: "all" | "assigned" | "unassigned";
};

function normalizeOptionalId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  return s || null;
}

async function resolveValidatedClassification(input: {
  companyId: string;
  employeeGroupId?: string | null;
  employeeSubgroupId?: string | null;
}) {
  const employeeGroupId = normalizeOptionalId(input.employeeGroupId);
  const employeeSubgroupId = normalizeOptionalId(input.employeeSubgroupId);

  let resolvedGroupIdFromSubgroup: string | null = null;
  if (employeeSubgroupId) {
    const sg = await prisma.employeeSubgroup.findFirst({
      where: { id: employeeSubgroupId, companyId: input.companyId },
      select: { id: true, groupId: true },
    });
    if (!sg) throw new Error("SUBGROUP_NOT_FOUND");
    resolvedGroupIdFromSubgroup = sg.groupId;
  }

  if (employeeGroupId) {
    const g = await prisma.employeeGroup.findFirst({
      where: { id: employeeGroupId, companyId: input.companyId },
      select: { id: true },
    });
    if (!g) throw new Error("GROUP_NOT_FOUND");
  }

  // IMPORTANT:
  // undefined => caller did not send group field, do not patch group
  // null      => caller explicitly wants to clear group
  // string    => caller explicitly wants to set group
  //
  // So we must preserve explicit null here.
  let finalGroupId: string | null | undefined =
    employeeGroupId === undefined ? undefined : employeeGroupId;
  if (resolvedGroupIdFromSubgroup) {
    if (employeeGroupId && employeeGroupId !== resolvedGroupIdFromSubgroup) {
      throw new Error("SUBGROUP_GROUP_MISMATCH");
    }
    finalGroupId = resolvedGroupIdFromSubgroup;
  }

  return {
    employeeGroupId,
    employeeSubgroupId,
    finalGroupId,
  };
}

function buildEmployeeClassificationPatch(input: {
  finalGroupId?: string | null;
  employeeSubgroupId?: string | null;
}) {
  const patch: Record<string, string | null> = {};
  if (input.finalGroupId !== undefined) patch.employeeGroupId = input.finalGroupId ?? null;
  if (input.employeeSubgroupId !== undefined) patch.employeeSubgroupId = input.employeeSubgroupId ?? null;
  return patch;
}

function buildEmployeeClassificationWhere(input: {
  companyId: string;
  q?: string;
  branchId?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
  assignmentStatus?: "all" | "assigned" | "unassigned";
  scopeWhere?: Prisma.EmployeeWhereInput | null;
}) {
  const q = String(input.q ?? "").trim();
  const branchId = normalizeOptionalId(input.branchId);
  const groupId = normalizeOptionalId(input.groupId);
  const subgroupId = normalizeOptionalId(input.subgroupId);
  const assignmentStatus = input.assignmentStatus ?? "all";

  const and: Prisma.EmployeeWhereInput[] = [{ companyId: input.companyId, isActive: true }];
  if (input.scopeWhere) and.push(input.scopeWhere);

  if (q) {
    and.push({
      OR: [
        { employeeCode: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { branch: { code: { contains: q, mode: "insensitive" } } },
        { branch: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (branchId) and.push({ branchId });
  if (groupId) and.push({ employeeGroupId: groupId });
  if (subgroupId) and.push({ employeeSubgroupId: subgroupId });

  if (assignmentStatus === "assigned") {
    and.push({
      OR: [{ employeeGroupId: { not: null } }, { employeeSubgroupId: { not: null } }],
    });
  } else if (assignmentStatus === "unassigned") {
    and.push({
      employeeGroupId: null,
      employeeSubgroupId: null,
    });
  }

  return and.length === 1 ? and[0] : { AND: and };
}

async function applyClassificationPatchToEmployees(input: {
  companyId: string;
  employees: Array<Pick<Employee, "id" | "employeeGroupId" | "employeeSubgroupId">>;
  patch: Record<string, string | null>;
}) {
  const changedEmployees = input.employees.filter((e) => {
    const nextGroupId = Object.prototype.hasOwnProperty.call(input.patch, "employeeGroupId")
      ? (input.patch.employeeGroupId ?? null)
      : e.employeeGroupId;
    const nextSubgroupId = Object.prototype.hasOwnProperty.call(input.patch, "employeeSubgroupId")
      ? (input.patch.employeeSubgroupId ?? null)
      : e.employeeSubgroupId;
    return e.employeeGroupId !== nextGroupId || e.employeeSubgroupId !== nextSubgroupId;
  });

  const noChangeEmployees = input.employees.filter((e) => !changedEmployees.some((x) => x.id === e.id));

  if (changedEmployees.length > 0) {
    await prisma.$transaction(
      changedEmployees.map((e) =>
        prisma.employee.update({
          where: { id: e.id, companyId: input.companyId } as any,
          data: input.patch,
        })
      )
    );
  }

  return { changedEmployees, noChangeEmployees };
}

export async function setEmployeeClassification(input: SetClassificationInput) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(input.employeeId ?? "").trim();
  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");

  const resolved = await resolveValidatedClassification({
    companyId,
    employeeGroupId: input.employeeGroupId,
    employeeSubgroupId: input.employeeSubgroupId,
  });
  const patch = buildEmployeeClassificationPatch(resolved);

  const before = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      employeeCode: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });
  if (!before) throw new Error("EMPLOYEE_NOT_FOUND");

  const item = await prisma.employee.update({
    where: { id: employeeId, companyId } as any,
    data: patch,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  const changed =
    before.employeeGroupId !== item.employeeGroupId ||
    before.employeeSubgroupId !== item.employeeSubgroupId;

  return {
    item,
    before,
    changed,
  };
}

export async function listEmployeesWithClassification(input?: {
  q?: string;
  branchId?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
  assignmentStatus?: "all" | "assigned" | "unassigned";
  page?: number;
  pageSize?: number;
  scopeWhere?: Prisma.EmployeeWhereInput | null;
}) {
  const companyId = await getActiveCompanyId();

  const page = Number.isFinite(input?.page) ? Math.max(1, Number(input?.page)) : 1;
  const pageSizeRaw = Number.isFinite(input?.pageSize) ? Number(input?.pageSize) : 50;
  const pageSize = Math.min(200, Math.max(10, pageSizeRaw));
  const skip = (page - 1) * pageSize;

  const where = buildEmployeeClassificationWhere({
    companyId,
    q: input?.q,
    branchId: input?.branchId,
    groupId: input?.groupId,
    subgroupId: input?.subgroupId,
    assignmentStatus: input?.assignmentStatus,
    scopeWhere: input?.scopeWhere,
  });

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ employeeCode: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        branchId: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
        employeeGroup: { select: { id: true, code: true, name: true } },
        employeeSubgroup: { select: { id: true, code: true, name: true, groupId: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function bulkSetEmployeeClassificationByFilter(input: ClassificationListFilters & {
  scopeWhere?: Prisma.EmployeeWhereInput | null;
  employeeGroupId?: string | null;
  employeeSubgroupId?: string | null;
}) {
  const companyId = await getActiveCompanyId();

  const resolved = await resolveValidatedClassification({
    companyId,
    employeeGroupId: input.employeeGroupId,
    employeeSubgroupId: input.employeeSubgroupId,
  });
  const patch = buildEmployeeClassificationPatch(resolved);

  const where = buildEmployeeClassificationWhere({
    companyId,
    q: input.q,
    branchId: input.branchId,
    groupId: input.groupId,
    subgroupId: input.subgroupId,
    assignmentStatus: input.assignmentStatus,
    scopeWhere: input.scopeWhere,
  });

  const totalMatched = await prisma.employee.count({ where });
  if (totalMatched > 5000) throw new Error("TOO_MANY_EMPLOYEES");

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ employeeCode: "asc" }],
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  const { changedEmployees, noChangeEmployees } = await applyClassificationPatchToEmployees({
    companyId,
    employees,
    patch,
  });

  return {
    summary: {
      requested: totalMatched,
      found: employees.length,
      updated: changedEmployees.length,
      unchanged: noChangeEmployees.length,
      missing: 0,
    },
    changedEmployeeIds: changedEmployees.map((e) => e.id),
    missingEmployeeIds: [] as string[],
    unchangedEmployeeIds: noChangeEmployees.map((e) => e.id),
  };
}

export async function bulkSetEmployeeClassification(input: {
  employeeIds: string[];
  employeeGroupId?: string | null;
  employeeSubgroupId?: string | null;
}) {
  const companyId = await getActiveCompanyId();
  const employeeIds = Array.from(new Set((input.employeeIds ?? []).map((x) => String(x ?? "").trim()).filter(Boolean)));
  if (employeeIds.length === 0) throw new Error("EMPLOYEE_IDS_REQUIRED");
  if (employeeIds.length > 5000) throw new Error("TOO_MANY_EMPLOYEES");

  const resolved = await resolveValidatedClassification({
    companyId,
    employeeGroupId: input.employeeGroupId,
    employeeSubgroupId: input.employeeSubgroupId,
  });
  const patch = buildEmployeeClassificationPatch(resolved);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      id: { in: employeeIds },
      isActive: true,
    },
    orderBy: [{ employeeCode: "asc" }],
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });
  const foundIdSet = new Set(employees.map((e) => e.id));
  const missingEmployeeIds = employeeIds.filter((id) => !foundIdSet.has(id));

  const { changedEmployees, noChangeEmployees } = await applyClassificationPatchToEmployees({
    companyId,
    employees,
    patch,
  });

  return {
    summary: {
      requested: employeeIds.length,
      found: employees.length,
      updated: changedEmployees.length,
      unchanged: noChangeEmployees.length,
      missing: missingEmployeeIds.length,
    },
    changedEmployeeIds: changedEmployees.map((e) => e.id),
    missingEmployeeIds,
    unchangedEmployeeIds: noChangeEmployees.map((e) => e.id),
  };
}