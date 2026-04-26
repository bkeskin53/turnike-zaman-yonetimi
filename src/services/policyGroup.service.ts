import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import type {
  AttendanceOwnershipMode,
  UnscheduledWorkBehavior,
} from "@prisma/client";

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

      attendanceOwnershipMode: true,
      minimumRestMinutes: true,
      ownershipEarlyInMinutes: true,
      ownershipLateOutMinutes: true,
      ownershipNextShiftLookaheadMinutes: true,
      unscheduledWorkBehavior: true,

      createdAt: true,
      updatedAt: true,
    },
  });
  if (!item) throw new Error("RULESET_NOT_FOUND");
  return { item };
}

export async function updatePolicyRuleSet(id: string, patch: any, opts?: { allowDefault?: boolean }) {
  const companyId = await getActiveCompanyId();
  const ruleSetId = String(id ?? "").trim();
  if (!ruleSetId) throw new Error("RULESET_ID_REQUIRED");

  const existing = await prisma.policyRuleSet.findFirst({
    where: { id: ruleSetId, companyId },
    select: { id: true, code: true },
  });
  if (!existing) throw new Error("RULESET_NOT_FOUND");
  if (existing.code === "DEFAULT" && !opts?.allowDefault) throw new Error("DEFAULT_READONLY");

  // Only allow known fields (defensive)
  const data: any = {};
  const allow = [
    "name",
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
    "attendanceOwnershipMode",
    "minimumRestMinutes",
    "ownershipEarlyInMinutes",
    "ownershipLateOutMinutes",
    "ownershipNextShiftLookaheadMinutes",
    "unscheduledWorkBehavior",
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

      attendanceOwnershipMode:
        (base.attendanceOwnershipMode as AttendanceOwnershipMode | null) ?? "INSTANCE_SCORING",
      minimumRestMinutes: base.minimumRestMinutes ?? 660,
      ownershipEarlyInMinutes: base.ownershipEarlyInMinutes ?? 180,
      ownershipLateOutMinutes: base.ownershipLateOutMinutes ?? 120,
      ownershipNextShiftLookaheadMinutes: base.ownershipNextShiftLookaheadMinutes ?? 0,
      unscheduledWorkBehavior:
        (base.unscheduledWorkBehavior as UnscheduledWorkBehavior | null) ?? "FLAG_ONLY",
    },
    select: { id: true, code: true, name: true, createdAt: true },
  });

  return { item: created };
}
