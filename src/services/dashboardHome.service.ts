import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { getCompanyBundle, getActiveCompanyId } from "@/src/services/company.service";
import { getDashboardActionItems } from "@/src/services/dashboardActions.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

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
        door: { select: { code: true, name: true } },
        device: { select: { name: true } },
      },
    }),
  ]);

  // workDate + actions
  const workDate = dbDateFromDayKey(todayLocal);

  const actions = await getDashboardActionItems({
    companyId,
    workDate,
    expectedEmployees: employeeCount,
    policy,
  });

  // Anomaly KPI (total)
  let anomalyCount = 0;
  try {
    anomalyCount = await prisma.dailyAttendance.count({
      where: { companyId, workDate, NOT: { anomalies: { isEmpty: true } } },
    });
  } catch {
    anomalyCount = 0;
  }

  // High priority anomaly KPI
  const highAnomalyCount = await prisma.dailyAttendance.count({
    where: {
      companyId,
      workDate,
      anomalies: { hasSome: ["MISSING_PUNCH", "ORPHAN_OUT"] },
    },
  });

  // Last daily compute time
  const lastComputed = await prisma.dailyAttendance.findFirst({
    where: { companyId, workDate },
    orderBy: { computedAt: "desc" },
    select: { computedAt: true },
  });

  // System health (device metrics)
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

  // Daily summary (present/absent/off/missingPunch)
  const [presentCount, absentCount, offCount, missingPunchCount] = await Promise.all([
    prisma.dailyAttendance.count({ where: { companyId, workDate, status: "PRESENT" } }),
    prisma.dailyAttendance.count({ where: { companyId, workDate, status: "ABSENT" } }),
    prisma.dailyAttendance.count({ where: { companyId, workDate, status: "OFF" } }),
    prisma.dailyAttendance.count({
      where: {
        companyId,
        workDate,
        anomalies: { has: "MISSING_PUNCH" },
      },
    }),
  ]);

  // Branch summary (door, device and daily event counts)
  const branches = await prisma.branch.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  const branchSummary = await Promise.all(
    branches.map(async (b) => {
      const [doorCount, deviceCount] = await Promise.all([
        prisma.door.count({ where: { companyId, branchId: b.id, isActive: true } }),
        prisma.device.count({ where: { companyId, branchId: b.id, isActive: true } }),
      ]);
      // Daily event count: from doors + device-only events
      const countFromDoor = await prisma.rawEvent.count({
        where: {
          companyId,
          occurredAt: { gte: startUtc.toJSDate(), lt: endUtc.toJSDate() },
          door: { branchId: b.id },
        },
      });
      const countFromDevice = await prisma.rawEvent.count({
        where: {
          companyId,
          occurredAt: { gte: startUtc.toJSDate(), lt: endUtc.toJSDate() },
          doorId: null,
          device: { branchId: b.id },
        },
      });
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        doorCount,
        deviceCount,
        eventCount: countFromDoor + countFromDevice,
      };
    }),
  );

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
      dailySummary: {
        present: presentCount,
        absent: absentCount,
        off: offCount,
        missingPunch: missingPunchCount,
      },
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
    branchSummary,
  };
}
