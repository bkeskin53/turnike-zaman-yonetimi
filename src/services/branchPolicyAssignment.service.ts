import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function setBranchPolicyRuleSet(input: { branchId: string; ruleSetId: string }) {
  const companyId = await getActiveCompanyId();
  const branchId = String(input.branchId ?? "").trim();
  const ruleSetId = String(input.ruleSetId ?? "").trim();
  if (!branchId) throw new Error("BRANCH_ID_REQUIRED");
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
    select: { id: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");

  const rs = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true },
  });
  if (!rs) throw new Error("RULESET_NOT_FOUND");

  // Remove previous BRANCH assignments for this branch (single active assignment model)
  await prisma.policyAssignment.deleteMany({
    where: { companyId, scope: "BRANCH", branchId },
  });

  const created = await prisma.policyAssignment.create({
    data: {
      companyId,
      scope: "BRANCH",
      branchId,
      ruleSetId,
      // validity null = always
      validFrom: null,
      validTo: null,
      priority: 100,
    },
    select: {
      id: true,
      branchId: true,
      ruleSetId: true,
      createdAt: true,
    },
  });

  return { item: created };
}

export async function clearBranchPolicyRuleSet(input: { branchId: string }) {
  const companyId = await getActiveCompanyId();
  const branchId = String(input.branchId ?? "").trim();
  if (!branchId) throw new Error("BRANCH_ID_REQUIRED");

  const r = await prisma.policyAssignment.deleteMany({
    where: { companyId, scope: "BRANCH", branchId },
  });
  return { deletedCount: r.count };
}

export async function listBranchesWithPolicyRuleSet() {
  const companyId = await getActiveCompanyId();

  const branches = await prisma.branch.findMany({
    where: { companyId },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });

  const assigns = await prisma.policyAssignment.findMany({
    where: { companyId, scope: "BRANCH" },
    select: {
      branchId: true,
      ruleSetId: true,
      ruleSet: { select: { code: true, name: true } },
    },
  });
  const byBranch = new Map<string, { ruleSetId: string; code: string; name: string }>();
  for (const a of assigns) {
    if (!a.branchId) continue;
    byBranch.set(a.branchId, { ruleSetId: a.ruleSetId, code: a.ruleSet.code, name: a.ruleSet.name });
  }

  return {
    items: branches.map((b) => ({
      ...b,
      policyRuleSet: byBranch.get(b.id) ?? null,
    })),
  };
}
