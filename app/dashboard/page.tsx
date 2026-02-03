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
}) {
  const tone = props.tone ?? "default";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={
            tone === "danger"
              ? "grid h-10 w-10 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600"
              : "grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700"
          }
        >
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">{props.title}</div>
          <div
            className={
              props.valueClassName
                ? props.valueClassName
                : tone === "danger"
                  ? "mt-2 text-3xl font-semibold text-red-600"
                  : "mt-2 text-3xl font-semibold"
            }
          >            
          {props.value}
          </div>
          {props.subline ? <div className="mt-2 text-xs text-zinc-500">{props.subline}</div> : null}
          {props.footnote ? <div className="mt-1 text-xs text-zinc-500">{props.footnote}</div> : null}
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
      title="Dashboard"
      subtitle={`${data.company.name} • ${data.todayLocal} • TZ: ${data.tz}`}
    >
      {/* Page intro (micro-guidance) */}
      <section className="mb-3 text-xs text-zinc-500">
        Bu ekran günün operasyonel özetini gösterir. Detaylı inceleme ve müdahale için raporları kullanabilirsiniz.
      </section>
      {/* DAY STATUS STRIP (UI-only, no layout/scroll changes) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={dayTone}>
                {dayTone === "danger" ? "KRİTİK" : dayTone === "warn" ? "UYARI" : "OK"}
              </Badge>
              <div className="text-sm font-semibold">{dayTitle}</div>
            </div>
            <div className="mt-1 text-xs text-zinc-500">{dayDesc}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/reports/daily"
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                dayTone === "danger"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : dayTone === "warn"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
              title="Günlük hesaplama sonuçlarını ve anomalileri incele"
            >
              Günlük Durumu Aç
            </a>
            <a
              href="/events"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50"
              title="Ham IN/OUT kayıtlarını incele"
            >
              Ham Kayıtlar
            </a>
            <a
              href="/org"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50"
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
          subline={
            Number(data.kpi.employeeCount ?? 0) === 0
              ? "Henüz personel yok (demo/kurulum aşaması olabilir)"
              : "Bugün için takip edilen aktif personel sayısı"
          }
        />

        <KpiCard
          title="Bugün Olay"
          icon={<KpiIcon kind="events" />}
          value={data.kpi.todayEventCount}
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
          valueClassName="mt-2 text-lg font-semibold"
          subline={sinceLastEvent != null ? `Son olaydan bu yana: ${sinceLastEvent}dk` : "—"}
        />

        <KpiCard
          title="Anomali (Bugün)"
          icon={<KpiIcon kind="warn" />}
          value={data.kpi.anomalyCount}
          tone="danger"
          subline={
            <>
              Yüksek: <span className="font-semibold">{data.kpi.highAnomalyCount}</span>
              {" • "}
              Daily:{" "}
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-1">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Aksiyon Bekleyenler</div>
              <div className="mt-2 text-xs text-zinc-500">
            Bugün için tespit edilen operasyonel uyarılar
              </div>
            </div>
            <a
              href="/reports/daily"
              className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50"
              title="Tüm günlük sonuçları ve anomalileri incele"
            >
              Günlük Rapor
            </a>
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            Bugün için anomali ve operasyon aksiyonları (Daily hesaplamasına dayanır).
          </div>

          {needsRecompute ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="font-medium">Günlük hesaplama eksik</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Computed: {daily.computedRows}/{daily.expectedEmployees}. Daily sayfasından{" "}
                  <span className="font-medium">Recompute</span> çalıştır.
                </div>
                <a className="mt-2 inline-block text-xs underline" href="/reports/daily">
                  Daily Rapor’a Git
                </a>
              </div>
            ) : null}

          {/* List (fixed height + hidden scrollbar) */}
          <div className="mt-4">
            <div className="max-h-[260px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid gap-2">
                {data.actions.items.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-sm font-medium">Aksiyon yok</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Bugün için operasyonel aksiyon gerektiren bir anomali görünmüyor.
                    </div>
                    <a className="mt-2 inline-block text-xs underline" href="/reports/daily">
                      Daily rapora göz at →
                    </a>
                  </div>
                ) : (
                  data.actions.items.slice(0, 8).map((it: any, idx: number) => (
              <div
                key={`${String(it.id ?? "action")}-${idx}`}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{it.title}</div>
                    {it.detail ? (
                      <div className="text-xs text-zinc-500">{it.detail}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold">
                      {it.count}
                    </span>
                    <a className="text-xs underline text-zinc-700" href={it.href}>
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
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                Gösterilen: {Math.min(8, data.actions.items.length)} / {data.actions.items.length}
              </span>
              <a className="text-zinc-700 underline" href="/reports/daily">
                Tüm aksiyonları gör →
              </a>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Son Olaylar</div>
              <div className="text-xs text-zinc-500">
                En son gerçekleşen geçiş kayıtları (izleme amaçlı)
              </div>
            </div>
            <a
              href="/events"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Tüm Kayıtlar
            </a>
          </div>

          {/* Table region (fixed height + hidden scrollbar) */}
          <div className="mt-4 max-h-[320px] overflow-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="border-b border-zinc-200 pb-2">Zaman</th>
                  <th className="border-b border-zinc-200 pb-2">Personel</th>
                  <th className="border-b border-zinc-200 pb-2">Kapı/Cihaz</th>
                  <th className="border-b border-zinc-200 pb-2">Dir</th>
                  <th className="border-b border-zinc-200 pb-2">Kaynak</th>
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
                    <tr key={ev.id} className="border-b border-zinc-100">
                      <td className="py-3">
                        {DateTime.fromJSDate(ev.occurredAt).setZone(data.tz).toFormat("dd LLL HH:mm")}
                      </td>
                      <td className="py-3">
                        <span className="font-medium">{ev.employee.employeeCode}</span>{" "}
                        <span className="text-zinc-600">
                          {ev.employee.firstName} {ev.employee.lastName}
                        </span>
                      </td>
                      <td className="py-3">
                        {ev.door ? `${ev.door.code} • ${ev.door.name}` : "—"}
                        {ev.device?.name ? (
                          <div className="text-xs text-zinc-500">{ev.device.name}</div>
                        ) : null}
                      </td>
                      <td className="py-3">
                      <Pill tone={ev.direction === "IN" ? "good" : "warn"}>{ev.direction}</Pill>
                    </td>
                    <td className="py-3">
                      <Pill tone={ev.source === "DEVICE" ? "info" : "neutral"}>{ev.source}</Pill>
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <a
            className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              href="/events"
              title="Hızlı manuel IN/OUT ekle (demo/operasyon)"
            >
              Manuel Olay Ekle
            </a>
            <a
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href="/employees"
              title="Personel listesi ve 360 görünüm"
            >
              Personel Yönet
            </a>
            <a
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href="/admin/company"
              title="Policy / timezone / kural setleri"
            >
              Company & Policy
            </a>
            <a
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              href="/reports/daily"
              title="Günlük sonuçlar ve recompute"
            >
              Günlük Rapor
            </a>
          </div>
        </div>
      </section>

      {/* System Health */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Sistem Sağlığı (IT)</div>
        <div className="mt-1 text-xs text-zinc-500">
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
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs text-zinc-500">Toplam Cihaz</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceTotal}</div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs text-zinc-500">Online</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceOnline}</div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs text-zinc-500">Offline</div>
            <div className="mt-1 text-lg font-semibold">{data.health.deviceOffline}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Eşik: {data.health.offlineThresholdMinutes} dk
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs text-zinc-500">Son Sync</div>
            <div className="mt-1 text-sm font-semibold">{fmt(data.health.lastSyncAt ?? null, data.tz)}</div>
          </div>
        </div>
      </section>

      {/* Live Feed & Summary */}
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Live Feed */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col md:h-[560px]">
          <LiveFeedClient tz={data.tz} />
        </div>
        {/* Daily Summary + Branch Summary */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col md:h-[560px]">
          {/* Daily Summary */}
          <div className="text-sm font-semibold">Günlük Durum Özeti</div>
          <div className="mt-1 text-xs text-zinc-500">
            Bugünün Daily raporundan özet (present/absent/off/Missing Punch)
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Present</div>
              <div className="mt-1 text-xl font-semibold">{data.kpi.dailySummary.present}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Absent</div>
              <div className="mt-1 text-xl font-semibold">{data.kpi.dailySummary.absent}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Off</div>
              <div className="mt-1 text-xl font-semibold">{data.kpi.dailySummary.off}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Missing Punch</div>
              <div className="mt-1 text-xl font-semibold">{data.kpi.dailySummary.missingPunch}</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-zinc-500">
            Bu bilgiler Daily rapordaki kayıt sayısından hesaplanır.
            <a className="ml-1 underline" href="/reports/daily">
              Detaylar
            </a>
          </div>
          {/* Branch Summary (scroll area) */}
          <div className="mt-6 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-sm font-semibold">Şubeler & Kapılar</div>
            <div className="mt-1 text-xs text-zinc-500">
              Bugün için şube/kapı/cihaz özetleri. Detay için organizasyon sayfasına gidin.
            </div>
            <div className="mt-3 space-y-2">
              {data.branchSummary.length === 0 ? (
                <div className="text-xs text-zinc-500">Henüz şube tanımlı değil.</div>
              ) : (
                data.branchSummary.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3"
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
