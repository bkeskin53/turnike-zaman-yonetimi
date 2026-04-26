import Link from "next/link";
import { cx } from "./dailyShared";

type Mode = "daily" | "review" | "detail";

export default function DailyModuleNav({
  mode,
  date,
  employeeId,
}: {
  mode: Mode;
  date?: string;
  employeeId?: string;
}) {
  const dailyHref = `/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ""}`;
  const reviewHref = `/reports/daily/review${date ? `?date=${encodeURIComponent(date)}` : ""}`;
  const detailHref =
    employeeId && date
      ? `/reports/daily/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`
      : null;

  const items = [
    {
      key: "daily" as const,
      label: "Günlük Sonuçlar",
      description: "Seçili günde kim ne durumda",
      href: dailyHref,
    },
    {
      key: "review" as const,
      label: "Review Operasyonu",
      description: "Pending kayıtları incele ve karar ver",
      href: reviewHref,
    },
    {
      key: "detail" as const,
      label: "Teknik Detay",
      description: "Bu sonucun neden üretildiğini çözümle",
      href: detailHref,
      disabled: !detailHref,
    },
  ];

  return (
    <nav className="rounded-xl border border-zinc-200 bg-white p-2" aria-label="Daily modül navigasyonu">
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => {
          const isActive = item.key === mode;

          if (item.disabled) {
            return (
              <div
                key={item.key}
                className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 opacity-60"
              >
                <div className="text-sm font-semibold text-zinc-500">{item.label}</div>
                <div className="mt-1 text-xs text-zinc-400">{item.description}</div>
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href!}
              className={cx(
                "rounded-lg border px-4 py-3 transition",
                isActive
                  ? "border-indigo-200 bg-indigo-50 shadow-sm"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              )}
            >
              <div
                className={cx(
                  "text-sm font-semibold",
                  isActive ? "text-indigo-700" : "text-zinc-900"
                )}
              >
                {item.label}
              </div>
              <div className={cx("mt-1 text-xs", isActive ? "text-indigo-600" : "text-zinc-500")}>
                {item.description}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}