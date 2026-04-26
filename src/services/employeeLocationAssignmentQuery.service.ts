import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export type LocationAssignmentEmploymentStatus = "all" | "active" | "passive";

export type LocationAssignmentFilters = {
  q?: string;
  branchId?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
  employmentStatus?: LocationAssignmentEmploymentStatus;
};

export type LocationAssignmentTargetMode = "selected" | "filter";

export type LocationAssignmentEmployeeListItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  branch: { id: string; code: string; name: string } | null;
  employeeGroup: { id: string; code: string; name: string } | null;
  employeeSubgroup: { id: string; code: string; name: string; groupId: string } | null;
};

export type LocationAssignmentTargetEmployee = LocationAssignmentEmployeeListItem & {
  effectiveBranchId: string | null;
  isEmployedOnEffectiveDate: boolean;
};

export type ResolvedLocationAssignmentTargetEmployees = {
  requested: number;
  items: LocationAssignmentTargetEmployee[];
  missingEmployeeIds: string[];
};

export type LocationAssignmentPreviewRejectedItem = {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  code: "EMPLOYEE_NOT_FOUND" | "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE";
  message: string;
};

export type LocationAssignmentPreviewChangedItem = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  effectiveBranchId: string | null;
};

export type BulkLocationAssignmentPreview = {
  summary: {
    requested: number;
    found: number;
    changed: number;
    unchanged: number;
    rejected: number;
  };
  changedEmployeeIds: string[];
  unchangedEmployeeIds: string[];
  rejectedEmployees: LocationAssignmentPreviewRejectedItem[];
  changedEmployeesPreview: LocationAssignmentPreviewChangedItem[];
  unchangedEmployeesPreview: LocationAssignmentPreviewChangedItem[];
};

function normalizeOptionalId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeQ(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueIds(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

function fullNameOf(item: Pick<LocationAssignmentEmployeeListItem, "firstName" | "lastName">): string {
  return `${item.firstName} ${item.lastName}`.trim();
}

function buildLocationAssignmentEmployeeWhere(input: {
  companyId: string;
  filters?: LocationAssignmentFilters | null;
  effectiveDayKey: string;
  scopeWhere?: Prisma.EmployeeWhereInput | null;
}): Prisma.EmployeeWhereInput {
  const q = normalizeQ(input.filters?.q);
  const branchId = normalizeOptionalId(input.filters?.branchId);
  const groupId = normalizeOptionalId(input.filters?.groupId);
  const subgroupId = normalizeOptionalId(input.filters?.subgroupId);
  const employmentStatusRaw = String(input.filters?.employmentStatus ?? "all").trim().toLowerCase();
  const employmentStatus: LocationAssignmentEmploymentStatus =
    employmentStatusRaw === "active" || employmentStatusRaw === "passive" ? employmentStatusRaw : "all";
  const effectiveDb = dbDateFromDayKey(input.effectiveDayKey);

  const and: Prisma.EmployeeWhereInput[] = [{ companyId: input.companyId, isActive: true }];
  if (input.scopeWhere) and.push(input.scopeWhere);

  if (q) {
    and.push({
      OR: [
        { employeeCode: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { branch: { code: { contains: q, mode: "insensitive" } } },
        { branch: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (branchId) and.push({ branchId });
  if (groupId) and.push({ employeeGroupId: groupId });
  if (subgroupId) and.push({ employeeSubgroupId: subgroupId });

  if (employmentStatus === "active") {
    and.push({
      employmentPeriods: {
        some: {
          startDate: { lte: effectiveDb },
          OR: [{ endDate: null }, { endDate: { gte: effectiveDb } }],
        },
      },
    });
  } else if (employmentStatus === "passive") {
    and.push({
      employmentPeriods: {
        none: {
          startDate: { lte: effectiveDb },
          OR: [{ endDate: null }, { endDate: { gte: effectiveDb } }],
        },
      },
    });
  }

  return and.length === 1 ? and[0] : { AND: and };
}

async function loadEffectiveBranchIdsByEmployee(input: {
  companyId: string;
  employeeIds: string[];
  effectiveDayKey: string;
}): Promise<Map<string, string | null>> {
  if (input.employeeIds.length === 0) return new Map<string, string | null>();

  const effectiveDb = dbDateFromDayKey(input.effectiveDayKey);
  const rows = await prisma.employeeOrgAssignment.findMany({
    where: {
      companyId: input.companyId,
      employeeId: { in: input.employeeIds },
      AND: [
        { validFrom: { lte: effectiveDb } },
        { OR: [{ validTo: null }, { validTo: { gte: effectiveDb } }] },
      ],
    },
    orderBy: [{ employeeId: "asc" }, { validFrom: "desc" }, { createdAt: "desc" }],
    select: {
      employeeId: true,
      branchId: true,
    },
  });

  const map = new Map<string, string | null>();
  for (const row of rows) {
    if (!map.has(row.employeeId)) {
      map.set(row.employeeId, row.branchId ?? null);
    }
  }

  return map;
}

async function loadEmployeesByIds(input: {
  companyId: string;
  employeeIds: string[];
  scopeWhere?: Prisma.EmployeeWhereInput | null;
  effectiveDayKey: string;
}): Promise<{ items: LocationAssignmentTargetEmployee[]; missingEmployeeIds: string[] }> {
  const employeeIds = uniqueIds(input.employeeIds);
  if (employeeIds.length === 0) return { items: [], missingEmployeeIds: [] };

  const effectiveDb = dbDateFromDayKey(input.effectiveDayKey);
  const where: Prisma.EmployeeWhereInput = input.scopeWhere
    ? { companyId: input.companyId, isActive: true, id: { in: employeeIds }, AND: [input.scopeWhere] }
    : { companyId: input.companyId, isActive: true, id: { in: employeeIds } };

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
      branch: { select: { id: true, code: true, name: true } },
      employeeGroup: { select: { id: true, code: true, name: true } },
      employeeSubgroup: { select: { id: true, code: true, name: true, groupId: true } },
      employmentPeriods: {
        where: {
          startDate: { lte: effectiveDb },
          OR: [{ endDate: null }, { endDate: { gte: effectiveDb } }],
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  const effectiveBranchByEmployeeId = await loadEffectiveBranchIdsByEmployee({
    companyId: input.companyId,
    employeeIds: employees.map((employee) => employee.id),
    effectiveDayKey: input.effectiveDayKey,
  });

  const foundIdSet = new Set(employees.map((employee) => employee.id));
  const items: LocationAssignmentTargetEmployee[] = employees.map((employee) => ({
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: fullNameOf(employee),
    branchId: employee.branchId ?? null,
    employeeGroupId: employee.employeeGroupId ?? null,
    employeeSubgroupId: employee.employeeSubgroupId ?? null,
    branch: employee.branch ?? null,
    employeeGroup: employee.employeeGroup ?? null,
    employeeSubgroup: employee.employeeSubgroup ?? null,
    effectiveBranchId: effectiveBranchByEmployeeId.has(employee.id)
      ? effectiveBranchByEmployeeId.get(employee.id) ?? null
      : employee.branchId ?? null,
    isEmployedOnEffectiveDate: employee.employmentPeriods.length > 0,
  }));

  return {
    items,
    missingEmployeeIds: employeeIds.filter((employeeId) => !foundIdSet.has(employeeId)),
  };
}

export async function listEmployeesForLocationAssignment(input: {
  companyId: string;
  page?: number;
  pageSize?: number;
  filters?: LocationAssignmentFilters | null;
  scopeWhere?: Prisma.EmployeeWhereInput | null;
  effectiveDayKey: string;
}) {
  const page = Number.isFinite(input.page) ? Math.max(1, Number(input.page)) : 1;
  const pageSizeRaw = Number.isFinite(input.pageSize) ? Number(input.pageSize) : 50;
  const pageSize = Math.min(200, Math.max(10, pageSizeRaw));
  const skip = (page - 1) * pageSize;

  const where = buildLocationAssignmentEmployeeWhere({
    companyId: input.companyId,
    filters: input.filters,
    effectiveDayKey: input.effectiveDayKey,
    scopeWhere: input.scopeWhere,
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
        branch: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, code: true, name: true } },
        employeeSubgroup: { select: { id: true, code: true, name: true, groupId: true } },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      fullName: fullNameOf(item),
      branchId: item.branchId ?? null,
      employeeGroupId: item.employeeGroupId ?? null,
      employeeSubgroupId: item.employeeSubgroupId ?? null,
      branch: item.branch ?? null,
      employeeGroup: item.employeeGroup ?? null,
      employeeSubgroup: item.employeeSubgroup ?? null,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function resolveEmployeesForLocationAssignmentTarget(input: {
  companyId: string;
  targetMode: LocationAssignmentTargetMode;
  effectiveDayKey: string;
  employeeIds?: string[];
  filters?: LocationAssignmentFilters | null;
  scopeWhere?: Prisma.EmployeeWhereInput | null;
  maxEmployees?: number;
}): Promise<ResolvedLocationAssignmentTargetEmployees> {
  const maxEmployees = Math.min(10000, Math.max(1, input.maxEmployees ?? 5000));

  if (input.targetMode === "selected") {
    const requestedIds = uniqueIds(input.employeeIds ?? []);
    const loaded = await loadEmployeesByIds({
      companyId: input.companyId,
      employeeIds: requestedIds,
      scopeWhere: input.scopeWhere,
      effectiveDayKey: input.effectiveDayKey,
    });

    return {
      requested: requestedIds.length,
      items: loaded.items,
      missingEmployeeIds: loaded.missingEmployeeIds,
    };
  }

  const where = buildLocationAssignmentEmployeeWhere({
    companyId: input.companyId,
    filters: input.filters,
    effectiveDayKey: input.effectiveDayKey,
    scopeWhere: input.scopeWhere,
  });

  const totalMatched = await prisma.employee.count({ where });
  if (totalMatched > maxEmployees) {
    throw new Error("TOO_MANY_EMPLOYEES");
  }

  const filteredEmployees = await prisma.employee.findMany({
    where,
    orderBy: [{ employeeCode: "asc" }],
    select: { id: true },
  });

  const loaded = await loadEmployeesByIds({
    companyId: input.companyId,
    employeeIds: filteredEmployees.map((item) => item.id),
    scopeWhere: input.scopeWhere,
    effectiveDayKey: input.effectiveDayKey,
  });

  return {
    requested: totalMatched,
    items: loaded.items,
    missingEmployeeIds: loaded.missingEmployeeIds,
  };
}

export async function previewBulkEmployeeLocationAssignment(input: {
  companyId: string;
  targetMode: LocationAssignmentTargetMode;
  effectiveDayKey: string;
  targetBranchId: string | null;
  employeeIds?: string[];
  filters?: LocationAssignmentFilters | null;
  scopeWhere?: Prisma.EmployeeWhereInput | null;
  maxEmployees?: number;
}): Promise<BulkLocationAssignmentPreview> {
  const resolved = await resolveEmployeesForLocationAssignmentTarget({
    companyId: input.companyId,
    targetMode: input.targetMode,
    effectiveDayKey: input.effectiveDayKey,
    employeeIds: input.employeeIds,
    filters: input.filters,
    scopeWhere: input.scopeWhere,
    maxEmployees: input.maxEmployees,
  });

  const changedEmployees: LocationAssignmentPreviewChangedItem[] = [];
  const unchangedEmployees: LocationAssignmentPreviewChangedItem[] = [];
  const rejectedEmployees: LocationAssignmentPreviewRejectedItem[] = resolved.missingEmployeeIds.map((employeeId) => ({
    employeeId,
    employeeCode: null,
    fullName: "",
    code: "EMPLOYEE_NOT_FOUND",
    message: "Personel bulunamadı.",
  }));

  for (const employee of resolved.items) {
    if (!employee.isEmployedOnEffectiveDate) {
      rejectedEmployees.push({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        code: "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE",
        message: "Personel belirtilen etkili tarihte istihdam kapsamında değil.",
      });
      continue;
    }

    const item: LocationAssignmentPreviewChangedItem = {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      effectiveBranchId: employee.effectiveBranchId,
    };

    if ((employee.effectiveBranchId ?? null) === (input.targetBranchId ?? null)) {
      unchangedEmployees.push(item);
    } else {
      changedEmployees.push(item);
    }
  }

  return {
    summary: {
      requested: resolved.requested,
      found: resolved.items.length,
      changed: changedEmployees.length,
      unchanged: unchangedEmployees.length,
      rejected: rejectedEmployees.length,
    },
    changedEmployeeIds: changedEmployees.map((item) => item.employeeId),
    unchangedEmployeeIds: unchangedEmployees.map((item) => item.employeeId),
    rejectedEmployees,
    changedEmployeesPreview: changedEmployees.slice(0, 100),
    unchangedEmployeesPreview: unchangedEmployees.slice(0, 100),
  };
}