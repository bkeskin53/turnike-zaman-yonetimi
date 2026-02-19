import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function listEmployeeGroups() {
  const companyId = await getActiveCompanyId();

  const groups = await prisma.employeeGroup.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true },
  });

  const assignments = await prisma.policyAssignment.findMany({
    where: { companyId, scope: "EMPLOYEE_GROUP", employeeGroupId: { in: groups.map((g) => g.id) } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: {
      employeeGroupId: true,
      id: true,
      ruleSet: { select: { id: true, code: true, name: true } },
    },
  });

  const bestByGroup = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) {
    if (!bestByGroup.has(a.employeeGroupId!)) bestByGroup.set(a.employeeGroupId!, a);
  }

  const items = groups.map((g) => ({
    ...g,
    policy: bestByGroup.get(g.id)
      ? {
          assignmentId: bestByGroup.get(g.id)!.id,
         ruleSet: bestByGroup.get(g.id)!.ruleSet,
        }
      : null,
  }));

  return { items };
}


export async function createEmployeeGroup(input: { code: string; name: string }) {
  const companyId = await getActiveCompanyId();
  const code = String(input.code ?? "").trim();
  const name = String(input.name ?? "").trim();
  if (!code) throw new Error("CODE_REQUIRED");
  if (!name) throw new Error("NAME_REQUIRED");

  const item = await prisma.employeeGroup.create({
    data: { companyId, code, name },
    select: { id: true, code: true, name: true },
  });
  return { item };
}

export async function updateEmployeeGroup(input: {
  id: string;
  code?: string;
  name?: string;
}) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  const patch: any = {};
  if (input.code !== undefined) patch.code = String(input.code).trim();
  if (input.name !== undefined) patch.name = String(input.name).trim();

  const item = await prisma.employeeGroup.update({
    where: { id, companyId } as any,
    data: patch,
    select: { id: true, code: true, name: true },
  });
  return { item };
}

export async function deleteEmployeeGroup(input: { id: string }) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  await prisma.employeeGroup.delete({ where: { id, companyId } as any });
  return { ok: true };
}