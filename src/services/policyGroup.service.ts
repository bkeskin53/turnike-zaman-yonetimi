import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";

function normalizeCode(code: string) {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 50);
}

export async function listPolicyRuleSets() {
  const companyId = await getActiveCompanyId();

  const items = await prisma.policyRuleSet.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { items };
}

export async function getPolicyRuleSetById(id: string) {
  const companyId = await getActiveCompanyId();
  const ruleSetId = String(id ?? "").trim();
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const item = await prisma.policyRuleSet.findFirst({
    where: { companyId, id: ruleSetId },
    select: {
      id: true,
      companyId: true,
      code: true,
      name: true,

      shiftStartMinute: true,
      shiftEndMinute: true,
      breakMinutes: true,
      lateGraceMinutes: true,
      earlyLeaveGraceMinutes: true,

      breakAutoDeductEnabled: true,
      offDayEntryBehavior: true,
      overtimeEnabled: true,
      leaveEntryBehavior: true,

      graceAffectsWorked: true,
      exitConsumesBreak: true,
      maxSingleExitMinutes: true,
      maxDailyExitMinutes: true,
      exitExceedAction: true,

      graceMode: true,
      workedCalculationMode: true,
      otBreakInterval: true,
      otBreakDuration: true,

      createdAt: true,
      updatedAt: true,
    },
  });
  if (!item) throw new Error("RULESET_NOT_FOUND");
  return { item };
}

export async function updatePolicyRuleSet(id: string, patch: any) {
  const companyId = await getActiveCompanyId();
  const ruleSetId = String(id ?? "").trim();
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const existing = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true, code: true },
  });
  if (!existing) throw new Error("RULESET_NOT_FOUND");
  if (existing.code === "DEFAULT") throw new Error("DEFAULT_READONLY");

  // Only allow known fields (defensive)
  const data: any = {};
  const allow = [
    "name",
    "shiftStartMinute",
    "shiftEndMinute",
    "breakMinutes",
    "lateGraceMinutes",
    "earlyLeaveGraceMinutes",
    "breakAutoDeductEnabled",
    "offDayEntryBehavior",
    "overtimeEnabled",
    "leaveEntryBehavior",
    "graceAffectsWorked",
    "exitConsumesBreak",
    "maxSingleExitMinutes",
    "maxDailyExitMinutes",
    "exitExceedAction",
    "graceMode",
    "workedCalculationMode",
    "otBreakInterval",
    "otBreakDuration",
  ];
  for (const k of allow) {
    if (Object.prototype.hasOwnProperty.call(patch ?? {}, k)) data[k] = patch[k];
  }

  // Hard rule: code immutable (integration safety)
  delete data.code;
  delete data.companyId;
  delete data.id;

  const updated = await prisma.policyRuleSet.update({
    where: { id: ruleSetId },
    data,
    select: { id: true, code: true, name: true, updatedAt: true },
  });

  return { item: updated };
}

/**
 * Yeni RuleSet oluşturur.
 * SAFE: CompanyPolicy'den "clone" alır -> default davranışla başlar.
 */
export async function createPolicyRuleSetFromCompanyPolicy(input: { code: string; name: string }) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const base = bundle.policy;

  const code = normalizeCode(input.code);
  const name = String(input.name ?? "").trim();
  if (!code) throw new Error("CODE_REQUIRED");
  if (!name) throw new Error("NAME_REQUIRED");

  const created = await prisma.policyRuleSet.create({
    data: {
      companyId,
      code,
      name,

      // Copy evaluation rules from CompanyPolicy (timezone company-level kalır)
      shiftStartMinute: base.shiftStartMinute,
      shiftEndMinute: base.shiftEndMinute,
      breakMinutes: base.breakMinutes,
      lateGraceMinutes: base.lateGraceMinutes,
      earlyLeaveGraceMinutes: base.earlyLeaveGraceMinutes,

      breakAutoDeductEnabled: base.breakAutoDeductEnabled,
      offDayEntryBehavior: base.offDayEntryBehavior,
      overtimeEnabled: base.overtimeEnabled,
      leaveEntryBehavior: base.leaveEntryBehavior,

      graceAffectsWorked: base.graceAffectsWorked ?? null,
      exitConsumesBreak: base.exitConsumesBreak ?? null,
      maxSingleExitMinutes: base.maxSingleExitMinutes ?? null,
      maxDailyExitMinutes: base.maxDailyExitMinutes ?? null,
      exitExceedAction: base.exitExceedAction ?? null,

      graceMode: base.graceMode,
      workedCalculationMode: base.workedCalculationMode,
      otBreakInterval: base.otBreakInterval ?? null,
      otBreakDuration: base.otBreakDuration ?? null,
    },
    select: { id: true, code: true, name: true, createdAt: true },
  });

  return { item: created };
}
