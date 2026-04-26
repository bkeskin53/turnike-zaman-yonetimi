import AppShell from "@/app/_components/AppShellNoSSR";
import { DateTime } from "luxon";
import { getDashboardHomeData } from "@/src/services/dashboardHome.service";
import LiveFeedClient from "./live-feed-client";

function fmt(dt: Date | null, tz: string) {
  if (!dt) return "—";
  return DateTime.fromJSDate(dt).setZone(tz).toFormat("dd LLL yyyy HH:mm");
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function sectionCardCls(extra?: string) {
  return [
    "rounded-[24px]",
    "border border-zinc-300/70",
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)]",
    "shadow-[0_10px_26px_rgba(15,23,42,0.055)]",
    "ring-1 ring-white/70",
    extra ?? "",
  ].join(" ");
}

function dayStripBg(tone: "ok" | "warn" | "danger") {
  if (tone === "danger") {
    return [
      "border-red-300/60",
      "bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(254,242,242,0.96)_55%,rgba(255,255,255,0.98)_100%)]",
      "shadow-[0_10px_28px_rgba(239,68,68,0.10)]",
      "ring-1 ring-white/70",
    ].join(" ");
  }
  if (tone === "warn") {
    return [
      "border-amber-300/60",
      "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.96)_55%,rgba(255,255,255,0.98)_100%)]",
      "shadow-[0_10px_28px_rgba(245,158,11,0.10)]",
      "ring-1 ring-white/70",
    ].join(" ");
  }
  return [
    "border-emerald-300/55",
    "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.96)_55%,rgba(255,255,255,0.98)_100%)]",
    "shadow-[0_10px_28px_rgba(16,185,129,0.10)]",
    "ring-1 ring-white/70",
  ].join(" ");
}

function Pill({
  tone,
  children,
}: {
  tone: "neutral" | "good" | "warn" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "info"
          ? "border-indigo-200 bg-indigo-50 text-indigo-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function KpiIcon({
  kind,
}: {
  kind: "people" | "events" | "clock" | "warn";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5",
  };

  if (kind === "warn") {
    return (
      <svg {...common}>
        <path d="M12 2l10 18H2L12 2z" fill="currentColor" opacity="0.14" />
        <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 2l10 18H2L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "clock") {
    return (
      <svg {...common}>
        <path
          d="M12 7v6l4 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 22a10 10 0 110-20 10 10 0 010 20z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (kind === "events") {
    return (
      <svg {...common}>
        <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 7h16v14H4V7z" stroke="currentColor" strokeWidth="2" />
        <path d="M7 11h4M7 15h4M13 11h4M13 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // people
  return (
    <svg {...common}>
      <path
        d="M16 11c1.7 0 3 1.3 3 3v6H5v-6c0-1.7 1.3-3 3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function KpiCard(props: {
  title: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  subline?: React.ReactNode;
  footnote?: React.ReactNode;
  tone?: "default" | "danger";
  accent?: "zinc" | "emerald" | "amber" | "indigo" | "red";
}) {
  const tone = props.tone ?? "default";
  const accent = props.accent ?? (tone === "danger" ? "red" : "zinc");

  const accentCls:
    | "border-emerald-200 bg-emerald-50 text-emerald-700"
    | "border-amber-200 bg-amber-50 text-amber-800"
    | "border-indigo-200 bg-indigo-50 text-indigo-700"
    | "border-red-200 bg-red-50 text-red-700"
    | "border-zinc-200 bg-zinc-50 text-zinc-700" =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : accent === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : accent === "indigo"
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : accent === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-zinc-200 bg-zinc-50 text-zinc-700";

            const cardSurfaceCls =
    accent === "indigo"
      ? [
          "border-indigo-300/65",
          "bg-[linear-gradient(135deg,rgba(59,130,246,0.96)_0%,rgba(37,99,235,0.94)_58%,rgba(30,64,175,0.96)_100%)]",
          "text-white",
          "shadow-[0_14px_34px_rgba(37,99,235,0.18)]",
          "ring-1 ring-white/20",
        ].join(" ")
      : accent === "amber"
        ? [
            "border-amber-300/70",
            "bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(254,240,138,0.92)_55%,rgba(245,158,11,0.92)_100%)]",
            "text-amber-950",
            "shadow-[0_14px_34px_rgba(245,158,11,0.15)]",
            "ring-1 ring-white/55",
          ].join(" ")
        : accent === "red"
          ? [
              "border-red-300/70",
              "bg-[linear-gradient(135deg,rgba(255,245,245,0.98)_0%,rgba(252,165,165,0.92)_55%,rgba(239,68,68,0.92)_100%)]",
              "text-red-950",
              "shadow-[0_14px_34px_rgba(239,68,68,0.15)]",
              "ring-1 ring-white/55",
            ].join(" ")
          : accent === "emerald"
            ? [
                "border-emerald-300/60",
                "bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(209,250,229,0.92)_55%,rgba(110,231,183,0.88)_100%)]",
                "text-emerald-950",
                "shadow-[0_12px_28px_rgba(16,185,129,0.10)]",
                "ring-1 ring-white/65",
              ].join(" ")
            : [
                "border-zinc-300/70",
                "bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(244,244,245,0.98)_60%,rgba(228,228,231,0.95)_100%)]",
                "text-zinc-900",
                "shadow-[0_12px_28px_rgba(15,23,42,0.06)]",
                "ring-1 ring-white/70",
              ].join(" ");

  const titleCls =
    accent === "indigo"
      ? "text-white/80"
      : accent === "red"
        ? "text-red-950/70"
        : accent === "amber"
          ? "text-amber-950/70"
          : "text-zinc-600";

  const valueCls = props.valueClassName
    ? props.valueClassName
    : accent === "indigo"
      ? "mt-2 text-4xl font-semibold tracking-tight text-white"
      : tone === "danger"
        ? "mt-2 text-4xl font-semibold tracking-tight text-red-700"
        : "mt-2 text-4xl font-semibold tracking-tight";

  const subCls =
    accent === "indigo"
      ? "text-white/80"
      : accent === "red"
        ? "text-red-950/70"
        : accent === "amber"
          ? "text-amber-950/75"
          : "text-zinc-600";

  return (
    <div className={`group relative overflow-hidden rounded-[24px] border p-5 md:p-6 ${cardSurfaceCls}`}>
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-24 w-40 translate-y-8 rounded-full bg-white/10 blur-2xl" />
      </div>
      <div className="pointer-events-none absolute right-4 top-4 h-16 w-16 rounded-2xl border border-white/20 bg-white/10 opacity-40 blur-[1px]" />
      <div className="flex items-start gap-3">
        <div
          className={
            `relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-sm ${
              accent === "indigo"
                ? "border-white/20 bg-white/12 text-white"
                : accent === "amber"
                  ? "border-white/55 bg-white/68 text-amber-900"
                  : accent === "red"
                    ? "border-white/55 bg-white/72 text-red-700"
                    : accent === "emerald"
                      ? "border-emerald-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(236,253,245,0.92)_100%)] text-emerald-700"
                      : "border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,244,245,0.92)_100%)] text-zinc-700"
            }`
          }
        >
          <span
            className={`pointer-events-none absolute inset-0 ${
              accent === "indigo"
                ? "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_52%)]"
                : accent === "amber"
                  ? "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_52%)]"
                  : accent === "red"
                    ? "bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_52%)]"
                    : accent === "emerald"
                      ? "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_52%)]"
                      : "bg-[radial-gradient(circle_at_top_left,rgba(161,161,170,0.12),transparent_52%)]"
            }`}
          />
          <span className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full bg-white/35 blur-[1px]" />
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${titleCls}`}>{props.title}</div>
          <div className={valueCls}>            
            {props.value}
          </div>
          {props.subline ? <div className={`mt-3 text-[12px] leading-5 ${subCls}`}>{props.subline}</div> : null}
          {props.footnote ? <div className={`mt-2 text-[11px] ${subCls}`}>{props.footnote}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardHomeData();
  const daily = data.kpi.dailyCoverage;
  const needsRecompute = daily.computedRows < daily.expectedEmployees;

  // actions.severity anomaly summary
  const sev = (data.actions as any)?.severity ?? { high: 0, medium: 0, low: 0 };

  // UI-only: last event relative minutes (demo-like)
  const sinceLastEvent =
    data.kpi.lastEventAt
      ? Math.max(
          0,
          Math.round(
            DateTime.now()
              .setZone(data.tz)
              .diff(DateTime.fromJSDate(data.kpi.lastEventAt).setZone(data.tz), "minutes")
              .minutes
          )
        )
      : null;

  // UI-only: day status message (no rule changes; just interpretation)
  const hasAnyAction = (data.actions?.items?.length ?? 0) > 0;
  const deviceConfigured = (data.health?.deviceTotal ?? 0) > 0;
  const deviceAllOffline =
    deviceConfigured && (data.health?.deviceOnline ?? 0) === 0 && (data.health?.deviceOffline ?? 0) > 0;
  const noEventsToday = Number(data.kpi.todayEventCount ?? 0) === 0;
  const hasAnomaly = Number(data.kpi.anomalyCount ?? 0) > 0;

  let dayTone: "ok" | "warn" | "danger" = "ok";
  if (needsRecompute || hasAnomaly) dayTone = hasAnomaly ? "danger" : "warn";
  else if (noEventsToday && deviceAllOffline) dayTone = "warn";

  const dayTitle =
    dayTone === "danger"
      ? "Bugün kritik durum var"
      : dayTone === "warn"
        ? "Bugün kontrol gerektiren durum var"
        : "Bugün sistem normal çalışıyor";

  const dayDesc =
    dayTone === "danger"
      ? "Anomali veya operasyonel risk tespit edildi. Öncelik: Daily raporu kontrol edin."
      : dayTone === "warn"
        ? needsRecompute
          ? "Daily hesaplama tüm personeller için tamamlanmamış görünüyor. Recompute çalıştırmanız gerekebilir."
          : noEventsToday && deviceAllOffline
            ? "Bugün turnikeden ham kayıt gelmiyor ve cihazlar offline görünüyor. Cihaz bağlantısını kontrol edin."
            : "Bugün bazı uyarılar var. Aksiyon listesini gözden geçirmeniz önerilir."
        : hasAnyAction
          ? "Aksiyon listesinde bilgilendirme amaçlı maddeler olabilir. Göz atmanız önerilir."
          : "Anomali yok, günlük akış stabil. Detay için raporlara geçebilirsiniz.";

  return (
    <AppShell
      title="Kontrol Paneli"
      subtitle={`${data.company.name} • ${data.todayLocal} • TZ: ${data.tz}`}
    >
      {/* Page intro (micro-guidance) */}
      <section className="mb-4 text-[13px] text-zinc-500">
        Bu ekran günün özetini gösterir. Sorun varsa önce <span className="font-medium">Günlük Durum</span> raporuna bakın.
      </section>
      {/* DAY STATUS STRIP (UI-only, no layout/scroll changes) */}
      <section className={`rounded-[26px] border px-5 py-5 md:px-6 md:py-6 ${dayStripBg(dayTone)}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={dayTone}>
                {dayTone === "danger" ? "KRİTİK" : dayTone === "warn" ? "UYARI" : "OK"}
              </Badge>
              <div className="text-[17px] font-semibold tracking-tight text-zinc-900">{dayTitle}</div>
            </div>
            <div className="mt-2 max-w-3xl text-[13px] leading-6 text-zinc-600">{dayDesc}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/reports/daily"
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                dayTone === "danger"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : dayTone === "warn"
                    ? "bg-amber-600 text-white shadow-sm hover:bg-amber-700"
                    : "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
              }`}
              title="Günlük hesaplama sonuçlarını ve anomalileri incele"
            >
              Günlük Durumu Aç
            </a>
            <a
              href="/events"
              className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 text-xs shadow-sm hover:bg-zinc-50"
              title="Ham IN/OUT kayıtlarını incele"
            >
              Ham Kayıtlar
            </a>
            <a
              href="/org"
              className="rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2 text-xs shadow-sm hover:bg-zinc-50"
              title="Şube/kapı/cihaz yapılandırması"
            >
              Organizasyon Yapısı
            </a>
          </div>
        </div>
      </section>
      {/* KPI GRID */}
      {/*
        Zoom-friendly responsive behavior:
        - Avoid forcing 4 columns at md (zoom ~175% can make cards look broken)
        - Prefer: 1 col -> 2 cols (2x2) -> 4 cols only on very wide screens
      */}
      <section className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Aktif Personel"
          icon={<KpiIcon kind="people" />}
          value={data.kpi.employeeCount}
          accent="emerald"
          subline={
            Number(data.kpi.employeeCount ?? 0) === 0
              ? "Henüz personel yok (demo/kurulum aşaması olabilir)"
              : "Bugün için takip edilen aktif personel sayısı"
          }
        />

        <KpiCard
          title="Ham Geçiş"
          icon={<KpiIcon kind="events" />}
          value={data.kpi.todayEventCount}
          accent={noEventsToday && deviceAllOffline ? "amber" : "zinc"}
          subline={
            noEventsToday
              ? deviceConfigured
                ? deviceAllOffline
                  ? "Bugün ham kayıt yok • cihazlar offline görünüyor"
                  : "Bugün ham kayıt yok • normal olabilir (vardiya/mesai dışı)"
                : "Bugün ham kayıt yok • henüz cihaz tanımlı değil"
              : "Bugün turnikeden gelen ham geçiş sayısı"
          }
        />

        <KpiCard
          title="Son Olay Zamanı"
          icon={<KpiIcon kind="clock" />}
          value={fmt(data.kpi.lastEventAt, data.tz)}
          accent="amber"
          valueClassName="mt-2 text-lg font-semibold"
          subline={sinceLastEvent != null ? `Son olaydan bu yana: ${sinceLastEvent}dk` : "—"}
        />

        <KpiCard
          title="Anomali (Bugün)"
          icon={<KpiIcon kind="warn" />}
          value={data.kpi.anomalyCount}
          tone="danger"
          accent="red"
          subline={
            <>
              Yüksek: <span className="font-semibold">{data.kpi.highAnomalyCount}</span>
              {" • "}
              Hesap:{" "}
              <span className="font-semibold">
                {data.kpi.dailyCoverage.computedRows}/{data.kpi.dailyCoverage.expectedEmployees}
              </span>
            </>
          }
          footnote={`Son hesap: ${fmt(data.kpi.dailyComputedAt ?? null, data.tz)}`}
        />
      </section>

      {/* MAIN GRID */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Action Needed */}
        <div
          className={[
            "relative overflow-hidden",
            sectionCardCls("p-4 lg:col-span-1"),
            "border-indigo-200/70",
            "bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,247,255,0.97)_100%)]",
            "shadow-[0_14px_34px_rgba(79,70,229,0.08)]",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-200/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-40 rounded-full bg-sky-200/10 blur-3xl" />
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-zinc-900">Aksiyon Bekleyenler</div>
              <div className="mt-2 text-[13px] leading-5 text-zinc-500">Bugün için tespit edilen uyarılar ve yapılacaklar</div>
              {(sev.high ?? 0) + (sev.medium ?? 0) + (sev.low ?? 0) > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(sev.high ?? 0) > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                      Yüksek: {sev.high}
                    </span>
                  ) : null}
                  {(sev.medium ?? 0) > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                      Orta: {sev.medium}
                    </span>
                  ) : null}
                  {(sev.low ?? 0) > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700">
                      Düşük: {sev.low}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <a
              href="/reports/daily"
              className="shrink-0 rounded-xl border border-zinc-300/70 bg-white px-3 py-2 text-xs shadow-sm hover:bg-zinc-50"
              title="Tüm günlük sonuçları ve anomalileri incele"
            >
              Günlük Rapor
            </a>
          </div>

          <div className="mt-2 text-[12px] leading-5 text-zinc-500">Not: Bu liste gün sonu (Daily) hesaplamasına dayanır.</div>

          {needsRecompute ? (
              <div className="mt-3 rounded-2xl border border-amber-300/65 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.90)_100%)] p-3 text-sm shadow-[0_8px_18px_rgba(245,158,11,0.08)] ring-1 ring-white/60">
                <div className="font-medium">Günlük hesaplama eksik</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-600">
                  Hesaplanan: {daily.computedRows}/{daily.expectedEmployees}. Daily sayfasından{" "}
                  <span className="font-medium">Recompute</span> çalıştırmanız gerekebilir.
                </div>
                <a className="mt-2 inline-block text-xs underline" href="/reports/daily">
                  Daily Rapor’a Git
                </a>
              </div>
            ) : null}

          {/* List (fixed height + hidden scrollbar) */}
          <div className="mt-4">
            <div className="max-h-[260px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid gap-2.5">
                {data.actions.items.length === 0 ? (
                  <div className="rounded-2xl border border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(238,242,255,0.88)_100%)] p-4 shadow-[0_10px_22px_rgba(79,70,229,0.06)] ring-1 ring-white/70">
                    <div className="text-lg font-semibold tracking-tight text-zinc-900">Aksiyon yok</div>
                    <div className="mt-1 text-[13px] leading-6 text-zinc-600">
                      Bugün için operasyonel aksiyon gerektiren bir anomali görünmüyor.
                    </div>
                    <a
                      className="mt-3 inline-flex items-center justify-center rounded-xl border border-indigo-200/80 bg-white/85 px-3 py-2 text-xs font-semibold text-indigo-900 shadow-sm transition-colors hover:bg-indigo-50/80"
                      href="/reports/daily"
                    >
                      Daily rapora göz at →
                    </a>
                  </div>
                ) : (
                  data.actions.items.slice(0, 8).map((it: any, idx: number) => (
              <div
                key={`${String(it.id ?? "action")}-${idx}`}
                className="rounded-2xl border border-indigo-200/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,247,255,0.92)_100%)] p-3 shadow-[0_8px_18px_rgba(79,70,229,0.05)] ring-1 ring-white/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold tracking-tight text-zinc-900">{it.title}</div>
                    {it.detail ? (
                      <div className="mt-1 text-[12px] leading-5 text-zinc-500">{it.detail}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold">
                      {it.count}
                    </span>
                    <a
                      className="inline-flex items-center justify-center rounded-lg border border-indigo-200/70 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-900 shadow-sm transition-colors hover:bg-indigo-50/80"
                      href={it.href}
                    >
                      Aç
                    </a>
                  </div>
                </div>
              </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer CTA */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                Gösterilen: {Math.min(8, data.actions.items.length)} / {data.actions.items.length}
              </span>
              <a
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300/70 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
                href="/reports/daily"
              >
                Tüm aksiyonları gör →
              </a>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className={[
            "relative overflow-hidden",
            sectionCardCls("p-4 lg:col-span-2"),
            "border-sky-200/70",
            "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,255,0.97)_100%)]",
            "shadow-[0_14px_34px_rgba(14,165,233,0.08)]",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute -right-8 top-0 h-32 w-40 rounded-full bg-sky-200/20 blur-3xl" />
          <div className="pointer-events-none absolute left-0 top-0 h-24 w-32 rounded-full bg-indigo-200/10 blur-3xl" />
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold tracking-tight text-zinc-900">Son Olaylar</div>
              <div className="text-[13px] leading-5 text-zinc-500">
                En son gerçekleşen geçiş kayıtları (izleme amaçlı)
              </div>
            </div>
            <a
              href="/events"
              className="rounded-xl border border-sky-200/80 bg-white/95 px-3 py-2 text-sm shadow-sm hover:bg-sky-50/60"
            >
              Tüm Kayıtlar
            </a>
          </div>

          {/* Table region (fixed height + hidden scrollbar) */}
          <div className="mt-5 rounded-2xl border border-sky-100/80 bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="max-h-[320px] overflow-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  <th className="border-b border-zinc-300/70 pb-3">Zaman</th>
                  <th className="border-b border-zinc-300/70 pb-3">Personel</th>
                  <th className="border-b border-zinc-300/70 pb-3">Kapı/Cihaz</th>
                  <th className="border-b border-zinc-300/70 pb-3">Yön</th>
                  <th className="border-b border-zinc-300/70 pb-3">Kaynak</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.length === 0 ? (
                  <tr>
                    <td className="py-4 text-zinc-500" colSpan={5}>
                      Henüz olay yok.
                    </td>
                  </tr>
                ) : (
                  data.recentEvents.map((ev) => (
                    <tr key={ev.id} className="border-b border-sky-100/80 transition-colors hover:bg-sky-50/50">
                      <td className="py-3.5">
                        {DateTime.fromJSDate(ev.occurredAt).setZone(data.tz).toFormat("dd LLL HH:mm")}
                      </td>
                      <td className="py-3.5">
                        <span className="font-medium">{ev.employee.employeeCode}</span>{" "}
                        <span className="text-zinc-600">
                          {ev.employee.firstName} {ev.employee.lastName}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {ev.door ? `${ev.door.code} • ${ev.door.name}` : "—"}
                        {ev.device?.name ? (
                          <div className="text-xs text-zinc-500">{ev.device.name}</div>
                        ) : null}
                      </td>
                      <td className="py-3.5">
                      <Pill tone={ev.direction === "IN" ? "good" : "warn"}>{ev.direction}</Pill>
                    </td>
                    <td className="py-3.5">
                      <Pill tone={ev.source === "DEVICE" ? "info" : "neutral"}>{ev.source}</Pill>
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <a
              className="flex w-full items-center justify-center rounded-xl border border-emerald-300/70 bg-[linear-gradient(180deg,rgba(16,185,129,0.96)_0%,rgba(5,150,105,0.96)_100%)] px-3 py-2.5 text-center text-sm font-semibold text-white shadow-[0_10px_20px_rgba(16,185,129,0.18)] transition-colors hover:bg-[linear-gradient(180deg,rgba(5,150,105,0.98)_0%,rgba(4,120,87,0.98)_100%)]"
              href="/events"
              title="Hızlı manuel IN/OUT ekle (demo/operasyon)"
            >
              Manuel Olay Ekle
            </a>
            <a
              className="flex w-full items-center justify-center rounded-xl border border-indigo-200/80 bg-[linear-gradient(180deg,rgba(238,242,255,0.98)_0%,rgba(224,231,255,0.96)_100%)] px-3 py-2.5 text-center text-sm font-semibold text-indigo-900 shadow-[0_8px_18px_rgba(79,70,229,0.08)] transition-colors hover:bg-[linear-gradient(180deg,rgba(224,231,255,1)_0%,rgba(199,210,254,0.96)_100%)]"
              href="/employees"
              title="Personel listesi ve 360 görünüm"
            >
              Personel Yönet
            </a>
            <a
              className="flex w-full items-center justify-center rounded-xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.96)_100%)] px-3 py-2.5 text-center text-sm font-semibold text-amber-900 shadow-[0_8px_18px_rgba(245,158,11,0.08)] transition-colors hover:bg-[linear-gradient(180deg,rgba(254,243,199,1)_0%,rgba(253,230,138,0.96)_100%)]"
              href="/admin/company"
              title="Policy / timezone / kural setleri"
            >
              Şirket & Politika
            </a>
            <a
              className="flex w-full items-center justify-center rounded-xl border border-sky-200/80 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(224,242,254,0.96)_100%)] px-3 py-2.5 text-center text-sm font-semibold text-sky-900 shadow-[0_8px_18px_rgba(14,165,233,0.08)] transition-colors hover:bg-[linear-gradient(180deg,rgba(224,242,254,1)_0%,rgba(186,230,253,0.96)_100%)]"
              href="/reports/daily"
              title="Günlük sonuçlar ve recompute"
            >
              Günlük Rapor
            </a>
          </div>
        </div>
      </section>

      {/* System Health */}
      <section className={`mt-4 ${sectionCardCls("p-4")}`}>
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold tracking-tight text-zinc-900">Cihaz & Senkron</div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            IT
          </span>
        </div>
        <div className="mt-1 text-[13px] leading-5 text-zinc-500">
          Cihaz bağlantı durumu ve veri senkronizasyon özeti.
        </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <Pill tone="neutral">Bilgi</Pill>
          <span>Henüz cihaz eklenmediyse değerlerin 0 görünmesi normaldir.</span>
        </div>

        {/*
          Same zoom-friendly rule for System Health tiles:
          1 col -> 2 cols -> 4 cols only on very wide screens.
        */}
        <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-300/65 bg-[linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(244,244,245,0.82)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <div className="text-xs text-zinc-500">Toplam Cihaz</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceTotal}</div>
          </div>

          <div className="rounded-2xl border border-emerald-300/60 bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(16,185,129,0.055)] ring-1 ring-white/60">
            <div className="text-xs text-zinc-500">Online</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceOnline}</div>
          </div>

          <div className="rounded-2xl border border-amber-300/60 bg-[linear-gradient(180deg,rgba(255,251,235,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(245,158,11,0.055)] ring-1 ring-white/60">
            <div className="text-xs text-zinc-500">Offline</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceOffline}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Eşik: {data.health.offlineThresholdMinutes} dk
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-300/55 bg-[linear-gradient(180deg,rgba(238,242,255,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(79,70,229,0.055)] ring-1 ring-white/60">
            <div className="text-xs text-zinc-500">Son Sync</div>
            <div className="mt-1 text-sm font-semibold">{fmt(data.health.lastSyncAt ?? null, data.tz)}</div>
          </div>
        </div>
      </section>

      {/* Live Feed & Summary */}
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Live Feed */}
        <div className={`${sectionCardCls("p-4")} flex flex-col md:h-[560px]`}>
          <LiveFeedClient tz={data.tz} />
        </div>
        {/* Daily Summary + Branch Summary */}
        <div className={`${sectionCardCls("p-4")} flex flex-col md:h-[560px]`}>
          {/* Daily Summary */}
          <div className="text-lg font-semibold tracking-tight text-zinc-900">Günlük Durum Özeti</div>
          <div className="mt-1 text-[13px] leading-5 text-zinc-500">
            Bugünün günlük raporundan hızlı özet (kayıt sayısı)
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-2xl border border-emerald-300/60 bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(16,185,129,0.055)] ring-1 ring-white/60">
              <div className="text-xs text-emerald-700">Çalıştı</div>
              <div className="mt-1 text-xl font-semibold text-emerald-800">{data.kpi.dailySummary.present}</div>
            </div>
            <div className="rounded-2xl border border-zinc-300/65 bg-[linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(244,244,245,0.82)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div className="text-xs text-zinc-600">Gelmedi</div>
              <div className="mt-1 text-xl font-semibold">{data.kpi.dailySummary.absent}</div>
            </div>
            <div className="rounded-2xl border border-indigo-300/55 bg-[linear-gradient(180deg,rgba(238,242,255,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(79,70,229,0.055)] ring-1 ring-white/60">
              <div className="text-xs text-indigo-700">OFF</div>
              <div className="mt-1 text-xl font-semibold text-indigo-800">{data.kpi.dailySummary.off}</div>
            </div>
            <div className="rounded-2xl border border-red-300/60 bg-[linear-gradient(180deg,rgba(254,242,242,0.95)_0%,rgba(255,255,255,0.98)_100%)] p-3 shadow-[0_8px_16px_rgba(239,68,68,0.055)] ring-1 ring-white/60">
              <div className="text-xs text-red-700">Eksik Punch</div>
              <div className="mt-1 text-xl font-semibold text-red-800">{data.kpi.dailySummary.missingPunch}</div>
            </div>
          </div>
         <div className="mt-4 text-[12px] leading-5 text-zinc-500">
            Bu bilgiler günlük rapordaki kayıt sayısından hesaplanır.
            <a className="ml-1 underline" href="/reports/daily">
              Detaylar
            </a>
          </div>
          {/* Branch Summary (scroll area) */}
          <div className="mt-6 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-lg font-semibold tracking-tight text-zinc-900">Şubeler & Kapılar</div>
            <div className="mt-1 text-[13px] leading-5 text-zinc-500">
              Bugün için şube/kapı/cihaz özetleri. Detay için organizasyon sayfasına gidin.
            </div>
            <div className="mt-3 space-y-2">
              {data.branchSummary.length === 0 ? (
                <div className="text-xs text-zinc-500">Henüz şube tanımlı değil.</div>
              ) : (
                data.branchSummary.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-300/65 bg-[linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(244,244,245,0.82)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                  >
                    <div>
                      <div className="text-sm font-medium">{b.name}</div>
                      <div className="text-xs text-zinc-500">{b.code}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-600">
                      Kapı: <span className="font-semibold">{b.doorCount}</span>
                      <br />
                      Cihaz: <span className="font-semibold">{b.deviceCount}</span>
                      <br />
                      Geçiş: <span className="font-semibold">{b.eventCount}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
