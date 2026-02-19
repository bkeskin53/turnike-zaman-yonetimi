import { DateTime } from "luxon";

function anomalyDetail(code: string): string {
  switch (code) {
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT çifti tamamlanmamış)";
    case "MISSING_IN":
      return "IN eksik";
    case "MISSING_OUT":
      return "OUT eksik";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "UNSCHEDULED_WORK":
      return "Vardiya dışı fiili çalışma (planlanan vardiya ile uyuşmuyor)";
    case "OUTSIDE_SHIFT_IGNORED":
      return "Vardiya penceresi dışında punch (CLAMP: worked'e dahil edilmedi)";
    case "DUPLICATE_PUNCH":
      return "Duplicate punch";
    case "DUPLICATE_EVENT":
      return "Duplicate event (aynı kayıt tekrarlandı)";
    case "EARLY_IN":
      return "Vardiya öncesi giriş";
    case "LATE_IN":
      return "Geç giriş";
    case "EARLY_OUT":
      return "Erken çıkış";
    case "LATE_OUT":
      return "Geç çıkış";
    case "OVERNIGHT":
      return "Gece sınırı (+1) aşıldı";
    case "PUNCH_BEFORE_SHIFT":
      return "Vardiya başlamadan punch";
    case "PUNCH_AFTER_SHIFT":
      return "Vardiya bitince punch";
    default:
      return code;
  }
}

function renderAnomalyDetails(codes: string[]): string {
  if (!Array.isArray(codes) || codes.length === 0) return "";
  if (codes.length === 1) return anomalyDetail(codes[0]!);
  // Excel-friendly: newline inside a quoted cell (csvEscape handles quoting)
  return `• ${codes.map(anomalyDetail).join("\n• ")}`;
}

import { applyDailyAdjustment } from "@/src/domain/attendance/applyDailyAdjustment";
import { listDailyAttendanceRange } from "@/src/repositories/attendance.repo";
import { prisma } from "@/src/repositories/prisma";
import { findWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";
import { recomputeAttendanceForDate } from "@/src/services/attendance.service";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";


// ------------------------------------------------------------
// CSV Helpers (Excel/TR friendly)
function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/["\r\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV for monthly anomalies export.
 * Input is already flattened and ready for exporting.
 * NOTE: This is a REPORT helper; does not touch the attendance engine.
 */
export function monthlyAnomaliesToCsv(
  rows: Array<{
    dateISO: string;
    employeeCode: string;
    fullName: string;
    status: string;
    workedMinutes: number;
    anomalies: string[];
    manualOverrideApplied: boolean;
  }>
): string {
  const header = [
    "Tarih",
    "Sicil",
    "Ad Soyad",
    "Durum",
    "Çalışma (dk)",
    "Manuel Düzeltme",
    "Anomaliler",
    "Anomali Detayı",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(","));

  for (const r of rows) {
    lines.push(
      [
        r.dateISO ?? "",
        r.employeeCode ?? "",
        r.fullName ?? "",
        r.status ?? "",
        Number(r.workedMinutes ?? 0),
        r.manualOverrideApplied ? "Evet" : "Hayır",
        Array.isArray(r.anomalies) ? r.anomalies.join(";") : "",
        renderAnomalyDetails(Array.isArray(r.anomalies) ? r.anomalies : []),
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  // UTF-8 BOM helps Excel (TR)
  return `\ufeff${lines.join("\r\n")}`;
}

function parseMonthOrThrow(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");
  const [y, m] = month.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) throw new Error("BAD_MONTH");
  return { y, m };
}

function buildMonthRangeUTC(month: string, tz: string) {
  const { y, m } = parseMonthOrThrow(month);
  const firstLocal = DateTime.fromObject({ year: y, month: m, day: 1 }, { zone: tz }).startOf("day");
  const nextLocal = firstLocal.plus({ months: 1 }).startOf("day");
  return {
    monthKey: `${y}-${String(m).padStart(2, "0")}`,
    fromUTC: firstLocal.toUTC().toJSDate(),
    toUTC: nextLocal.toUTC().toJSDate(),
  };
}

function buildSignatureFromMinutes(startMinute: number, endMinute: number) {
  const sH = Math.floor(startMinute / 60).toString().padStart(2, "0");
  const sM = (startMinute % 60).toString().padStart(2, "0");
  const eH = Math.floor(endMinute / 60).toString().padStart(2, "0");
  const eM = (endMinute % 60).toString().padStart(2, "0");
  const spansMidnight = endMinute <= startMinute;
  const signature = `${sH}${sM}-${eH}${eM}${spansMidnight ? "+1" : ""}`;
  return { signature, spansMidnight };
}

export async function buildMonthlyReportItems(args: {
  companyId: string;
  tz: string;
  month: string | null;
  sync: boolean;
}) {
  const { companyId, tz, month, sync } = args;
  const monthKey = month ?? DateTime.now().setZone(tz).toFormat("yyyy-MM");
  const { monthKey: normalizedMonth, fromUTC, toUTC } = buildMonthRangeUTC(monthKey, tz);

  // Cache weekly plans to avoid N*days queries
  const planCache = new Map<string, any | null>();

  function pickDayConfig(plan: any, weekday: number): {
    dayTplId: string | null | undefined;
    startMinute?: number | null;
    endMinute?: number | null;
  } {
    switch (weekday) {
      case 1:
        return { dayTplId: plan.monShiftTemplateId, startMinute: plan.monStartMinute, endMinute: plan.monEndMinute };
      case 2:
        return { dayTplId: plan.tueShiftTemplateId, startMinute: plan.tueStartMinute, endMinute: plan.tueEndMinute };
      case 3:
        return { dayTplId: plan.wedShiftTemplateId, startMinute: plan.wedStartMinute, endMinute: plan.wedEndMinute };
      case 4:
        return { dayTplId: plan.thuShiftTemplateId, startMinute: plan.thuStartMinute, endMinute: plan.thuEndMinute };
      case 5:
        return { dayTplId: plan.friShiftTemplateId, startMinute: plan.friStartMinute, endMinute: plan.friEndMinute };
      case 6:
        return { dayTplId: plan.satShiftTemplateId, startMinute: plan.satStartMinute, endMinute: plan.satEndMinute };
      case 7:
        return { dayTplId: plan.sunShiftTemplateId, startMinute: plan.sunStartMinute, endMinute: plan.sunEndMinute };
      default:
        return { dayTplId: null, startMinute: null, endMinute: null };
    }
  }

  async function getWeeklyPlanCached(employeeId: string, dateISO: string) {
    const weekStart = computeWeekStartUTC(dateISO, tz);
    const cacheKey = `${employeeId}__${DateTime.fromJSDate(weekStart).toUTC().toISODate()}`;
    if (planCache.has(cacheKey)) return planCache.get(cacheKey);
    const plan = await findWeeklyShiftPlan(companyId, employeeId, weekStart);
    planCache.set(cacheKey, plan ?? null);
    return plan ?? null;
  }

  if (sync) {
    const cursor = DateTime.fromJSDate(fromUTC).setZone(tz).startOf("day");
    const end = DateTime.fromJSDate(toUTC).setZone(tz).startOf("day");
    for (let d = cursor; d < end; d = d.plus({ days: 1 })) {
      const dateISO = d.toFormat("yyyy-MM-dd");
      await recomputeAttendanceForDate(dateISO);
    }
  }

  const rows = await listDailyAttendanceRange(companyId, fromUTC, toUTC);
  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId)));

  const adjustments = employeeIds.length
    ? await prisma.dailyAdjustment.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          date: { gte: fromUTC, lt: toUTC },
        },
      })
    : [];
  
  // ManualDays: count adjustments per employee for the selected month (report-only, canonical-safe)
  const manualDaysByEmp = new Map<string, number>();
  for (const adj of adjustments) {
    manualDaysByEmp.set(adj.employeeId, (manualDaysByEmp.get(adj.employeeId) ?? 0) + 1);
  }

  const adjByEmpDay = new Map<string, any>();
  for (const adj of adjustments) {
    // Canonical: map by local dayKey (policy timezone) to avoid UTC drift
    const dayKey = DateTime.fromJSDate(adj.date, { zone: "utc" }).setZone(tz).toISODate();
    const k = `${adj.employeeId}__${dayKey}`;
    adjByEmpDay.set(k, adj);
  }

  const byEmp = new Map<string, any>();
  for (const r of rows) {
    const code = (r as any).employee?.employeeCode ?? "";
    const firstName = (r as any).employee?.firstName ?? "";
    const lastName = (r as any).employee?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim();

    const dayKey = DateTime.fromJSDate((r as any).workDate, { zone: "utc" }).setZone(tz).toISODate();
    const adj = adjByEmpDay.get(`${r.employeeId}__${dayKey}`) ?? null;

    const base: any = {
      status: r.status,
      workedMinutes: r.workedMinutes,
      overtimeMinutes: (r as any).overtimeMinutes ?? 0,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      anomalies: r.anomalies ?? [],
   };
    const applied: any = applyDailyAdjustment(base, adj as any);

    const rec = byEmp.get(r.employeeId) ?? {
      employeeId: r.employeeId,
      employeeCode: code,
      manualDays: manualDaysByEmp.get(r.employeeId) ?? 0,
      manualOverrideApplied: (manualDaysByEmp.get(r.employeeId) ?? 0) > 0,
      shiftSummary: {
        policyDays: 0,
        weekTemplateDays: 0,
        dayTemplateDays: 0,
        dayCustomDays: 0,
        overnightDays: 0,
      },
      fullName,
      presentDays: 0,
      absentDays: 0,
      offDays: 0,
      leaveDays: 0,
      missingPunchDays: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      anomalyCount: 0,
    };

    // manualDays/manualOverrideApplied are computed from adjustments list (not per attendance row)

    // Shift source counts (report-only; does not affect engine)
    // Precedence: Day Template > Day Custom Minutes > Week Template > Policy (fallback)
    try {
      const dateISO = DateTime.fromJSDate((r as any).workDate, { zone: "utc" }).setZone(tz).toISODate()!;
      const dtLocal = DateTime.fromISO(dateISO, { zone: tz });
      const weekday = dtLocal.weekday; // 1..7

      const plan = await getWeeklyPlanCached(r.employeeId, dateISO);
      if (!plan) {
        rec.shiftSummary.policyDays += 1;
      } else {
        const { dayTplId, startMinute, endMinute } = pickDayConfig(plan, weekday);
        const hasMinutes =
          startMinute !== undefined &&
          endMinute !== undefined &&
          startMinute !== null &&
          endMinute !== null;

        if (dayTplId) {
          rec.shiftSummary.dayTemplateDays += 1;
        } else if (hasMinutes) {
          rec.shiftSummary.dayCustomDays += 1;
          if (Number(endMinute) < Number(startMinute)) rec.shiftSummary.overnightDays += 1;
        } else if (plan.shiftTemplateId) {
          rec.shiftSummary.weekTemplateDays += 1;
        } else {
          rec.shiftSummary.policyDays += 1;
        }
      }
    } catch {
      // Keep report resilient: if anything unexpected happens, don't break monthly report.
      rec.shiftSummary.policyDays += 1;
    }

    if (applied.status === "PRESENT") rec.presentDays++;
    else if (applied.status === "ABSENT") rec.absentDays++;
    else if (applied.status === "OFF") rec.offDays++;
    else if (applied.status === "LEAVE") rec.leaveDays++;

    const an = Array.isArray(applied.anomalies) ? applied.anomalies : [];
    if (an.includes("MISSING_PUNCH")) rec.missingPunchDays++;
    rec.anomalyCount += an.length;

    rec.workedMinutes += Number(applied.workedMinutes ?? 0);
   rec.overtimeMinutes += Number(applied.overtimeMinutes ?? 0);
    rec.lateMinutes += Number(applied.lateMinutes ?? 0);
    rec.earlyLeaveMinutes += Number(applied.earlyLeaveMinutes ?? 0);

    byEmp.set(r.employeeId, rec);
  }

  const items = Array.from(byEmp.values()).sort((a, b) => {
    const ac = String(a.employeeCode ?? "");
    const bc = String(b.employeeCode ?? "");
    return ac.localeCompare(bc, "tr");
  });

  return { month: normalizedMonth, items };
}
