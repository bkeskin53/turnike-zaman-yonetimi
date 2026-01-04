import type { CompanyPolicy } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

export type DashboardActionItem = {
  key: string;
  title: string;
  count: number;
  severity: "high" | "medium" | "low" | "info";
  description: string;
  href: string;
  samples: string[];
};

function validatePolicy(policy: CompanyPolicy): string[] {
  const issues: string[] = [];

  if (policy.shiftStartMinute >= policy.shiftEndMinute) {
    issues.push("Vardiya başlangıcı, vardiya bitişinden küçük olmalı.");
  }

  const shiftLen = Math.max(0, policy.shiftEndMinute - policy.shiftStartMinute);
  if (policy.breakMinutes < 0) issues.push("Mola dakikası negatif olamaz.");
  if (policy.breakMinutes > shiftLen && policy.breakAutoDeductEnabled) {
    issues.push("Mola dakikası vardiya süresinden büyük olamaz (auto-deduct açıkken).");
  }

  if (policy.lateGraceMinutes < 0) issues.push("Geç kalma toleransı negatif olamaz.");
  if (policy.earlyLeaveGraceMinutes < 0) issues.push("Erken çıkış toleransı negatif olamaz.");

  if (!policy.timezone || policy.timezone.length < 3) {
    issues.push("Timezone boş olamaz.");
  }

  return issues;
}

export async function getDashboardActionItems(opts: {
  companyId: string;
  workDate: Date; // YYYY-MM-DDT00:00:00.000Z
  expectedEmployees: number;
  policy: CompanyPolicy;
}) {
  const { companyId, workDate, expectedEmployees, policy } = opts;

  const computedRows = await prisma.dailyAttendance.count({
    where: { companyId, workDate },
  });

  const needsRecompute = computedRows < expectedEmployees;

  async function anomalyBlock(key: string, title: string, anomaly: string, severity: DashboardActionItem["severity"]) {
    const [count, rows] = await Promise.all([
      prisma.dailyAttendance.count({
        where: { companyId, workDate, anomalies: { has: anomaly } },
      }),
      prisma.dailyAttendance.findMany({
        where: { companyId, workDate, anomalies: { has: anomaly } },
        take: 5,
        orderBy: [{ employee: { employeeCode: "asc" } }],
        select: {
          employee: { select: { employeeCode: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const samples = rows.map(
      (r) => `${r.employee.employeeCode} ${r.employee.firstName} ${r.employee.lastName}`.trim()
    );

    return {
      key,
      title,
      count,
      severity,
      description: `Bugün "${anomaly}" anomalisine düşen kayıtlar.`,
      href: "/reports/daily",
      samples,
    } satisfies DashboardActionItem;
  }

  const policyIssues = validatePolicy(policy);

  const items: DashboardActionItem[] = [];

  if (needsRecompute) {
    items.push({
      key: "DAILY_NOT_COMPUTED",
      title: "Günlük hesaplama eksik",
      count: expectedEmployees - computedRows,
      severity: "medium",
      description: `Dashboard anomalileri için Daily hesaplama tamamlanmalı (Computed: ${computedRows}/${expectedEmployees}).`,
      href: "/reports/daily",
      samples: [],
    });
  }

  // Günlükten gelen gerçek aksiyonlar
  items.push(await anomalyBlock("MISSING_PUNCH", "Eksik Çıkış (Missing Punch)", "MISSING_PUNCH", "high"));
  items.push(await anomalyBlock("ORPHAN_OUT", "Yetim OUT (Girişsiz Çıkış)", "ORPHAN_OUT", "medium"));
  items.push(await anomalyBlock("CONSECUTIVE_IN", "Ardışık IN (Şüpheli Geçiş)", "CONSECUTIVE_IN", "medium"));
  items.push(await anomalyBlock("DUPLICATE_EVENT", "Çift Kayıt (Duplicate)", "DUPLICATE_EVENT", "low"));
  items.push(await anomalyBlock("OFF_DAY_WORK", "Hafta Sonu / Off-day Çalışma", "OFF_DAY_WORK", "info"));

  if (policyIssues.length > 0) {
    items.push({
      key: "POLICY_ISSUES",
      title: "Policy ayarları kontrol edilmeli",
      count: policyIssues.length,
      severity: "medium",
      description: "Policy’de tutarsız veya riskli ayar(lar) var.",
      href: "/policy",
      samples: policyIssues.slice(0, 3),
    });
  }

  // Boş olanları en sona atalım
  items.sort((a, b) => b.count - a.count);

  return {
    coverage: { computedRows, expectedEmployees, needsRecompute },
    items,
  };
}
