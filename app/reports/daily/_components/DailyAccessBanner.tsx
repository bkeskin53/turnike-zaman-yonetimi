import { PillBadge, cx, toneStyles } from "./dailyShared";

export default function DailyAccessBanner({ canRecompute, role }: { canRecompute: boolean; role: string }) {
  return (
    <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles(canRecompute ? "violet" : "warn").soft)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-extrabold tracking-tight text-zinc-900">Günlük Sonuçlar</div>
            <PillBadge tone="violet">Daily</PillBadge>
            <PillBadge tone="neutral">Role: {role}</PillBadge>
            {!canRecompute ? <PillBadge tone="warn">Salt Okunur</PillBadge> : <PillBadge tone="good">Yeniden Hesaplama açık</PillBadge>}
          </div>
          <div className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
            Bu ekran yalnızca günlük sonuçları ve özet metrikleri gösterir. Review operasyonu ayrı ekrana taşındı; teknik detay artık ayrı detail route'unda açılır.
          </div>
          {!canRecompute ? (
            <div className="mt-2 text-[11px] text-amber-900/80">
              Not: Görülen sonuçlar en son yapılan hesaplama çıktısıdır. Güncelleme için yetkili bir rol ile yeniden hesaplama gerekir.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
