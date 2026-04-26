export { default } from "./EmployeeHistoricalInfoBanner";
/*
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type EmployeeHistoryMeta = {
  dayKey: string;
  todayDayKey: string;
  isHistorical: boolean;
  canEdit: boolean;
  mode: "AS_OF" | "CURRENT";
  profileSource?: string;
  orgSource?: string;
};

export default function EmployeeHistoricalModeBanner({
  history,
}: {
  history: EmployeeHistoryMeta | null | undefined;
}) {
  const pathname = usePathname() || "";

  if (!history?.isHistorical) return null;

  return (
    <div
      className={cx(
        "rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.96))] p-4 shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              Geçmiş Görünümü
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
              As-of: {history.dayKey}
            </span>
          </div>

          <div className="text-sm text-zinc-700">
            Bu ekran seçilen tarihteki snapshot ile gösteriliyor. Geçmiş modunda düzenleme kapalıdır.
          </div>

          <div className="text-xs text-zinc-500">
            Profil kaynağı: {history.profileSource ?? "—"} · Organizasyon kaynağı: {history.orgSource ?? "—"}
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href={pathname}
            className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            Bugünkü Görünüme Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
*/
