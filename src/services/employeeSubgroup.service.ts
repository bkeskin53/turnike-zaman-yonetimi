import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function listEmployeeSubgroups() {
  const companyId = await getActiveCompanyId();
  const subgroups = await prisma.employeeSubgroup.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      groupId: true,
      group: { select: { code: true, name: true } },
    },
  });

  const assignments = await prisma.policyAssignment.findMany({
    where: { companyId, scope: "EMPLOYEE_SUBGROUP", employeeSubgroupId: { in: subgroups.map((s) => s.id) } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: {
      employeeSubgroupId: true,
      id: true,
      ruleSet: { select: { id: true, code: true, name: true } },
    },
  });

  const bestBySubgroup = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) {
    if (!bestBySubgroup.has(a.employeeSubgroupId!)) bestBySubgroup.set(a.employeeSubgroupId!, a);
  }

  const items = subgroups.map((s) => ({
    ...s,
    policy: bestBySubgroup.get(s.id)
      ? {
          assignmentId: bestBySubgroup.get(s.id)!.id,
          ruleSet: bestBySubgroup.get(s.id)!.ruleSet,
        }
      : null,
  }));

  return { items };
}


export async function createEmployeeSubgroup(input: {
  code: string;
  name: string;
  groupId: string;
}) {
  const companyId = await getActiveCompanyId();
  const code = String(input.code ?? "").trim();
  const name = String(input.name ?? "").trim();
  const groupId = String(input.groupId ?? "").trim();
  if (!code) throw new Error("CODE_REQUIRED");
  if (!name) throw new Error("NAME_REQUIRED");
  if (!groupId) throw new Error("GROUP_ID_REQUIRED");

  // Ensure group belongs to company
  const g = await prisma.employeeGroup.findFirst({
    where: { id: groupId, companyId },
    select: { id: true },
  });
  if (!g) throw new Error("GROUP_NOT_FOUND");

  const item = await prisma.employeeSubgroup.create({
    data: { companyId, code, name, groupId },
    select: { id: true, code: true, name: true, groupId: true },
  });
  return { item };
}

export async function updateEmployeeSubgroup(input: {
  id: string;
  code?: string;
  name?: string;
  groupId?: string;
}) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  const patch: any = {};
  if (input.code !== undefined) patch.code = String(input.code).trim();
  if (input.name !== undefined) patch.name = String(input.name).trim();
  if (input.groupId !== undefined) {
    const groupId = String(input.groupId ?? "").trim();
    if (!groupId) throw new Error("GROUP_ID_REQUIRED");
    const g = await prisma.employeeGroup.findFirst({
      where: { id: groupId, companyId },
      select: { id: true },
    });
    if (!g) throw new Error("GROUP_NOT_FOUND");
    patch.groupId = groupId;
  }

  const item = await prisma.employeeSubgroup.update({
    where: { id, companyId } as any,
    data: patch,
    select: { id: true, code: true, name: true, groupId: true },
  });
  return { item };
}

export async function deleteEmployeeSubgroup(input: { id: string }) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  await prisma.employeeSubgroup.delete({ where: { id, companyId } as any });
  return { ok: true };
}