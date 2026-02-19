import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function setEmployeeClassification(input: {
  employeeId: string;
  employeeGroupId?: string | null;
  employeeSubgroupId?: string | null;
}) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(input.employeeId ?? "").trim();
  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");

  const employeeGroupId =
    input.employeeGroupId === undefined ? undefined : input.employeeGroupId ? String(input.employeeGroupId).trim() : null;

  const employeeSubgroupId =
    input.employeeSubgroupId === undefined ? undefined : input.employeeSubgroupId ? String(input.employeeSubgroupId).trim() : null;

  // If subgroup provided, it must belong to company and (if group is provided) must match it.
  let resolvedGroupIdFromSubgroup: string | null = null;
  if (employeeSubgroupId) {
    const sg = await prisma.employeeSubgroup.findFirst({
      where: { id: employeeSubgroupId, companyId },
      select: { id: true, groupId: true },
    });
    if (!sg) throw new Error("SUBGROUP_NOT_FOUND");
    resolvedGroupIdFromSubgroup = sg.groupId;
  }

  if (employeeGroupId) {
    const g = await prisma.employeeGroup.findFirst({
      where: { id: employeeGroupId, companyId },
      select: { id: true },
    });
    if (!g) throw new Error("GROUP_NOT_FOUND");
  }

  // Enforce: subgroup implies group; subgroup's group wins if group omitted.
  let finalGroupId = employeeGroupId ?? undefined;
  if (resolvedGroupIdFromSubgroup) {
    if (employeeGroupId && employeeGroupId !== resolvedGroupIdFromSubgroup) {
      throw new Error("SUBGROUP_GROUP_MISMATCH");
    }
    finalGroupId = resolvedGroupIdFromSubgroup;
  }

  const patch: any = {};
  if (finalGroupId !== undefined) patch.employeeGroupId = finalGroupId;
  if (employeeSubgroupId !== undefined) patch.employeeSubgroupId = employeeSubgroupId;

  const item = await prisma.employee.update({
    where: { id: employeeId, companyId } as any,
    data: patch,
    select: {
      id: true,
      employeeCode: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  return { item };
}

export async function listEmployeesWithClassification() {
  const companyId = await getActiveCompanyId();
  const items = await prisma.employee.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ employeeCode: "asc" }],
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      employeeGroup: { select: { code: true, name: true } },
      employeeSubgroup: { select: { code: true, name: true, groupId: true } },
      branch: { select: { code: true, name: true } },
    },
  });
  return { items };
}