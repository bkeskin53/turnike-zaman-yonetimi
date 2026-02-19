import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export type ShiftPolicyResolution =
  | {
      source:
        | "EMPLOYEE_SHIFT"
        | "EMPLOYEE_SUBGROUP_SHIFT"
        | "EMPLOYEE_GROUP_SHIFT"
        | "BRANCH_SHIFT"
        | "SHIFT";
      assignmentId: string;
      ruleSet: {
        id: string;
        code: string;
        name: string;

        shiftStartMinute: number;
        shiftEndMinute: number;
        breakMinutes: number;
        lateGraceMinutes: number;
        earlyLeaveGraceMinutes: number;

        breakAutoDeductEnabled: boolean;
        offDayEntryBehavior: any;
        overtimeEnabled: boolean;
        leaveEntryBehavior: any;

        graceAffectsWorked: boolean | null;
        exitConsumesBreak: boolean | null;
        maxSingleExitMinutes: number | null;
        maxDailyExitMinutes: number | null;
        exitExceedAction: any;

        graceMode: any;
        workedCalculationMode: any;
        otBreakInterval: number | null;
        otBreakDuration: number | null;
      };
    }
  | null;

/**
 * Shift-aware policy resolver (B-model).
 *
 * Resolution order (most specific wins):
 * 1) EMPLOYEE + SHIFT
 * 2) EMPLOYEE_SUBGROUP + SHIFT
 * 3) EMPLOYEE_GROUP + SHIFT
 * 4) BRANCH + SHIFT
 * 5) SHIFT-only
 *
 * Within each level:
 * validFrom/validTo + priority desc + createdAt desc.
 *
 * SAFE: if shiftCode missing -> returns null.
 */
export async function resolveShiftPolicyRuleSetForEmployeeOnDate(args: {
  companyId: string;
  employeeId: string;
  dayKey: string; // YYYY-MM-DD
  shiftCode: string | null | undefined;
}): Promise<ShiftPolicyResolution> {
  const shiftCode = String(args.shiftCode ?? "").trim();
  if (!shiftCode) return null;

  const targetDayDb = dbDateFromDayKey(args.dayKey);

  // Pull employee context once (subgroup/group/branch)
  const emp = await prisma.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: { id: true, employeeSubgroupId: true, employeeGroupId: true, branchId: true },
  });
  if (!emp) return null;

  // Helper
    const baseWhere = {
    companyId: args.companyId,
    shiftCode,
    AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
        { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
    ],
    };

  // 1) EMPLOYEE_SHIFT
  const a1 = await prisma.shiftPolicyAssignment.findFirst({
    where: { ...baseWhere, scope: "EMPLOYEE_SHIFT", employeeId: args.employeeId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: { id: true, ruleSet: { select: policyRuleSetSelect } },
  });
  if (a1?.ruleSet) return { source: "EMPLOYEE_SHIFT", assignmentId: a1.id, ruleSet: a1.ruleSet as any };

  // 2) SUBGROUP_SHIFT
  if (emp.employeeSubgroupId) {
    const a2 = await prisma.shiftPolicyAssignment.findFirst({
      where: { ...baseWhere, scope: "EMPLOYEE_SUBGROUP_SHIFT", employeeSubgroupId: emp.employeeSubgroupId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: { id: true, ruleSet: { select: policyRuleSetSelect } },
    });
    if (a2?.ruleSet) return { source: "EMPLOYEE_SUBGROUP_SHIFT", assignmentId: a2.id, ruleSet: a2.ruleSet as any };
  }

  // 3) GROUP_SHIFT
  if (emp.employeeGroupId) {
    const a3 = await prisma.shiftPolicyAssignment.findFirst({
      where: { ...baseWhere, scope: "EMPLOYEE_GROUP_SHIFT", employeeGroupId: emp.employeeGroupId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: { id: true, ruleSet: { select: policyRuleSetSelect } },
    });
    if (a3?.ruleSet) return { source: "EMPLOYEE_GROUP_SHIFT", assignmentId: a3.id, ruleSet: a3.ruleSet as any };
  }

  // 4) BRANCH_SHIFT
  if (emp.branchId) {
    const a4 = await prisma.shiftPolicyAssignment.findFirst({
      where: { ...baseWhere, scope: "BRANCH_SHIFT", branchId: emp.branchId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: { id: true, ruleSet: { select: policyRuleSetSelect } },
    });
    if (a4?.ruleSet) return { source: "BRANCH_SHIFT", assignmentId: a4.id, ruleSet: a4.ruleSet as any };
  }

  // 5) SHIFT-only
  const a5 = await prisma.shiftPolicyAssignment.findFirst({
    where: { ...baseWhere, scope: "SHIFT" },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: { id: true, ruleSet: { select: policyRuleSetSelect } },
  });
  if (a5?.ruleSet) return { source: "SHIFT", assignmentId: a5.id, ruleSet: a5.ruleSet as any };

  return null;
}

const policyRuleSetSelect = {
  id: true,
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
} as const;