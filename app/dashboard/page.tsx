import AppShell from "@/app/_components/AppShell";
import { DateTime } from "luxon";
import { getDashboardHomeData } from "@/src/services/dashboardHome.service";

function fmt(dt: Date | null, tz: string) {
  if (!dt) return "—";
  return DateTime.fromJSDate(dt).setZone(tz).toFormat("dd LLL yyyy HH:mm");
}

export default async function DashboardPage() {
  const data = await getDashboardHomeData();

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${data.company.name} • ${data.todayLocal} • TZ: ${data.tz}`}
    >
      {/* KPI GRID */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-500">Aktif Personel</div>
          <div className="mt-2 text-2xl font-semibold">{data.kpi.employeeCount}</div>
          <div className="mt-2 text-xs text-zinc-500">İK / operasyon görünümü</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-500">Bugün Olay</div>
          <div className="mt-2 text-2xl font-semibold">{data.kpi.todayEventCount}</div>
          <div className="mt-2 text-xs text-zinc-500">Ham olay sayısı (turnike)</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-500">Son Çekim</div>
          <div className="mt-2 text-lg font-semibold">{fmt(data.kpi.lastEventAt, data.tz)}</div>
          <div className="mt-2 text-xs text-zinc-500">Şimdilik “son olay zamanı”</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-xs text-zinc-500">Anomali</div>
          <div className="mt-2 text-2xl font-semibold">{data.kpi.anomalyCount}</div>
          <div className="mt-2 text-xs text-zinc-500">Daily tablosu doluysa görünür</div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Action Needed */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-1">
          <div className="text-sm font-semibold">Aksiyon Bekleyenler</div>
          <div className="mt-1 text-xs text-zinc-500">
            İlk %20: placeholder. Sonra tanımsız kart / eksik çıkış / policy ihlalleri buraya düşecek.
          </div>

          <div className="mt-4 grid gap-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              Tanımsız kart okutma: <span className="font-semibold">yakında</span>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              Eksik çıkış (açık gün): <span className="font-semibold">yakında</span>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              Policy çakışması: <span className="font-semibold">yakında</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Son Olaylar</div>
              <div className="text-xs text-zinc-500">Ham veri akışı (son 10 kayıt)</div>
            </div>
            <a
              href="/events"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Tümünü Aç
            </a>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="border-b border-zinc-200 pb-2">Zaman</th>
                  <th className="border-b border-zinc-200 pb-2">Personel</th>
                  <th className="border-b border-zinc-200 pb-2">Dir</th>
                  <th className="border-b border-zinc-200 pb-2">Kaynak</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.length === 0 ? (
                  <tr>
                    <td className="py-4 text-zinc-500" colSpan={4}>
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
                      <td className="py-3">{ev.direction}</td>
                      <td className="py-3">{ev.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800" href="/events">
              Manuel Olay Ekle
            </a>
            <a className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/employees">
              Personel Yönet
            </a>
            <a className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/admin/company">
              Company & Policy
            </a>
            <a className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50" href="/reports/daily">
              Günlük Rapor
            </a>
          </div>
        </div>
      </section>

      {/* System Health placeholder */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Sistem Sağlığı (IT)</div>
        <div className="mt-1 text-xs text-zinc-500">
          İlk %20: Cihaz modeli henüz eklenmedi. Cihazlar eklendiğinde burada online/offline, son çekim ve hata
          sayıları gösterilecek.
        </div>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          Durum: <span className="font-semibold">Cihaz modülü bekleniyor</span> • Şimdilik veri kaynağı: MANUAL events
        </div>
      </section>
    </AppShell>
  );
}
