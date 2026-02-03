import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { monthlyAnomaliesToCsv } from "@/src/services/reports/monthlyReport.service";

function parseMonth(v: string | null): string | null {
  const s = (v ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [yy, mm] = s.split("-").map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm)) return null;
  if (mm < 1 || mm > 12) return null;
  return s;
}

function monthRangeLocal(month: string, tz: string) {
  const startLocal = DateTime.fromFormat(month + "-01", "yyyy-MM-dd", { zone: tz }).startOf("day");
  const endLocal = startLocal.plus({ months: 1 });
  return { startUTC: startLocal.toUTC().toJSDate(), endUTC: endLocal.toUTC().toJSDate() };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = parseMonth(url.searchParams.get("month"));
  if (!month) return NextResponse.json({ error: "Invalid month. Expected yyyy-MM" }, { status: 400 });

  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const { startUTC, endUTC } = monthRangeLocal(month, tz);

  const rows = await prisma.dailyAttendance.findMany({
    where: {
      companyId,
      workDate: { gte: startUTC, lt: endUTC },
      anomalies: { isEmpty: false },
    },
    include: { employee: true },
    orderBy: [{ workDate: "asc" }, { employeeId: "asc" }],
  });

  // ✅ manualOverrideApplied: DailyAttendance'da alan yok.
  // Bunun yerine DailyAdjustment var mı? ve içinde override/not var mı? => derived boolean üret.
  const employeeIds = Array.from(new Set(rows.map((r) => r.employeeId).filter(Boolean)));
  const overridesKey = new Set<string>();

  if (employeeIds.length > 0) {
   const adjustments = await prisma.dailyAdjustment.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        date: { gte: startUTC, lt: endUTC },
        OR: [
          { statusOverride: { not: null } },
          { workedMinutesOverride: { not: null } },
          { overtimeMinutesOverride: { not: null } },
          { overtimeEarlyMinutesOverride: { not: null } },
          { overtimeLateMinutesOverride: { not: null } },
          { lateMinutesOverride: { not: null } },
          { earlyLeaveMinutesOverride: { not: null } },
          { note: { not: null } },
        ],
      },
      select: { employeeId: true, date: true },
    });

    for (const a of adjustments) {
      const dateISO = DateTime.fromJSDate(a.date).setZone(tz).toFormat("yyyy-MM-dd");
      overridesKey.add(`${a.employeeId}|${dateISO}`);
    }
  }

  const out = rows.map((r) => {
    const dateISO = DateTime.fromJSDate(r.workDate).setZone(tz).toFormat("yyyy-MM-dd");
    const fullName = `${r.employee?.firstName ?? ""} ${r.employee?.lastName ?? ""}`.trim();
    return {
      dateISO,
      employeeCode: r.employee?.employeeCode ?? "",
      fullName,
      status: r.status,
      workedMinutes: r.workedMinutes ?? 0,
      anomalies: (r.anomalies ?? []) as string[],
      manualOverrideApplied: overridesKey.has(`${r.employeeId}|${dateISO}`),
    };
  });

  const csv = monthlyAnomaliesToCsv(out);
  const filename = `monthly_anomalies_${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}