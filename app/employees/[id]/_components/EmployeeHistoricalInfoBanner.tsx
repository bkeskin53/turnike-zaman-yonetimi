"use client";

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
  if (!history?.isHistorical) return null;

  return (
    <div
      className={cx(
        "rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.96))] p-4 shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              Geçmiş görünümü
            </span>
          </div>

          <div className="text-sm text-zinc-700">
            Bu ekran seçilen tarihte geçerli olan snapshot ile gösteriliyor. Geçmiş modunda düzenleme kapalıdır.
          </div>

          <div className="text-xs text-zinc-500">
            Profil kaynağı: {history.profileSource ?? "—"} · Organizasyon kaynağı: {history.orgSource ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
