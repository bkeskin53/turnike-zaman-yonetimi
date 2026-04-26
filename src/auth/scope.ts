import { prisma } from "@/src/repositories/prisma";
import { Prisma } from "@prisma/client";
import type { Role } from "@/src/auth/guard";

export type SessionLike = { userId: string; role: Role };

/**
 * Scope v3 (enterprise):
 * - Default deny for SUPERVISOR: if no valid scope config => 0 access.
 * - Hierarchical constraint:
 *    - Branch is mandatory (must have at least 1 branch id).
 *    - If subgroupIds selected => groupIds must be selected AND subgroups must belong to selected groups.
 * - Optional filters composition with AND (only for selected axes).
 *
 * Non-supervisor => null (full access).
 */
export async function getEmployeeScopeWhereForSession(
  session: SessionLike
): Promise<Prisma.EmployeeWhereInput | null> {
  if (!session?.userId) return null;
  if (session.role !== "SUPERVISOR") return null;

  const u = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      scopeBranchIds: true,
      scopeEmployeeGroupIds: true,
      scopeEmployeeSubgroupIds: true,
    },
  });

  // Fail closed: if user row missing, no access.
  if (!u) return { id: { in: [] } };

  const branchIds = (u.scopeBranchIds ?? []).filter(Boolean);
  const groupIds = (u.scopeEmployeeGroupIds ?? []).filter(Boolean);
  const subgroupIds = (u.scopeEmployeeSubgroupIds ?? []).filter(Boolean);

  // V3: default deny unless config is valid.
  // Branch is mandatory.
  if (branchIds.length === 0) return { id: { in: [] } };

  // If subgroup is selected, group must be selected.
  if (subgroupIds.length > 0 && groupIds.length === 0) return { id: { in: [] } };

  // Validate subgroup -> group relationship (fail closed on mismatch / unknown ids).
  if (subgroupIds.length > 0) {
    const sgs = await prisma.employeeSubgroup.findMany({
      where: { id: { in: subgroupIds } },
      select: { id: true, groupId: true },
    });
    if (sgs.length !== subgroupIds.length) return { id: { in: [] } };
    const groupSet = new Set(groupIds);
    for (const sg of sgs) {
      if (!groupSet.has(sg.groupId)) return { id: { in: [] } };
    }
  }

  const and: Prisma.EmployeeWhereInput[] = [];
  and.push({ branchId: { in: branchIds } });
  if (groupIds.length > 0) and.push({ employeeGroupId: { in: groupIds } });
  if (subgroupIds.length > 0) and.push({ employeeSubgroupId: { in: subgroupIds } });

  return and.length ? { AND: and } : { id: { in: [] } };
}

export function withCompanyEmployeeWhere(
  companyId: string,
  scopeWhere: Prisma.EmployeeWhereInput | null
): Prisma.EmployeeWhereInput {
  return scopeWhere ? { companyId, AND: [scopeWhere] } : { companyId };
}