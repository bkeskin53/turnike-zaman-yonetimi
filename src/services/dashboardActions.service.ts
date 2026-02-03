import { prisma } from "@/src/repositories/prisma";
import { getCompanyBundle, getActiveCompanyId } from "@/src/services/company.service";
import { DateTime } from "luxon";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

/**
 * Representation of an actionable item on the dashboard.  Each item
 * describes a situation (policy inconsistency, anomaly, etc.) that may
 * require user attention.  The `detail` field contains additional
 * context which is shown in the UI.  The previous version of this
 * code used `description` in the client; to avoid any implicit `any`
 * usage we standardise on `detail` here and adjust the UI accordingly.
 */
type ActionItem = {
  id: string;
  title: string;
  /**
   * Detailed description for the action item.  This corresponds to
   * the `detail` property consumed by the dashboard UI.
   */
  detail?: string;
  href?: string;
  severity: "INFO" | "WARN" | "ERROR";
  count?: number;
};

function shiftDurationMinutes(start: number, end: number) {
  // start/end: 0..1439
  // normal: 08:00->17:00 => 540
  // night : 22:00->06:00 => 480
  // When start === end the duration would be zero and is considered an
  // invalid configuration.  This function encapsulates that logic.
  if (start === end) return 0;
  return end > start ? end - start : 1440 - start + end;
}

function validatePolicyConsistency(policy: any): ActionItem[] {
  const items: ActionItem[] = [];

  const tz = policy.timezone ?? "Europe/Istanbul";
  if (!policy.timezone) {
    items.push({
      id: "policy-tz-missing",
      title: "Timezone tanımlı değil",
      detail: `Varsayılan olarak ${tz} kullanılacak. (Öneri: Şirket timezone’unu kaydet)`,
      href: "/policy",
      severity: "WARN",
      count: 1,
    });
  }

  const shiftStartMinute = Number(policy.shiftStartMinute ?? 8 * 60);
  const shiftEndMinute = Number(policy.shiftEndMinute ?? 17 * 60);

  // ❗️Gece vardiyası geçerli: start > end olabilir.
  // Sadece start==end saçma/tehlikeli ve buna dair uyarı veriyoruz.
  if (shiftStartMinute === shiftEndMinute) {
    items.push({
      id: "policy-shift-equal",
      title: "Policy ayarları kontrol edilmeli",
      detail: "Vardiya başlangıcı ile bitişi aynı olamaz.",
      href: "/policy",
      severity: "ERROR",
      count: 1,
    });
  }

  const shiftLen = shiftDurationMinutes(shiftStartMinute, shiftEndMinute);

  const breakEnabled = !!policy.breakAutoDeductEnabled;
  const breakMinutes = Number(policy.breakMinutes ?? 0);

  if (breakEnabled && breakMinutes <= 0) {
    items.push({
      id: "policy-break-enabled-but-zero",
      title: "Molayı otomatik düşme açık ama mola dakikası 0",
      detail: "Mola dakikasını gir veya otomatik düşmeyi kapat.",
      href: "/policy",
      severity: "WARN",
      count: 1,
    });
  }

  if (breakEnabled && shiftLen > 0 && breakMinutes >= shiftLen) {
    items.push({
      id: "policy-break-too-long",
      title: "Mola süresi vardiya süresinden uzun",
      detail: `Vardiya ~${shiftLen} dk, mola ${breakMinutes} dk. Bu ayar çalışmayı 0’a düşürebilir.`,
      href: "/policy",
      severity: "ERROR",
      count: 1,
    });
  }

  return items;
}

/**
 * Produce a list of actionable items for the dashboard along with summary
 * statistics.  The caller may provide the company, workDate and expected
 * employee count in order to compute coverage and severity in a single
 * location.  If no arguments are provided, the active company and current
 * date are used along with employee count from the database.  This
 * overloading is intentional so that legacy code which called this function
 * with no parameters continues to work.
 */
export async function getDashboardActionItems(args?: {
  companyId?: string;
  workDate?: Date;
  expectedEmployees?: number;
  policy?: any;
}) {
  let companyId = args?.companyId;
  let workDate = args?.workDate;
  let expectedEmployees = args?.expectedEmployees;
  let policy = args?.policy;

  // If any of the key parameters are missing, fall back to defaults.
  if (!companyId || !workDate || expectedEmployees == null || !policy) {
    companyId = companyId ?? (await getActiveCompanyId());
    const bundle = await getCompanyBundle();
    policy = policy ?? bundle.policy;
    // Determine today's canonical work day.
    // IMPORTANT:
    // - "today" must be derived in the configured timezone (policy.timezone)
    // - but we still persist/query workDate as UTC midnight (YYYY-MM-DDT00:00:00.000Z)
    //   to match the rest of the system's canonical day representation.
    const tz = policy?.timezone ?? "Europe/Istanbul";
    const todayLocal = DateTime.now().setZone(tz).toISODate()!; // YYYY-MM-DD (local)
    workDate = workDate ?? dbDateFromDayKey(todayLocal);
    if (expectedEmployees == null) {
      expectedEmployees = await prisma.employee.count({ where: { companyId, isActive: true } });
    }
  }

  const items: ActionItem[] = [];

  // 1) Policy consistency checks
  items.push(...validatePolicyConsistency(policy));

  // 2) Work-day anomalies (from DailyAttendance)
  const anomalyRows = await prisma.dailyAttendance.findMany({
    where: { companyId, workDate },
    select: { anomalies: true },
  });

  let missingPunchCount = 0;
  for (const r of anomalyRows) {
    if ((r.anomalies ?? []).includes("MISSING_PUNCH")) missingPunchCount++;
  }

  if (missingPunchCount > 0) {
    items.push({
      id: "missing-punch",
      title: "Eksik Çıkış (Missing Punch)",
      detail: `Bugün "MISSING_PUNCH" anomalisine düşen kayıtlar.`,
      href: "/reports/daily",
      severity: "WARN",
      count: missingPunchCount,
    });
  }

  // Severity summary (high/medium/low counts)
  const severity = {
    high: items.filter((x) => x.severity === "ERROR").length,
    medium: items.filter((x) => x.severity === "WARN").length,
    low: items.filter((x) => x.severity === "INFO").length,
  };

  // Daily coverage summary: number of dailyAttendance rows versus expected employees
  let computedRows = 0;
  try {
    computedRows = await prisma.dailyAttendance.count({ where: { companyId, workDate } });
  } catch {
    computedRows = 0;
  }
  const coverage = {
    computedRows,
    expectedEmployees,
  };

  return { items, coverage, severity };
}

/**
 * Legacy alias kept for backwards compatibility.  It delegates to
 * getDashboardActionItems() with no arguments which will compute sensible
 * defaults.  New code should call getDashboardActionItems() with explicit
 * parameters to avoid silent mismatches.
 */
export async function getDashboardSnapshot(args?: {
  companyId?: string;
  workDate?: Date;
  expectedEmployees?: number;
  policy?: any;
}) {
  return getDashboardActionItems(args);
}
