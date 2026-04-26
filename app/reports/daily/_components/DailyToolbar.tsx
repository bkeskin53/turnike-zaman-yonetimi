import type { KeyboardEvent } from "react";
import DailySummaryChips from "./DailySummaryChips";
import { Button, cx, PillBadge } from "./dailyShared";

type DayViewFilter = "ALL" | "SCHEDULED" | "UNSCHEDULED";

export default function DailyToolbar({
  date,
  setDate,
  onToolbarKeyDown,
  onRecompute,
  canRecompute,
  loadingRecompute,
  onRefresh,
  loading,
  summary,
  dayViewFilter,
  setDayViewFilter,
  visibleCount,
  totalCount,
}: {
  date: string;
  setDate: (value: string) => void;
  onToolbarKeyDown: (e: KeyboardEvent) => void;
  onRecompute: () => void;
  canRecompute: boolean;
  loadingRecompute: boolean;
  onRefresh: () => void;
  loading: boolean;
  summary: {
    PRESENT: number;
    ABSENT: number;
    OFF: number;
    LEAVE: number;
    MISSING_PUNCH: number;
    PENDING_REVIEW: number;
  };
  dayViewFilter: DayViewFilter;
  setDayViewFilter: (value: DayViewFilter) => void;
  visibleCount: number;
  totalCount: number;
}) {
  const segmentBase =
    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all duration-200";

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-violet-200/70 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_26%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-violet-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-sky-300/10 blur-3xl" />

      <div className="relative grid gap-5">
        <div className="grid gap-4">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <PillBadge tone="violet">Daily Command Center</PillBadge>
              <PillBadge tone={canRecompute ? "good" : "warn"}>
                {canRecompute ? "Recompute Açık" : "Salt Okunur"}
              </PillBadge>
              <PillBadge tone="info">Export Hazır</PillBadge>
            </div>

            <div className="grid gap-2">
              <div className="text-[26px] font-black tracking-tight text-zinc-950">
                Günlük sonuçlar için operasyon paneli
              </div>
              <div className="max-w-3xl text-sm leading-5 text-zinc-600">
                Gün seç, yenile, yeniden hesapla ve çıktıyı al. Review ve teknik çözümleme ayrı modüllerde yönetilir.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
              <label className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Tarih</span>
                <input
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-violet-300 focus:bg-white"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={onToolbarKeyDown}
                />
              </label>

              <div className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Aksiyonlar</div>
                  <div className="text-xs text-zinc-500">Seçili gün: <span className="font-semibold text-zinc-700">{date}</span></div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button
                    variant="primary"
                    onClick={onRecompute}
                    disabled={loadingRecompute || !canRecompute}
                    title={!canRecompute ? "Bu rolde Yeniden Hesapla yetkisi yok" : "Seçili gün için günlük hesaplamayı yeniden üretir"}
                  >
                    {loadingRecompute ? "Hesaplanıyor…" : "Yeniden Hesapla"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Seçili günün son hesaplanmış verisini getir"
                  >
                    {loading ? "Yükleniyor…" : "Yenile"}
                  </Button>

                  <a
                    href={`/api/reports/daily/export?date=${encodeURIComponent(date)}`}
                    className={
                      "inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 " +
                      (loading ? "pointer-events-none opacity-50" : "")
                    }
                    title="CSV indir (Excel)"
                  >
                    Günlük CSV
                  </a>

                  <a
                    href={`/api/reports/anomalies/export?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                    title="Bu günün anomalilerini CSV indir (Excel)"
                  >
                    Anomali CSV
                  </a>
                </div>
              </div>
            </div>
          </div>

          <details className="group rounded-[24px] border border-violet-200/70 bg-[linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.9))] shadow-[0_18px_36px_rgba(139,92,246,0.10)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Analitik Panel</div>
                <div className="mt-1 text-lg font-bold tracking-tight text-zinc-950">Günlük özet ve durum kümeleri</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Review, anomaly ve çalışan dağılımını görmek için aç
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm">
                  {visibleCount} / {totalCount} satır
                </span>

                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200 bg-white/80 text-violet-700 shadow-sm transition group-open:rotate-180">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </summary>

            <div className="grid gap-3 px-4 pb-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Review</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-violet-700">{summary.PENDING_REVIEW}</div>
                    <div className="mt-1 text-xs text-zinc-500">Karar bekleyen kayıt</div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Eksik Punch</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-amber-700">{summary.MISSING_PUNCH}</div>
                    <div className="mt-1 text-xs text-zinc-500">Anomali izleme</div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Durum Kümeleri</div>
                    <div className="mt-1 text-sm leading-5 text-zinc-600">
                      Günün çalışan dağılımı ve anomaly yoğunluğu.
                    </div>
                  </div>

                  <DailySummaryChips summary={summary} />
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200/70 bg-white/75 px-4 py-3 text-xs leading-5 text-zinc-600">
                Tarih değiştiğinde liste otomatik yenilenmez. Seçili günün son hesaplanmış verisini görmek için
                <span className="font-semibold text-zinc-800"> Yenile</span> kullanın. Yeniden hesaplama yetkiniz varsa aynı karttan
                doğrudan tetikleyebilirsiniz.
              </div>
            </div>
          </details>
        </div>

      <div className="grid gap-4 xl:grid-cols-1 xl:items-start">
          <div className="grid gap-3 rounded-[24px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Gün Görünümü</div>
                <div className="mt-1 text-lg font-bold tracking-tight text-zinc-950">Filtrelenmiş çalışma görünümü</div>
              </div>
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                Görünen {visibleCount} / Toplam {totalCount}
              </div>
            </div>

          <div className="text-sm leading-5 text-zinc-600">
              Tüm, planlı veya plansız gün görünümüne hızlı geç.
            </div>

            <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-1.5">
              <button
                type="button"
                onClick={() => setDayViewFilter("ALL")}
                className={cx(
                  segmentBase,
                  dayViewFilter === "ALL"
                    ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200"
                    : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"
                )}
              >
                Tümü
              </button>

              <button
                type="button"
                onClick={() => setDayViewFilter("SCHEDULED")}
                className={cx(
                  segmentBase,
                  dayViewFilter === "SCHEDULED"
                    ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                    : "text-zinc-600 hover:bg-white/70 hover:text-emerald-700"
                )}
              >
                Planlı Gün
              </button>

              <button
                type="button"
                onClick={() => setDayViewFilter("UNSCHEDULED")}
                className={cx(
                  segmentBase,
                  dayViewFilter === "UNSCHEDULED"
                    ? "bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-200"
                    : "text-zinc-600 hover:bg-white/70 hover:text-amber-800"
                )}
              >
                Plansız Gün
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}