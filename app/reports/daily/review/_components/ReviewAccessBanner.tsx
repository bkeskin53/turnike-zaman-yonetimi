import { PillBadge, cx, toneStyles } from "../../_components/dailyShared";

export default function ReviewAccessBanner({ role }: { role: string }) {
  return (
    <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-extrabold tracking-tight text-zinc-900">Daily Review Operasyonu</div>
            <PillBadge tone="violet">Review</PillBadge>
            <PillBadge tone="neutral">Role: {role}</PillBadge>
          </div>
          <div className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
            Bu ekran yalnızca review akışı içindir. Varsayılan görünüm review bekleyen satırları açar; teknik çözümleme için detail ekranına geçebilirsin.
          </div>
        </div>
      </div>
    </div>
  );
}
