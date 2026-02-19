import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export type PolicyResolution =
  | {
      source: "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH";
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
 * SAP-benzeri Policy Group resolver.
 *
 * Phase-2: EMPLOYEE / EMPLOYEE_SUBGROUP / EMPLOYEE_GROUP / BRANCH scope.
 *
 * SAFE davranış:
 * - Atama yoksa null döner.
 * - Çağıran taraf legacy CompanyPolicy'yi kullanır.
 *   (Yani hiçbir atama yapılmadığı sürece sistem çıktısı birebir aynı kalır.)
 */
export async function resolvePolicyRuleSetForEmployeeOnDate(args: {
  companyId: string;
  employeeId: string;
  dayKey: string; // canonical work day key (YYYY-MM-DD)
}): Promise<PolicyResolution> {
  const targetDayDb = dbDateFromDayKey(args.dayKey);

  // 1) EMPLOYEE scope (most specific)
  const employeeAssignment = await prisma.policyAssignment.findFirst({
    where: {
      companyId: args.companyId,
      scope: "EMPLOYEE",
      employeeId: args.employeeId,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
        { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ruleSet: {
        select: {
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
        },
      },
    },
  });

  if (employeeAssignment) {
    return {
      source: "EMPLOYEE",
      assignmentId: employeeAssignment.id,
      ruleSet: employeeAssignment.ruleSet,
    };
  }

  // Load employee context once (for subgroup/group/branch fallbacks)
  const emp = await prisma.employee.findFirst({
    where: { id: args.employeeId, companyId: args.companyId },
    select: { id: true, branchId: true, employeeGroupId: true, employeeSubgroupId: true },
  });

  // 2) EMPLOYEE_SUBGROUP scope
  if (emp?.employeeSubgroupId) {
    const subgroupAssignment = await prisma.policyAssignment.findFirst({
      where: {
        companyId: args.companyId,
        scope: "EMPLOYEE_SUBGROUP",
        employeeSubgroupId: emp.employeeSubgroupId,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
          { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ruleSet: {
          select: {
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
          },
        },
      },
    });

    if (subgroupAssignment) {
      return {
        source: "EMPLOYEE_SUBGROUP",
        assignmentId: subgroupAssignment.id,
        ruleSet: subgroupAssignment.ruleSet,
      };
    }
  }

  // 3) EMPLOYEE_GROUP scope
  if (emp?.employeeGroupId) {
    const groupAssignment = await prisma.policyAssignment.findFirst({
      where: {
        companyId: args.companyId,
        scope: "EMPLOYEE_GROUP",
        employeeGroupId: emp.employeeGroupId,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
          { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ruleSet: {
          select: {
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
          },
        },
      },
    });

    if (groupAssignment) {
      return {
        source: "EMPLOYEE_GROUP",
        assignmentId: groupAssignment.id,
        ruleSet: groupAssignment.ruleSet,
      };
    }
  }

  // 4) BRANCH scope (fallback)
  if (emp?.branchId) {
    const branchAssignment = await prisma.policyAssignment.findFirst({
      where: {
        companyId: args.companyId,
        scope: "BRANCH",
        branchId: emp.branchId,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
          { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ruleSet: {
          select: {
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
          },
        },
      },
    });

    if (branchAssignment) {
      return {
        source: "BRANCH",
        assignmentId: branchAssignment.id,
        ruleSet: branchAssignment.ruleSet,
      };
    }
  }

  return null;
}