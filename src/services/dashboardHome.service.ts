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

  // ✅ Burada "employeeCount hesaplandıktan sonra" dediğim yer tam olarak burası:
  // Promise.all bitti, employeeCount elimizde. Şimdi workDate'yi oluşturup actions'ı hesaplıyoruz.
  const workDate = new Date(`${todayLocal}T00:00:00.000Z`);

  const actions = await getDashboardActionItems({
    companyId,
    workDate,
    expectedEmployees: employeeCount,
    policy,
  });

  // Anomali sayısı: DailyAttendance tablosu doluysa (recompute yaptıysan) çalışır.
  // Dolmuyorsa 0 görünmesi normal (sonra otomatik hale getireceğiz).
  let anomalyCount = 0;
  try {
    anomalyCount = await prisma.dailyAttendance.count({
      where: { companyId, workDate, NOT: { anomalies: { isEmpty: true } } },
    });
  } catch {
    anomalyCount = 0;
  }

  return {
    company,
    tz,
    todayLocal,
    kpi: {
      employeeCount,
      todayEventCount,
      lastEventAt: lastEvent?.occurredAt ?? null,
      anomalyCount,
    },
    recentEvents,
    actions, // ✅ bunu ekledik
  };
}
