export default function DailySummaryChips({
  summary,
}: {
  summary: { PRESENT: number; ABSENT: number; OFF: number; LEAVE: number; MISSING_PUNCH: number };
}) {
  const items = [
    {
      label: "Mevcut",
      value: summary.PRESENT,
      cls: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
      dot: "bg-emerald-500",
    },
    {
      label: "Devamsız",
      value: summary.ABSENT,
      cls: "border-rose-200 bg-rose-50/80 text-rose-800",
      dot: "bg-rose-500",
    },
    {
      label: "İzin",
      value: summary.LEAVE,
      cls: "border-indigo-200 bg-indigo-50/80 text-indigo-800",
      dot: "bg-indigo-500",
    },
    {
      label: "Off",
      value: summary.OFF,
      cls: "border-zinc-200 bg-zinc-100/90 text-zinc-700",
      dot: "bg-zinc-500",
    },
    {
      label: "Eksik Punch",
      value: summary.MISSING_PUNCH,
      cls: "border-amber-200 bg-amber-50/90 text-amber-900",
      dot: "bg-amber-500",
    },
  ];
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="grid min-w-[280px] gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 shadow-sm ${item.cls}`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
              <span className="text-sm font-semibold">{item.label}</span>
            </div>

            <div className="rounded-full bg-white/80 px-2.5 py-1 text-sm font-black tracking-tight shadow-sm">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
