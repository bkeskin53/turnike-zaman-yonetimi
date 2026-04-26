import { PillBadge, cx, toneStyles } from "../../../_components/dailyShared";

export default function DetailAccessBanner({ role, canRecompute }: { role: string; canRecompute: boolean }) {
  return (
    <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("info").soft)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-extrabold tracking-tight text-zinc-900">Daily Teknik Detay</div>
            <PillBadge tone="info">Detail</PillBadge>
            <PillBadge tone="neutral">Role: {role}</PillBadge>
            {canRecompute ? <PillBadge tone="good">Recompute açık</PillBadge> : <PillBadge tone="warn">Salt okunur</PillBadge>}
          </div>
          <div className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
            Bu ekran tek satırlık teknik çözümleme içindir. Zaman, kural kaynağı ve issue açıklamaları burada toplanır.
          </div>
        </div>
      </div>
    </div>
  );
}
