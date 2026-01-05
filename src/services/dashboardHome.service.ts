import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { getCompanyBundle, getActiveCompanyId } from "@/src/services/company.service";
import { getDashboardActionItems } from "@/src/services/dashboardActions.service";

export async function getDashboardHomeData() {
  const companyId = await getActiveCompanyId();
  const { company, policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const todayLocal = DateTime.now().setZone(tz).toISODate()!;
  const startUtc = DateTime.fromISO(todayLocal, { zone: tz }).startOf("day").toUTC();
  const endUtc = startUtc.plus({ days: 1 });

  const [employeeCount, todayEventCount, lastEvent, recentEvents] = await Promise.all([
    prisma.employee.count({ where: { companyId, isActive: true } }),
    prisma.rawEvent.count({
      where: { companyId, occurredAt: { gte: startUtc.toJSDate(), lt: endUtc.toJSDate() } },
    }),
    prisma.rawEvent.findFirst({
      where: { companyId },
      orderBy: [{ occurredAt: "desc" }],
      select: { occurredAt: true },
    }),
    prisma.rawEvent.findMany({
      where: { companyId },
      orderBy: [{ occurredAt: "desc" }],
      take: 10,
      select: {
        id: true,
        occurredAt: true,
        direction: true,
        source: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  // ✅ workDate + actions
  const workDate = new Date(`${todayLocal}T00:00:00.000Z`);

  const actions = await getDashboardActionItems({
    companyId,
    workDate,
    expectedEmployees: employeeCount,
    policy,
  });

  // ✅ Anomali KPI (toplam)
  let anomalyCount = 0;
  try {
    anomalyCount = await prisma.dailyAttendance.count({
      where: { companyId, workDate, NOT: { anomalies: { isEmpty: true } } },
    });
  } catch {
    anomalyCount = 0;
  }

  // ✅ Anomali KPI (yüksek önem)
  const highAnomalyCount = await prisma.dailyAttendance.count({
    where: {
      companyId,
      workDate,
      anomalies: { hasSome: ["MISSING_PUNCH", "ORPHAN_OUT"] },
    },
  });

  // ✅ Daily son hesap zamanı
  const lastComputed = await prisma.dailyAttendance.findFirst({
    where: { companyId, workDate },
    orderBy: { computedAt: "desc" },
    select: { computedAt: true },
  });

  // ✅ Sistem Sağlığı (Device metrikleri)
  const offlineCutoff = DateTime.now().minus({ minutes: 5 }).toJSDate();

  const [deviceTotal, deviceOnline, deviceOffline, lastDeviceSync] = await Promise.all([
    prisma.device.count({ where: { companyId, isActive: true } }),
    prisma.device.count({ where: { companyId, isActive: true, lastSeenAt: { gte: offlineCutoff } } }),
    prisma.device.count({
      where: {
        companyId,
        isActive: true,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: offlineCutoff } }],
      },
    }),
    prisma.device.findFirst({
      where: { companyId, isActive: true, lastSyncAt: { not: null } },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    }),
  ]);

  return {
    company,
    tz,
    todayLocal,
    kpi: {
      employeeCount,
      todayEventCount,
      lastEventAt: lastEvent?.occurredAt ?? null,
      anomalyCount,
      highAnomalyCount,
      dailyComputedAt: lastComputed?.computedAt ?? null,
      dailyCoverage: actions.coverage,
    },
    recentEvents,
    actions,
    health: {
      deviceTotal,
      deviceOnline,
      deviceOffline,
      lastSyncAt: lastDeviceSync?.lastSyncAt ?? null,
      offlineThresholdMinutes: 5,
    },
  };
}
