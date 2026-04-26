import Link from "next/link";
import { DateTime } from "luxon";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import AppShell from "@/app/_components/AppShellNoSSR";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { resolveShiftForDay } from "@/src/services/shiftPlan.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

type SearchParams = {
  rangeStartDate?: string;
  rangeEndDate?: string;
  anomalyOnly?: string;
};

function isISODate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampRange(startISO?: string, endISO?: string) {
  const today = DateTime.now().startOf("day").toISODate()!;
  const safeStart = isISODate(startISO) ? startISO : today;
  const safeEnd = isISODate(endISO) ? endISO : safeStart;

  const s = DateTime.fromISO(safeStart);
  const e = DateTime.fromISO(safeEnd);

  if (!s.isValid && !e.isValid) return { start: today, end: today };
  if (!s.isValid) return { start: safeEnd, end: safeEnd };
  if (!e.isValid) return { start: safeStart, end: safeStart };
  if (e < s) return { start: safeEnd, end: safeStart };

  const days = Math.floor(e.diff(s, "days").days) + 1;
  const cappedEnd =
    days > 62 ? s.plus({ days: 61 }).toISODate()! : safeEnd;

  return { start: safeStart, end: cappedEnd };
}

function buildDayKeys(startISO: string, endISO: string): string[] {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid || !e.isValid) return [];

  const days = Math.floor(e.diff(s, "days").days) + 1;
  const safeDays = Math.max(1, Math.min(days, 62));

  return Array.from({ length: safeDays }).map((_, i) =>
    s.plus({ days: i }).toISODate()!
  );
}

function hhmmFromMinute(min: number | null | undefined): string {
  if (typeof min !== "number" || Number.isNaN(min)) return "—";
  const m = Math.max(0, Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function trShiftSourceTR(src: string | null | undefined): string {
  const v = String(src ?? "").trim();
  switch (v) {
    case "WEEK_TEMPLATE":
      return "Haftalık Plan";
    case "DAY_TEMPLATE":
      return "Günlük Override";
    case "WORK_SCHEDULE":
      return "Çalışma Planı (Rota)";
    case "POLICY":
      return "Kural (Policy)";
    case "CUSTOM":
      return "Özel";
    default:
      return v || "Sistem";
  }
}

function sourceBadgeClass(src: string | null | undefined): string {
  const v = String(src ?? "").trim();
  switch (v) {
    case "WORK_SCHEDULE":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "POLICY":
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
    case "WEEK_TEMPLATE":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "DAY_TEMPLATE":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "CUSTOM":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }
}

function weekdayTR(iso: string): string {
  const dt = DateTime.fromISO(iso);
  const w = dt.isValid ? dt.weekday : 0;
  return ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"][w] ?? iso;
}

function formatDateTimeTR(value: Date | string | null | undefined, tz: string): string {
  if (!value) return "—";
  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: tz })
      : DateTime.fromISO(String(value), { zone: tz });
  if (!dt.isValid) return "—";
  return dt.toFormat("dd.MM.yyyy HH:mm");
}

function formatMinutesTR(mins: number | null | undefined): string {
  if (typeof mins !== "number" || Number.isNaN(mins)) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (String(status ?? "").trim()) {
    case "PRESENT":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "ABSENT":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "OFF":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "LEAVE":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }
}

function statusLabelTR(status: string | null | undefined): string {
  switch (String(status ?? "").trim()) {
    case "PRESENT":
      return "Var";
    case "ABSENT":
      return "Yok";
    case "OFF":
      return "Off";
    case "LEAVE":
      return "İzin";
    default:
      return status || "—";
  }
}

function anomalyToneClass(code: string): string {
  const v = String(code ?? "").trim().toUpperCase();
  if (
    v.includes("MISSING") ||
    v.includes("ORPHAN") ||
    v.includes("REJECT") ||
    v.includes("OUTSIDE")
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (
    v.includes("LATE") ||
    v.includes("EARLY") ||
    v.includes("UNSCHEDULED") ||
    v.includes("OVERTIME")
  ) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-zinc-50 text-zinc-700 ring-zinc-200";
}

export default async function PlannerEmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrNull();

  if (!session) {
    redirect("/login");
  }

  const allowed = [
    UserRole.SYSTEM_ADMIN,
    UserRole.HR_OPERATOR,
    UserRole.HR_CONFIG_ADMIN,
    UserRole.SUPERVISOR,
  ];

  if (!allowed.includes(session.role)) {
    notFound();
  }

  const { id } = await params;
  const qp = await searchParams;
  const anomalyOnly = String(qp.anomalyOnly ?? "") === "1";

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();

  const range = clampRange(qp.rangeStartDate, qp.rangeEndDate);
  const dayKeys = buildDayKeys(range.start, range.end);

  const employee = await prisma.employee.findFirst({
    where: { companyId, id },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
      employeeGroup: {
        select: {
          id: true,
          name: true,
        },
      },
      employeeSubgroup: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!employee) {
    notFound();
  }

  const fullName = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();

  const attendanceRows = await prisma.dailyAttendance.findMany({
    where: {
      companyId,
      employeeId: employee.id,
      workDate: {
        gte: dbDateFromDayKey(range.start),
        lte: dbDateFromDayKey(range.end),
      },
    },
    select: {
      workDate: true,
      firstIn: true,
      lastOut: true,
      workedMinutes: true,
      overtimeMinutes: true,
      overtimeEarlyMinutes: true,
      overtimeLateMinutes: true,
      otBreakCount: true,
      otBreakDeductMinutes: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,
      status: true,
      anomalies: true,
      shiftSource: true,
      shiftSignature: true,
      shiftStartMinute: true,
      shiftEndMinute: true,
      shiftSpansMidnight: true,
    },
  });

  const adjustmentRows = await prisma.dailyAdjustment.findMany({
    where: {
      companyId,
      employeeId: employee.id,
      date: {
        gte: dbDateFromDayKey(range.start),
        lte: dbDateFromDayKey(range.end),
      },
    },
    select: {
      date: true,
      note: true,
      statusOverride: true,
      workedMinutesOverride: true,
      overtimeMinutesOverride: true,
      overtimeEarlyMinutesOverride: true,
      overtimeLateMinutesOverride: true,
      lateMinutesOverride: true,
      earlyLeaveMinutesOverride: true,
    },
  });

  const attendanceByDayKey = new Map(
    attendanceRows.map((x) => [
      DateTime.fromJSDate(x.workDate).toISODate()!,
      x,
    ])
  );

  const adjustmentByDayKey = new Map(
    adjustmentRows.map((x) => [
      DateTime.fromJSDate(x.date).toISODate()!,
      x,
    ])
  );

  const rows = [];
  for (const dayKey of dayKeys) {
    const r: any = await resolveShiftForDay(employee.id, dayKey);
    const att = attendanceByDayKey.get(dayKey) ?? null;
    const adj = adjustmentByDayKey.get(dayKey) ?? null;
    const hasManualOverride = !!adj;

    rows.push({
      dayKey,
      weekday: weekdayTR(dayKey),
      source: r?.source ?? null,
      sourceLabel: trShiftSourceTR(r?.source ?? null),
      signature: r?.signature ?? null,
      badge: String(r?.signature ?? "").trim() || "—",
      startMinute: r?.startMinute ?? null,
      endMinute: r?.endMinute ?? null,
      startText: hhmmFromMinute(r?.startMinute ?? null),
      endText: hhmmFromMinute(r?.endMinute ?? null),
      spansMidnight: !!r?.spansMidnight,
      isOff: String(r?.signature ?? "").trim().toUpperCase() === "OFF",
      isEmpty: !r,
      attendance: att
        ? {
            status: att.status,
            firstIn: att.firstIn,
            lastOut: att.lastOut,
            workedMinutes: att.workedMinutes,
            overtimeMinutes: att.overtimeMinutes,
            overtimeEarlyMinutes: att.overtimeEarlyMinutes,
            overtimeLateMinutes: att.overtimeLateMinutes,
            otBreakCount: att.otBreakCount,
            otBreakDeductMinutes: att.otBreakDeductMinutes,
            lateMinutes: att.lateMinutes,
            earlyLeaveMinutes: att.earlyLeaveMinutes,
            anomalies: Array.isArray(att.anomalies) ? att.anomalies : [],
          }
        : null,
      manualOverride: hasManualOverride
        ? {
            note: adj?.note ?? null,
            statusOverride: adj?.statusOverride ?? null,
            workedMinutesOverride: adj?.workedMinutesOverride ?? null,
            overtimeMinutesOverride: adj?.overtimeMinutesOverride ?? null,
            overtimeEarlyMinutesOverride: adj?.overtimeEarlyMinutesOverride ?? null,
            overtimeLateMinutesOverride: adj?.overtimeLateMinutesOverride ?? null,
            lateMinutesOverride: adj?.lateMinutesOverride ?? null,
            earlyLeaveMinutesOverride: adj?.earlyLeaveMinutesOverride ?? null,
          }
        : null,
    });
  }

  const visibleRows = anomalyOnly
    ? rows.filter((row) => (row.attendance?.anomalies?.length ?? 0) > 0)
    : rows;

  const summary = {
    totalDays: rows.length,
    visibleDays: visibleRows.length,
    offDays: rows.filter((x) => x.isOff).length,
    emptyDays: rows.filter((x) => x.isEmpty).length,
    rotaDays: rows.filter((x) => x.source === "WORK_SCHEDULE").length,
    policyDays: rows.filter((x) => x.source === "POLICY").length,
    weekTemplateDays: rows.filter((x) => x.source === "WEEK_TEMPLATE").length,
    dayOverrideDays: rows.filter((x) => x.source === "DAY_TEMPLATE").length,
    customDays: rows.filter((x) => x.source === "CUSTOM").length,
    anomalyDays: rows.filter((x) => (x.attendance?.anomalies?.length ?? 0) > 0).length,
  };

  const backHref = `/shift-assignments/planner?rangeStartDate=${encodeURIComponent(
    range.start
  )}&rangeEndDate=${encodeURIComponent(range.end)}`;

  const detailBaseHref = `/shift-assignments/planner/employee/${employee.id}?rangeStartDate=${encodeURIComponent(
    range.start
  )}&rangeEndDate=${encodeURIComponent(range.end)}`;

  const anomalyOnlyHref = `${detailBaseHref}&anomalyOnly=1`;
  const allDaysHref = detailBaseHref;

  return (
    <AppShell
      title="Personel Vardiya Detayı"
      subtitle="Seçili tarih aralığında uygulanan gerçek vardiya bilgileri"
    >
      <div className="mx-auto grid max-w-7xl gap-6 p-2 md:p-6">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                  {fullName}
                </h1>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                  {employee.employeeCode}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    employee.isActive
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-zinc-50 text-zinc-600 ring-zinc-200"
                  }`}
                >
                  {employee.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                {employee.branch?.name ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium">
                    Şube: {employee.branch.name}
                  </span>
                ) : null}
                {employee.employeeGroup?.name ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium">
                    Grup: {employee.employeeGroup.name}
                  </span>
                ) : null}
                {employee.employeeSubgroup?.name ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium">
                    Alt Grup: {employee.employeeSubgroup.name}
                  </span>
                ) : null}
                {employee.email ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium">
                    {employee.email}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={backHref}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                ← Planner’a dön
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
              Aralık: {range.start} → {range.end}
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 font-medium text-zinc-700">
              Zaman Dilimi: {policy?.timezone ?? "Europe/Istanbul"}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Toplam Gün</div>
            <div className="mt-2 text-3xl font-bold text-zinc-900">{summary.totalDays}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">OFF Günleri</div>
            <div className="mt-2 text-3xl font-bold text-zinc-900">{summary.offDays}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rota / Policy</div>
            <div className="mt-2 text-3xl font-bold text-zinc-900">
              {summary.rotaDays + summary.policyDays}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Rota: {summary.rotaDays} • Policy: {summary.policyDays}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Override / Plan / Özel</div>
            <div className="mt-2 text-3xl font-bold text-zinc-900">
              {summary.dayOverrideDays + summary.weekTemplateDays + summary.customDays}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Override: {summary.dayOverrideDays} • Plan: {summary.weekTemplateDays} • Özel: {summary.customDays}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-zinc-700">Görüntüleme Filtresi</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                  anomalyOnly
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-zinc-50 text-zinc-700 ring-zinc-200"
                }`}
              >
                {anomalyOnly ? "Yalnız anomaly olan günler" : "Tüm günler"}
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-rose-50 text-rose-700 ring-rose-200">
                Anomaly gün sayısı: {summary.anomalyDays}
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-sky-50 text-sky-700 ring-sky-200">
                Gösterilen: {summary.visibleDays}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={allDaysHref}
                className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  !anomalyOnly
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Tüm Günler
              </Link>
              <Link
                href={anomalyOnlyHref}
                className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  anomalyOnly
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Yalnız Anomaly
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Gün Bazlı Uygulanan Vardiyalar</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Bu liste, engine’in gerçekten çözdüğü vardiyayı ve varsa o günün fiili attendance sonucunu birlikte gösterir.
            </p>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleRows.map((row) => (
              <div
                key={row.dayKey}
                className={`rounded-2xl border p-4 shadow-sm ${
                  row.isOff
                    ? "border-amber-200 bg-amber-50/60"
                    : row.isEmpty
                    ? "border-zinc-200 bg-zinc-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-zinc-900">{row.weekday}</div>
                    <div className="mt-1 text-xs font-medium text-zinc-500">{row.dayKey}</div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${sourceBadgeClass(
                      row.source
                    )}`}
                    title={row.sourceLabel}
                  >
                    {row.sourceLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Uygulanan Vardiya
                    </div>
                    <div className="mt-1 text-lg font-bold text-zinc-900">
                      {row.badge}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Başlangıç
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">{row.startText}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Bitiş
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">{row.endText}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Signature
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        {row.signature ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Gece Geçişi
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        {row.spansMidnight ? "Evet (+1)" : "Hayır"}
                      </div>
                    </div>
                  </div>
                  
                  <details className="group rounded-xl border border-zinc-200 bg-white">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 marker:content-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 transition group-open:rotate-90">
                          ›
                        </span>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Fiili Attendance Sonucu
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {row.attendance ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(
                              row.attendance.status
                            )}`}
                          >
                            {statusLabelTR(row.attendance.status)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-zinc-50 text-zinc-700 ring-zinc-200">
                            Hesap yok
                          </span>
                        )}
                        <span className="text-xs font-medium text-zinc-400">
                          Aç / Kapat
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-zinc-100 px-3 pb-3 pt-3">
                      {row.attendance ? (
                        <div className="grid gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                İlk Giriş
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatDateTimeTR(row.attendance.firstIn, policy?.timezone ?? "Europe/Istanbul")}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Son Çıkış
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatDateTimeTR(row.attendance.lastOut, policy?.timezone ?? "Europe/Istanbul")}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Çalışılan
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatMinutesTR(row.attendance.workedMinutes)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Fazla Mesai
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatMinutesTR(row.attendance.overtimeMinutes)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Geç Kalma
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatMinutesTR(row.attendance.lateMinutes)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Erken Ayrılma
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatMinutesTR(row.attendance.earlyLeaveMinutes)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                Erken OT / Geç OT
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {formatMinutesTR(row.attendance.overtimeEarlyMinutes)} / {formatMinutesTR(row.attendance.overtimeLateMinutes)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                OT Break
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-900">
                                {row.attendance.otBreakCount ?? 0} kez • {formatMinutesTR(row.attendance.otBreakDeductMinutes)}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              Anomaliler
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {row.attendance.anomalies.length > 0 ? (
                                row.attendance.anomalies.map((code: string) => (
                                  <span
                                    key={code}
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${anomalyToneClass(
                                      code
                                    )}`}
                                  >
                                    {code}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm font-medium text-zinc-500">Anomaly yok</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600">
                          Bu gün için hesaplanmış daily attendance kaydı bulunamadı.
                        </div>
                      )}
                    </div>
                  </details>

                  {row.manualOverride ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Manual Override
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-emerald-900">
                        <div className="flex flex-wrap gap-2">
                          {row.manualOverride.statusOverride ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold">
                              Status: {statusLabelTR(row.manualOverride.statusOverride)}
                            </span>
                          ) : null}
                          {row.manualOverride.workedMinutesOverride != null ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold">
                              Worked: {formatMinutesTR(row.manualOverride.workedMinutesOverride)}
                            </span>
                          ) : null}
                          {row.manualOverride.overtimeMinutesOverride != null ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold">
                              OT: {formatMinutesTR(row.manualOverride.overtimeMinutesOverride)}
                            </span>
                          ) : null}
                          {row.manualOverride.lateMinutesOverride != null ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold">
                              Late: {formatMinutesTR(row.manualOverride.lateMinutesOverride)}
                            </span>
                          ) : null}
                          {row.manualOverride.earlyLeaveMinutesOverride != null ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold">
                              Early Leave: {formatMinutesTR(row.manualOverride.earlyLeaveMinutesOverride)}
                            </span>
                          ) : null}
                        </div>

                        {row.manualOverride.note ? (
                          <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm">
                            {row.manualOverride.note}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {row.isOff ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-100/70 px-3 py-2 text-sm font-medium text-amber-900">
                      Bu gün OFF olarak çözülmüş.
                    </div>
                  ) : null}

                  {row.isEmpty ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-100/70 px-3 py-2 text-sm font-medium text-zinc-700">
                      Bu gün için çözümlenmiş vardiya bulunamadı.
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {visibleRows.length === 0 ? (
              <div className="md:col-span-2 2xl:col-span-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm font-medium text-zinc-600">
                  {anomalyOnly
                    ? "Seçilen aralıkta anomaly olan gün bulunamadı."
                    : "Gösterilecek gün bulunamadı."}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}