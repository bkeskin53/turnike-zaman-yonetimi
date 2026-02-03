import { DateTime } from "luxon";

import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import { listDailyAttendance } from "@/src/repositories/attendance.repo";
import { prisma } from "@/src/repositories/prisma";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

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
}): Promise<DailyReportItem[]> {
  const { companyId, date, tz, policy } = params;

  const policyStartMinute =
    typeof (policy as any).shiftStartMinute === "number" ? (policy as any).shiftStartMinute : null;
  const policyEndMinute =
    typeof (policy as any).shiftEndMinute === "number" ? (policy as any).shiftEndMinute : null;

  // workDate DB’de UTC midnight tutuluyor varsayımı
  const workDate = dbDateFromDayKey(date);

  const rows = await listDailyAttendance(companyId, workDate);
  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId)));

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

      firstIn: r.firstIn,
      lastOut: r.lastOut,

      workedMinutes: r.workedMinutes,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      overtimeMinutes: (r as any).overtimeMinutes ?? 0,
      overtimeEarlyMinutes: (r as any).overtimeEarlyMinutes ?? 0,
      overtimeLateMinutes: (r as any).overtimeLateMinutes ?? 0,

      anomalies: r.anomalies ?? [],
    };

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
    }

    const manualOverrideApplied =
      !!adj &&
      (adj.statusOverride != null ||
        adj.workedMinutesOverride != null ||
        adj.overtimeMinutesOverride != null ||
        adj.lateMinutesOverride != null ||
        adj.earlyLeaveMinutesOverride != null);
    applied.manualOverrideApplied = manualOverrideApplied;

    // Shift meta (UI visibility only)
    const shift = computeShiftBadge(r.employeeId);
    applied.shiftSource = shift.shiftSource;
    applied.shiftLabel = shift.shiftLabel;
    applied.shiftBadge = shift.shiftBadge;

    return applied;
  });

  return items;
}
