import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export async function setEmployeePolicyAssignment(input: {
  employeeId: string;
  ruleSetId: string;
  validFromDayKey?: string | null; // YYYY-MM-DD
  validToDayKey?: string | null;   // YYYY-MM-DD
  priority?: number;
}) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(input.employeeId ?? "").trim();
  const ruleSetId = String(input.ruleSetId ?? "").trim();
  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const validFrom = input.validFromDayKey ? dbDateFromDayKey(input.validFromDayKey) : null;
  const validTo = input.validToDayKey ? dbDateFromDayKey(input.validToDayKey) : null;
  const priority = typeof input.priority === "number" ? input.priority : 100;

 // Ensure ruleSet belongs to company
  const rs = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true },
  });
  if (!rs) throw new Error("RULESET_NOT_FOUND");

  // Upsert behavior (single active assignment per employee per ruleset validity window is OK)
  const created = await prisma.policyAssignment.create({
    data: {
      companyId,
      scope: "EMPLOYEE",
      employeeId,
      ruleSetId,
      validFrom,
      validTo,
      priority,
    },
    select: {
      id: true,
      employeeId: true,
      ruleSetId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
    },
  });

  return { item: created };
}

export async function clearEmployeePolicyAssignments(input: { employeeId: string }) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(input.employeeId ?? "").trim();
  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");

  const r = await prisma.policyAssignment.deleteMany({
    where: {
      companyId,
     scope: "EMPLOYEE",
      employeeId,
    },
  });
  return { deletedCount: r.count };
}

export async function listEmployeePolicyAssignments(input: { employeeId: string }) {
  const companyId = await getActiveCompanyId();
  const employeeId = String(input.employeeId ?? "").trim();
  if (!employeeId) throw new Error("EMPLOYEE_ID_REQUIRED");

  const items = await prisma.policyAssignment.findMany({
    where: { companyId, scope: "EMPLOYEE", employeeId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      ruleSetId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
      ruleSet: { select: { code: true, name: true } },
    },
  });
  return { items };
}

export async function setEmployeeGroupPolicyAssignment(input: {
  employeeGroupId: string;
  ruleSetId: string;
  validFromDayKey?: string | null; // YYYY-MM-DD
  validToDayKey?: string | null;   // YYYY-MM-DD
  priority?: number;
}) {
  const companyId = await getActiveCompanyId();
  const employeeGroupId = String(input.employeeGroupId ?? "").trim();
  const ruleSetId = String(input.ruleSetId ?? "").trim();
  if (!employeeGroupId) throw new Error("GROUP_ID_REQUIRED");
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const validFrom = input.validFromDayKey ? dbDateFromDayKey(input.validFromDayKey) : null;
  const validTo = input.validToDayKey ? dbDateFromDayKey(input.validToDayKey) : null;
  const priority = typeof input.priority === "number" ? input.priority : 100;

  const rs = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true },
  });
  if (!rs) throw new Error("RULESET_NOT_FOUND");

  const g = await prisma.employeeGroup.findFirst({
    where: { id: employeeGroupId, companyId },
    select: { id: true },
  });
  if (!g) throw new Error("GROUP_NOT_FOUND");

  const created = await prisma.policyAssignment.create({
    data: {
      companyId,
      scope: "EMPLOYEE_GROUP",
      employeeGroupId,
      ruleSetId,
      validFrom,
      validTo,
      priority,
    },
    select: {
      id: true,
      employeeGroupId: true,
      ruleSetId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
    },
  });

  return { item: created };
}

export async function clearEmployeeGroupPolicyAssignments(input: { employeeGroupId: string }) {
  const companyId = await getActiveCompanyId();
  const employeeGroupId = String(input.employeeGroupId ?? "").trim();
  if (!employeeGroupId) throw new Error("GROUP_ID_REQUIRED");

  const r = await prisma.policyAssignment.deleteMany({
    where: { companyId, scope: "EMPLOYEE_GROUP", employeeGroupId },
  });
  return { deletedCount: r.count };
}

export async function setEmployeeSubgroupPolicyAssignment(input: {
  employeeSubgroupId: string;
  ruleSetId: string;
  validFromDayKey?: string | null; // YYYY-MM-DD
  validToDayKey?: string | null;   // YYYY-MM-DD
  priority?: number;
}) {
  const companyId = await getActiveCompanyId();
  const employeeSubgroupId = String(input.employeeSubgroupId ?? "").trim();
  const ruleSetId = String(input.ruleSetId ?? "").trim();
  if (!employeeSubgroupId) throw new Error("SUBGROUP_ID_REQUIRED");
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const validFrom = input.validFromDayKey ? dbDateFromDayKey(input.validFromDayKey) : null;
  const validTo = input.validToDayKey ? dbDateFromDayKey(input.validToDayKey) : null;
  const priority = typeof input.priority === "number" ? input.priority : 100;

  const rs = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true },
  });
  if (!rs) throw new Error("RULESET_NOT_FOUND");

  const sg = await prisma.employeeSubgroup.findFirst({
    where: { id: employeeSubgroupId, companyId },
    select: { id: true },
  });
  if (!sg) throw new Error("SUBGROUP_NOT_FOUND");

  const created = await prisma.policyAssignment.create({
    data: {
      companyId,
      scope: "EMPLOYEE_SUBGROUP",
      employeeSubgroupId,
      ruleSetId,
      validFrom,
      validTo,
      priority,
    },
    select: {
      id: true,
      employeeSubgroupId: true,
      ruleSetId: true,
      validFrom: true,
      validTo: true,
      priority: true,
      createdAt: true,
    },
  });

  return { item: created };
}

export async function clearEmployeeSubgroupPolicyAssignments(input: { employeeSubgroupId: string }) {
  const companyId = await getActiveCompanyId();
  const employeeSubgroupId = String(input.employeeSubgroupId ?? "").trim();
  if (!employeeSubgroupId) throw new Error("SUBGROUP_ID_REQUIRED");

  const r = await prisma.policyAssignment.deleteMany({
    where: { companyId, scope: "EMPLOYEE_SUBGROUP", employeeSubgroupId },
  });
  return { deletedCount: r.count };
}