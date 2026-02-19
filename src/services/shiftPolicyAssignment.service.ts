import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export type ShiftPolicyAssignmentScope =
  | "SHIFT"
  | "BRANCH_SHIFT"
  | "EMPLOYEE_GROUP_SHIFT"
  | "EMPLOYEE_SUBGROUP_SHIFT"
  | "EMPLOYEE_SHIFT";

function normalizeShiftCode(value: any): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error("SHIFT_CODE_REQUIRED");
  if (v.length > 80) throw new Error("SHIFT_CODE_TOO_LONG");
  return v;
}

function normalizeScope(value: any): ShiftPolicyAssignmentScope {
  const v = String(value ?? "").trim();
  switch (v) {
    case "SHIFT":
    case "BRANCH_SHIFT":
    case "EMPLOYEE_GROUP_SHIFT":
    case "EMPLOYEE_SUBGROUP_SHIFT":
    case "EMPLOYEE_SHIFT":
      return v;
    default:
      throw new Error("SCOPE_INVALID");
  }
}

export async function createShiftPolicyAssignment(input: {
  scope: ShiftPolicyAssignmentScope;
  shiftCode: string;

  employeeId?: string | null;
  employeeSubgroupId?: string | null;
  employeeGroupId?: string | null;
  branchId?: string | null;

  ruleSetId: string;
  validFromDayKey?: string | null;
  validToDayKey?: string | null;
  priority?: number;
}) {
  const companyId = await getActiveCompanyId();
  const scope = normalizeScope(input.scope);
  const shiftCode = normalizeShiftCode(input.shiftCode);

  const ruleSetId = String(input.ruleSetId ?? "").trim();
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const employeeId = input.employeeId ? String(input.employeeId).trim() : null;
  const employeeSubgroupId = input.employeeSubgroupId ? String(input.employeeSubgroupId).trim() : null;
  const employeeGroupId = input.employeeGroupId ? String(input.employeeGroupId).trim() : null;
  const branchId = input.branchId ? String(input.branchId).trim() : null;

  // Scope-target validation
  if (scope === "EMPLOYEE_SHIFT" && !employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");
  if (scope === "EMPLOYEE_SUBGROUP_SHIFT" && !employeeSubgroupId) throw new Error("EMPLOYEE_SUBGROUP_ID_REQUIRED");
  if (scope === "EMPLOYEE_GROUP_SHIFT" && !employeeGroupId) throw new Error("EMPLOYEE_GROUP_ID_REQUIRED");
  if (scope === "BRANCH_SHIFT" && !branchId) throw new Error("BRANCH_ID_REQUIRED");

  if (scope === "SHIFT") {
    if (employeeId || employeeSubgroupId || employeeGroupId || branchId) {
      throw new Error("SHIFT_SCOPE_TARGET_NOT_ALLOWED");
    }
  }

  const validFrom = input.validFromDayKey ? dbDateFromDayKey(input.validFromDayKey) : null;
  const validTo = input.validToDayKey ? dbDateFromDayKey(input.validToDayKey) : null;
  const priority = typeof input.priority === "number" ? input.priority : 100;

  // Ensure ruleSet belongs to company
  const rs = await prisma.policyRuleSet.findFirst({ where: { id: ruleSetId, companyId }, select: { id: true } });
  if (!rs) throw new Error("RULESET_NOT_FOUND");

  // Ensure shiftCode exists (optional but recommended for governance)
  const st = await prisma.shiftTemplate.findFirst({
    where: { companyId, shiftCode },
    select: { id: true },
  });
  if (!st) throw new Error("SHIFT_CODE_NOT_FOUND");

  const created = await prisma.shiftPolicyAssignment.create({
    data: {
      companyId,
      scope,
      shiftCode,
      employeeId,
      employeeSubgroupId,
      employeeGroupId,
      branchId,
      ruleSetId,
      validFrom,
      validTo,
      priority,
    },
    select: {
      id: true,
      scope: true,
      shiftCode: true,
      employeeId: true,
      employeeSubgroupId: true,
      employeeGroupId: true,
      branchId: true,
      ruleSetId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
      ruleSet: { select: { id: true, code: true, name: true } },
    },
  });

  return { item: created };
}

export async function deleteShiftPolicyAssignment(input: { id: string }) {
  const companyId = await getActiveCompanyId();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  const r = await prisma.shiftPolicyAssignment.deleteMany({ where: { companyId, id } });
  return { deletedCount: r.count };
}

export async function listShiftPolicyAssignments(input: {
  shiftCode?: string | null;
  scope?: ShiftPolicyAssignmentScope | null;
}) {
  const companyId = await getActiveCompanyId();
  const shiftCode = input.shiftCode ? String(input.shiftCode).trim() : null;
  const scope = input.scope ? normalizeScope(input.scope) : null;

  return prisma.shiftPolicyAssignment.findMany({
    where: {
      companyId,
      ...(shiftCode ? { shiftCode } : {}),
      ...(scope ? { scope } : {}),
    },
    orderBy: [{ shiftCode: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      scope: true,
      shiftCode: true,
      employeeId: true,
      employeeSubgroupId: true,
      employeeGroupId: true,
      branchId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
      ruleSet: { select: { id: true, code: true, name: true } },
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      employeeSubgroup: { select: { id: true, code: true, name: true } },
      employeeGroup: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}