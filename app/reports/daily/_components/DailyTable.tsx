import type { KeyboardEvent } from "react";
import { Fragment } from "react";
import Link from "next/link";
import DailyExpandedSummary from "./DailyExpandedSummary";
import {
  DailyItem,
  SkeletonLine,
  buildShiftTooltip,
  cx,
  getCode,
  getName,
  issuesBadge,
  metricCellTitle,
  reviewBadge,
  safeText,
  shiftDisplay,
  statusBadge,
  fmtMin,
} from "./dailyShared";

type DayViewFilter = "ALL" | "SCHEDULED" | "UNSCHEDULED";

export default function DailyTable({
  items,
  date,
  dayViewFilter,
  initialLoading,
  refreshing,
  loadingRecompute,
  openRows,
  toggleRow,
  onRowKeyDown,
  rowKey,
}: {
  items: DailyItem[];
  date: string;
  dayViewFilter: DayViewFilter;
  initialLoading: boolean;
  refreshing: boolean;
  loadingRecompute: boolean;
  openRows: Record<string, boolean>;
  toggleRow: (key: string) => void;
  onRowKeyDown: (e: KeyboardEvent, key: string) => void;
  rowKey: (item: any) => string;
}) {
  return (
    <div className="relative max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      {refreshing ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-[0_10px_24px_rgba(139,92,246,0.10)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          {loadingRecompute ? "Hesaplama sürüyor…" : "Liste güncelleniyor…"}
        </div>
      ) : null}

      <div className="max-h-[520px] w-full overflow-y-auto">
        <table className="w-full min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[84px]" />
            <col className="w-[156px]" />
            <col className="w-[148px]" />
            <col className="w-[122px]" />
            <col className="w-[96px]" />
            <col className="w-[94px]" />
            <col className="w-[132px]" />
          </colgroup>

          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Code</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Name</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5 text-center">Status</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Shift</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Worked</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Issues</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5 text-left">Details</th>
            </tr>
          </thead>

          <tbody>
            {initialLoading
              ? Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`daily-skeleton-${idx}`} className="border-t border-zinc-100">
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-4 w-14" />
                    </td>
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-4 w-36" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center">
                        <SkeletonLine className="h-6 w-20 rounded-full" />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-4 w-28" />
                    </td>
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-4 w-12" />
                    </td>
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-6 w-16 rounded-full" />
                    </td>
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-8 w-24 rounded-md" />
                    </td>
                  </tr>
                ))
              : null}

            {!initialLoading &&
              items.map((it: any) => {
                const key = rowKey(it);
                const anomalies = Array.isArray(it.anomalies) ? (it.anomalies as string[]) : [];
                const isOpen = !!openRows[key];
                const employeeId = String(it.employeeId ?? it.employee?.id ?? "");
                const st = statusBadge(String(it.status ?? ""));
                const ib = issuesBadge(anomalies);
                const review = reviewBadge(String(it.reviewStatus ?? "NONE"));

                return (
                  <Fragment key={key}>
                    <tr
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                      onClick={() => toggleRow(key)}
                      onKeyDown={(e) => onRowKeyDown(e, key)}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isOpen}
                      title="Satır özetini aç"
                      data-row-key={key}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="block truncate" title={safeText(getCode(it))}>
                          {safeText(getCode(it))}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        <Link
                          href={employeeId ? `/employees/${encodeURIComponent(employeeId)}` : "#"}
                          className={cx(
                            "block min-w-0 truncate rounded-md px-1 py-0.5 font-medium text-zinc-900 transition",
                            employeeId ? "cursor-pointer hover:bg-zinc-100 hover:text-indigo-700" : "cursor-default"
                          )}
                          onClick={(e) => e.stopPropagation()}
                          title={safeText(getName(it))}
                        >
                          {safeText(getName(it))}
                        </Link>
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                            {st.label}
                          </span>
                          {review ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${review.cls}`}>
                              {review.label}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span title={buildShiftTooltip(it)} className="block min-w-0">
                          <span className="block truncate whitespace-nowrap">{shiftDisplay(it)}</span>
                        </span>
                      </td>

                      <td
                        className="whitespace-nowrap px-3 py-2.5 tabular-nums"
                        title={metricCellTitle("Worked", it.workedMinutes)}
                      >
                        {fmtMin(it.workedMinutes)}
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ib.cls}`}>
                          {ib.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            <span className="font-mono">{isOpen ? "▾" : "▸"}</span>
                            Özet
                          </span>

                          <Link
                            href={employeeId ? `/reports/daily/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}` : "#"}
                            className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Teknik
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr className="bg-zinc-50/50">
                        <td colSpan={7} className="border-t border-dashed border-zinc-200 px-3 py-3">
                          <DailyExpandedSummary
                            item={it}
                            date={date}
                            employeeId={employeeId}
                            dayViewFilter={dayViewFilter}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}