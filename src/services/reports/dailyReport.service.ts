import { DateTime } from "luxon";

import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import { listDailyAttendance } from "@/src/repositories/attendance.repo";
import { prisma } from "@/src/repositories/prisma";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { Prisma } from "@prisma/client";

function minuteToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function buildSignatureFromMinutes(startMinute: number, endMinute: number): {
  signature: string;
  spansMidnight: boolean;
} {
  const s = minuteToTime(startMinute);
  const e = minuteToTime(endMinute);
  const spansMidnight = endMinute <= startMinute;
  const signature = `${s.replace(":", "")}-${e.replace(":", "")}${spansMidnight ? "+1" : ""}`;
  return { signature, spansMidnight };
}

export type DailyReportItem = any;

/**
 * Daily report data builder.
 *
 * Important: This is a REPORT/VIEW helper. It does NOT change the attendance engine.
 * It only enriches DailyAttendance rows with:
 * - manual adjustments (applyDailyAdjustment)
 * - shift meta (policy/week/day/custom) for UI visibility
 */
export async function buildDailyReportItems(params: {
  companyId: string;
  date: string; // YYYY-MM-DD
  tz: string;
  policy: any;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
}): Promise<DailyReportItem[]> {
  const { companyId, date, tz, policy, employeeWhere } = params;

  const policyStartMinute =
    typeof (policy as any).shiftStartMinute === "number" ? (policy as any).shiftStartMinute : null;
  const policyEndMinute =
    typeof (policy as any).shiftEndMinute === "number" ? (policy as any).shiftEndMinute : null;

  // workDate DB’de UTC midnight tutuluyor varsayımı
  const workDate = dbDateFromDayKey(date);

  const rows = await listDailyAttendance(companyId, workDate, employeeWhere ?? null);
  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId)));

  // ------------------------------------------------------------------
  // Policy resolution meta for UI (runtime, no DB writes)
  // Goal: show "Bugün hangi policy ruleset uygulandı?" as SAP-style transparency.
  // This is a REPORT/VIEW helper and must not affect the attendance engine.
  const employeeCtx = employeeIds.length
    ? await prisma.employee.findMany({
        where: { companyId, id: { in: employeeIds } },
        select: { id: true, branchId: true, employeeGroupId: true, employeeSubgroupId: true },
      })
    : [];

  const ctxByEmp = new Map<
    string,
    { branchId: string | null; employeeGroupId: string | null; employeeSubgroupId: string | null }
  >();
  const subgroupIds = new Set<string>();
  const groupIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const e of employeeCtx) {
    ctxByEmp.set(e.id, {
      branchId: e.branchId ?? null,
      employeeGroupId: e.employeeGroupId ?? null,
      employeeSubgroupId: e.employeeSubgroupId ?? null,
    });
    if (e.employeeSubgroupId) subgroupIds.add(e.employeeSubgroupId);
    if (e.employeeGroupId) groupIds.add(e.employeeGroupId);
    if (e.branchId) branchIds.add(e.branchId);
  }

  type ResolvedPolicyMeta = {
    source: "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH" | "COMPANY";
    assignmentId: string | null;
    ruleSetId: string | null;
    ruleSetCode: string | null;
    ruleSetName: string | null;
  };

  const [empAssignments, subgroupAssignments, groupAssignments, branchAssignments] = await Promise.all([
    employeeIds.length
      ? prisma.policyAssignment.findMany({
          where: {
            companyId,
            scope: "EMPLOYEE",
            employeeId: { in: employeeIds },
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: workDate } }] },
              { OR: [{ validTo: null }, { validTo: { gte: workDate } }] },
            ],
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            employeeId: true,
            ruleSet: { select: { id: true, code: true, name: true } },
          },
        })
      : [],
    subgroupIds.size
      ? prisma.policyAssignment.findMany({
          where: {
            companyId,
            scope: "EMPLOYEE_SUBGROUP",
            employeeSubgroupId: { in: Array.from(subgroupIds) },
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: workDate } }] },
              { OR: [{ validTo: null }, { validTo: { gte: workDate } }] },
            ],
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            employeeSubgroupId: true,
            ruleSet: { select: { id: true, code: true, name: true } },
          },
        })
      : [],
    groupIds.size
      ? prisma.policyAssignment.findMany({
          where: {
            companyId,
            scope: "EMPLOYEE_GROUP",
            employeeGroupId: { in: Array.from(groupIds) },
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: workDate } }] },
              { OR: [{ validTo: null }, { validTo: { gte: workDate } }] },
            ],
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            employeeGroupId: true,
            ruleSet: { select: { id: true, code: true, name: true } },
          },
        })
      : [],
    branchIds.size
      ? prisma.policyAssignment.findMany({
          where: {
            companyId,
            scope: "BRANCH",
            branchId: { in: Array.from(branchIds) },
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: workDate } }] },
              { OR: [{ validTo: null }, { validTo: { gte: workDate } }] },
            ],
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            branchId: true,
            ruleSet: { select: { id: true, code: true, name: true } },
          },
        })
      : [],
  ]);

  // Pick the first (highest priority / latest) assignment per key.
  const empAssignByEmp = new Map<string, any>();
  for (const a of empAssignments) {
  if (!a.employeeId) continue;
  if (!empAssignByEmp.has(a.employeeId)) empAssignByEmp.set(a.employeeId, a);
}

  const subgroupAssignById = new Map<string, any>();
  for (const a of subgroupAssignments)
    if (a.employeeSubgroupId && !subgroupAssignById.has(a.employeeSubgroupId)) subgroupAssignById.set(a.employeeSubgroupId, a);

  const groupAssignById = new Map<string, any>();
  for (const a of groupAssignments)
    if (a.employeeGroupId && !groupAssignById.has(a.employeeGroupId)) groupAssignById.set(a.employeeGroupId, a);

  const branchAssignById = new Map<string, any>();
  for (const a of branchAssignments)
    if (a.branchId && !branchAssignById.has(a.branchId)) branchAssignById.set(a.branchId, a);

  function resolvePolicyMetaForEmployee(employeeId: string): ResolvedPolicyMeta {
    const empA = empAssignByEmp.get(employeeId) ?? null;
    if (empA) {
      return {
        source: "EMPLOYEE",
        assignmentId: empA.id,
        ruleSetId: empA.ruleSet?.id ?? null,
        ruleSetCode: empA.ruleSet?.code ?? null,
        ruleSetName: empA.ruleSet?.name ?? null,
      };
    }

    const ctx = ctxByEmp.get(employeeId) ?? { branchId: null, employeeGroupId: null, employeeSubgroupId: null };

    if (ctx.employeeSubgroupId) {
      const sA = subgroupAssignById.get(ctx.employeeSubgroupId) ?? null;
      if (sA) {
        return {
          source: "EMPLOYEE_SUBGROUP",
          assignmentId: sA.id,
          ruleSetId: sA.ruleSet?.id ?? null,
          ruleSetCode: sA.ruleSet?.code ?? null,
          ruleSetName: sA.ruleSet?.name ?? null,
        };
      }
    }

    if (ctx.employeeGroupId) {
      const gA = groupAssignById.get(ctx.employeeGroupId) ?? null;
      if (gA) {
        return {
          source: "EMPLOYEE_GROUP",
          assignmentId: gA.id,
          ruleSetId: gA.ruleSet?.id ?? null,
          ruleSetCode: gA.ruleSet?.code ?? null,
          ruleSetName: gA.ruleSet?.name ?? null,
        };
      }
    }

    if (ctx.branchId) {
      const bA = branchAssignById.get(ctx.branchId) ?? null;
      if (bA) {
        return {
          source: "BRANCH",
          assignmentId: bA.id,
          ruleSetId: bA.ruleSet?.id ?? null,
          ruleSetCode: bA.ruleSet?.code ?? null,
          ruleSetName: bA.ruleSet?.name ?? null,
        };
      }
    }

    return { source: "COMPANY", assignmentId: null, ruleSetId: null, ruleSetCode: null, ruleSetName: null };
  }

  // ------------------------------------------------------------------
  // Shift source for UI (Policy / Week Template / Day Template / Custom)
  // Batch fetch weekly plans for the same weekStartDate to avoid N+1.
  const weekStartDate = computeWeekStartUTC(date, tz);

  const weeklyPlans = employeeIds.length
    ? await prisma.weeklyShiftPlan.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          weekStartDate,
        },
        select: {
          employeeId: true,
          shiftTemplateId: true,
          monShiftTemplateId: true,
          tueShiftTemplateId: true,
          wedShiftTemplateId: true,
          thuShiftTemplateId: true,
          friShiftTemplateId: true,
          satShiftTemplateId: true,
          sunShiftTemplateId: true,
          monStartMinute: true,
          monEndMinute: true,
          tueStartMinute: true,
          tueEndMinute: true,
          wedStartMinute: true,
          wedEndMinute: true,
          thuStartMinute: true,
          thuEndMinute: true,
          friStartMinute: true,
          friEndMinute: true,
          satStartMinute: true,
          satEndMinute: true,
          sunStartMinute: true,
          sunEndMinute: true,
        },
      })
    : [];

  const planByEmp = new Map<string, any>();
  for (const p of weeklyPlans) planByEmp.set(p.employeeId, p);

  const templateIds = new Set<string>();
  for (const p of weeklyPlans) {
    if (p.shiftTemplateId) templateIds.add(p.shiftTemplateId);
    const dayTpls = [
      p.monShiftTemplateId,
      p.tueShiftTemplateId,
      p.wedShiftTemplateId,
      p.thuShiftTemplateId,
      p.friShiftTemplateId,
      p.satShiftTemplateId,
      p.sunShiftTemplateId,
    ].filter(Boolean) as string[];
    for (const id of dayTpls) templateIds.add(id);
  }

  const templates = templateIds.size
    ? await prisma.shiftTemplate.findMany({
        where: {
          companyId,
          id: { in: Array.from(templateIds) },
          isActive: true,
        },
        select: { id: true, signature: true, spansMidnight: true },
      })
    : [];

  const tplById = new Map<string, { signature: string; spansMidnight: boolean }>();
  for (const t of templates) tplById.set(t.id, { signature: t.signature, spansMidnight: t.spansMidnight });

  const weekday = DateTime.fromISO(date, { zone: tz }).weekday; // 1=Mon .. 7=Sun

  function pickDayFields(plan: any): {
    dayTplId: string | null;
    dayStartMinute: number | null;
    dayEndMinute: number | null;
  } {
    switch (weekday) {
      case 1:
        return {
          dayTplId: plan.monShiftTemplateId ?? null,
          dayStartMinute: plan.monStartMinute ?? null,
          dayEndMinute: plan.monEndMinute ?? null,
        };
      case 2:
        return {
          dayTplId: plan.tueShiftTemplateId ?? null,
          dayStartMinute: plan.tueStartMinute ?? null,
          dayEndMinute: plan.tueEndMinute ?? null,
        };
      case 3:
        return {
          dayTplId: plan.wedShiftTemplateId ?? null,
          dayStartMinute: plan.wedStartMinute ?? null,
          dayEndMinute: plan.wedEndMinute ?? null,
        };
      case 4:
        return {
          dayTplId: plan.thuShiftTemplateId ?? null,
          dayStartMinute: plan.thuStartMinute ?? null,
          dayEndMinute: plan.thuEndMinute ?? null,
        };
      case 5:
        return {
          dayTplId: plan.friShiftTemplateId ?? null,
          dayStartMinute: plan.friStartMinute ?? null,
          dayEndMinute: plan.friEndMinute ?? null,
        };
      case 6:
        return {
          dayTplId: plan.satShiftTemplateId ?? null,
          dayStartMinute: plan.satStartMinute ?? null,
          dayEndMinute: plan.satEndMinute ?? null,
        };
      case 7:
      default:
        return {
          dayTplId: plan.sunShiftTemplateId ?? null,
          dayStartMinute: plan.sunStartMinute ?? null,
          dayEndMinute: plan.sunEndMinute ?? null,
        };
    }
  }

  function computeShiftBadge(employeeId: string): {
    shiftSource: "POLICY" | "WEEK_TEMPLATE" | "CUSTOM" | "DAY_TEMPLATE";
    shiftLabel: string;
    shiftBadge: string;
  } {
    const plan = planByEmp.get(employeeId) ?? null;

    // No weekly plan -> policy fallback
    if (!plan) {
      if (policyStartMinute != null && policyEndMinute != null) {
        const sig = buildSignatureFromMinutes(policyStartMinute, policyEndMinute);
        return {
          shiftSource: "POLICY",
          shiftLabel: sig.signature,
          shiftBadge: `🧩 ${sig.signature}${sig.spansMidnight ? " 🌙" : ""}`,
        };
      }
      return { shiftSource: "POLICY", shiftLabel: "Policy", shiftBadge: "🧩 Policy" };
    }

    const { dayTplId, dayStartMinute, dayEndMinute } = pickDayFields(plan);

    // 1) Day template
    if (dayTplId) {
      const tpl = tplById.get(dayTplId);
      if (tpl) {
        return {
          shiftSource: "DAY_TEMPLATE",
          shiftLabel: tpl.signature,
          shiftBadge: `📌 ${tpl.signature}${tpl.spansMidnight ? " 🌙" : ""}`,
        };
      }
      return { shiftSource: "DAY_TEMPLATE", shiftLabel: "Template", shiftBadge: "📌 Template" };
    }

    // 2) Day custom minutes
    if (dayStartMinute != null && dayEndMinute != null) {
      const sig = buildSignatureFromMinutes(dayStartMinute, dayEndMinute);
      return {
        shiftSource: "CUSTOM",
        shiftLabel: sig.signature,
        shiftBadge: `✏️ ${sig.signature}${sig.spansMidnight ? " 🌙" : ""}`,
      };
    }

    // 3) Week template
    if (plan.shiftTemplateId) {
      const tpl = tplById.get(plan.shiftTemplateId);
      if (tpl) {
        return {
          shiftSource: "WEEK_TEMPLATE",
          shiftLabel: tpl.signature,
          shiftBadge: `📅 ${tpl.signature}${tpl.spansMidnight ? " 🌙" : ""}`,
        };
      }
      return { shiftSource: "WEEK_TEMPLATE", shiftLabel: "Week Template", shiftBadge: "📅 Week Template" };
    }

    // 4) Policy fallback
    if (policyStartMinute != null && policyEndMinute != null) {
      const sig = buildSignatureFromMinutes(policyStartMinute, policyEndMinute);
      return {
        shiftSource: "POLICY",
        shiftLabel: sig.signature,
        shiftBadge: `🧩 ${sig.signature}${sig.spansMidnight ? " 🌙" : ""}`,
      };
    }
    return { shiftSource: "POLICY", shiftLabel: "Policy", shiftBadge: "🧩 Policy" };
  }

  // ------------------------------------------------------------------
  // Manual adjustments (batch)
  const adjustments = employeeIds.length
    ? await prisma.dailyAdjustment.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          date: workDate,
        },
      })
    : [];

  const adjByEmp = new Map<string, any>();
  for (const adj of adjustments) adjByEmp.set(adj.employeeId, adj);

  const items = rows.map((r) => {
    const code = (r as any).employee?.employeeCode ?? "";
    const firstName = (r as any).employee?.firstName ?? "";
    const lastName = (r as any).employee?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    const base: any = {
      id: r.id,
      employeeId: r.employeeId,
      employeeCode: code,
      fullName,
      status: r.status,
      requiresReview: (r as any).requiresReview ?? false,
      reviewReasons: (r as any).reviewReasons ?? [],
      reviewStatus: (r as any).reviewStatus ?? "NONE",
      reviewedAt: (r as any).reviewedAt ?? null,
      reviewedByUserId: (r as any).reviewedByUserId ?? null,
      reviewNote: (r as any).reviewNote ?? null,

      firstIn: r.firstIn,
      lastOut: r.lastOut,

      workedMinutes: r.workedMinutes,
      scheduledWorkedMinutes: (r as any).scheduledWorkedMinutes ?? 0,
      unscheduledWorkedMinutes: (r as any).unscheduledWorkedMinutes ?? 0,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      overtimeMinutes: (r as any).overtimeMinutes ?? 0,
      scheduledOvertimeMinutes: (r as any).scheduledOvertimeMinutes ?? 0,
      unscheduledOvertimeMinutes: (r as any).unscheduledOvertimeMinutes ?? 0,
      overtimeEarlyMinutes: (r as any).overtimeEarlyMinutes ?? 0,
      overtimeLateMinutes: (r as any).overtimeLateMinutes ?? 0,
      // Enterprise: OT Dynamic Break meta (engine output)
      otBreakCount: (r as any).otBreakCount ?? 0,
      otBreakDeductMinutes: (r as any).otBreakDeductMinutes ?? 0,

      anomalies: r.anomalies ?? [],
      anomalyMeta: (r as any).anomalyMeta ?? null,
    };

    // Policy meta (runtime transparency)
    const pol = resolvePolicyMetaForEmployee(r.employeeId);
    base.policySource = pol.source;
    base.policyRuleSetId = pol.ruleSetId;
    base.policyRuleSetCode = pol.ruleSetCode;
    base.policyRuleSetName = pol.ruleSetName;
    base.policyAssignmentId = pol.assignmentId;

    const adj = adjByEmp.get(r.employeeId) ?? null;
    const applied: any = applyDailyAdjustment(base, adj as any);

    // If overtimeMinutes is manually overridden, we no longer have a reliable early/late split.
    if (
      adj?.overtimeMinutesOverride != null &&
      adj?.overtimeEarlyMinutesOverride == null &&
      adj?.overtimeLateMinutesOverride == null
    ) {
      applied.overtimeEarlyMinutes = 0;
      applied.overtimeLateMinutes = applied.overtimeMinutes ?? 0;

      // Manual override breaks audit meaning of OT-break meta; zero it to avoid lying.
      applied.otBreakCount = 0;
      applied.otBreakDeductMinutes = 0;
    }

    const manualOverrideApplied =
      !!adj &&
      (adj.statusOverride != null ||
        adj.workedMinutesOverride != null ||
        adj.overtimeMinutesOverride != null ||
        adj.lateMinutesOverride != null ||
        adj.earlyLeaveMinutesOverride != null);
    applied.manualOverrideApplied = manualOverrideApplied;

    // Shift meta:
    // Prefer engine-persisted values (SINGLE SOURCE OF TRUTH).
    // Fallback to computed badge only for legacy rows that predate the new columns.
    const persistedSig = (r as any).shiftSignature as string | null | undefined;
    const persistedSrc = (r as any).shiftSource as any;
    const persistedSpans = (r as any).shiftSpansMidnight as boolean | null | undefined;
    if (persistedSig && persistedSrc) {
      applied.shiftSource = persistedSrc;
      applied.shiftLabel = persistedSig;
      // Badge style same as existing visual language
      const moon = persistedSpans ? " 🌙" : "";
      const prefix =
        persistedSrc === "DAY_TEMPLATE" ? "📌 " :
        persistedSrc === "CUSTOM" ? "✏️ " :
        persistedSrc === "WEEK_TEMPLATE" ? "📅 " :
        "🧩 ";
      applied.shiftBadge = `${prefix}${persistedSig}${moon}`;
    } else {
      const shift = computeShiftBadge(r.employeeId);
      applied.shiftSource = shift.shiftSource;
      applied.shiftLabel = shift.shiftLabel;
      applied.shiftBadge = shift.shiftBadge;
    }

    return applied;
  });

  return items;
}
