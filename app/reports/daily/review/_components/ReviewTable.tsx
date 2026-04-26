import type { KeyboardEvent } from "react";
import { Fragment } from "react";
import Link from "next/link";
import DailyExpandedSummary from "../../_components/DailyExpandedSummary";
import { Button } from "../../_components/dailyShared";
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
} from "../../_components/dailyShared";

function fmt(dt: any) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export default function ReviewTable({
  items,
  date,
  initialLoading,
  refreshing,
  openRows,
  toggleRow,
  onRowKeyDown,
  rowKey,
  selectedIds,
  toggleSelected,
  allVisibleSelected,
  toggleSelectAllVisible,
  reviewBusyId,
  reviewNoteById,
  setReviewNoteById,
  onSetReviewStatus,
  reviewLogsById,
  reviewLogsLoadingId,
  onLoadReviewLogs,
}: {
  items: DailyItem[];
  date: string;
  initialLoading: boolean;
  refreshing: boolean;
  openRows: Record<string, boolean>;
  toggleRow: (key: string) => void;
  onRowKeyDown: (e: KeyboardEvent, key: string) => void;
  rowKey: (item: any) => string;
  selectedIds: Record<string, boolean>;
  toggleSelected: (id: string) => void;
  allVisibleSelected: boolean;
  toggleSelectAllVisible: () => void;
  reviewBusyId: string | null;
  reviewNoteById: Record<string, string>;
  setReviewNoteById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetReviewStatus: (id: string, status: "APPROVED" | "REJECTED" | "PENDING") => void;
  reviewLogsById: Record<string, any[]>;
  reviewLogsLoadingId: string | null;
  onLoadReviewLogs: (id: string) => void;
}) {
  return (
    <div className="relative max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      {refreshing ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-[0_10px_24px_rgba(139,92,246,0.10)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          Liste güncelleniyor…
        </div>
      ) : null}

      <div className="max-h-[560px] w-full overflow-y-auto">
        <table className="w-full min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[40px]" />
            <col className="w-[84px]" />
            <col className="w-[168px]" />
            <col className="w-[168px]" />
            <col className="w-[120px]" />
            <col className="w-[96px]" />
            <col className="w-[110px]" />
            <col className="w-[132px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              <th className="border-b border-zinc-200 px-2 py-2 text-center">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} title="Görünen satırların tümünü seç" />
              </th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Code</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Name</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5 text-center">Review</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Shift</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Worked</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5">Issues</th>
              <th className="border-b border-zinc-200 px-2.5 py-2.5 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {initialLoading
              ? Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`review-skeleton-${idx}`} className="border-t border-zinc-100">
                    <td className="px-3 py-3">
                      <SkeletonLine className="h-4 w-4 rounded" />
                    </td>
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
                const itemId = String(it.id ?? "");
                const st = statusBadge(String(it.status ?? ""));
                const ib = issuesBadge(anomalies);
                const review = reviewBadge(String((it as any).reviewStatus ?? "NONE"));

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
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selectedIds[itemId]} onChange={() => toggleSelected(itemId)} />
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="block truncate" title={safeText(getCode(it))}>{safeText(getCode(it))}</span>
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
                          {review ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${review.cls}`}>{review.label}</span> : null}
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span title={buildShiftTooltip(it)} className="block min-w-0">
                          <span className="block truncate whitespace-nowrap">{shiftDisplay(it)}</span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums" title={metricCellTitle("Worked", it.workedMinutes)}>
                        {fmtMin(it.workedMinutes)}
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ib.cls}`}>{ib.label}</span>
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
                        <td colSpan={8} className="border-t border-dashed border-zinc-200 px-3 py-3">
                          <div className="grid gap-3">
                            <DailyExpandedSummary
                              item={it}
                              date={date}
                              employeeId={employeeId}
                              dayViewFilter="ALL"
                            />

                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                  Tekil Review İşlemi
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="secondary"
                                    disabled={reviewBusyId === itemId}
                                    onClick={() => onSetReviewStatus(itemId, "PENDING")}
                                  >
                                    Pending
                                  </Button>
                                  <Button
                                    variant="primary"
                                    disabled={reviewBusyId === itemId}
                                    onClick={() => onSetReviewStatus(itemId, "APPROVED")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="danger"
                                    disabled={reviewBusyId === itemId}
                                    onClick={() => onSetReviewStatus(itemId, "REJECTED")}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3">
                                <textarea
                                  className="min-h-[84px] w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-300"
                                  placeholder="İnceleme notu yazabilirsiniz…"
                                  value={reviewNoteById[itemId] ?? ""}
                                  onChange={(e) =>
                                    setReviewNoteById((prev) => ({
                                      ...prev,
                                      [itemId]: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                                {Array.isArray((it as any).reviewReasons) && (it as any).reviewReasons.length > 0 ? (
                                  (it as any).reviewReasons.map((reason: string, idx: number) => (
                                    <li key={`${key}__review__${idx}`} className="py-0.5">
                                      <span className="font-mono text-xs">{reason}</span>
                                    </li>
                                  ))
                                ) : (
                                  <li>Bu kayıt inceleme gerektiriyor.</li>
                                )}
                              </ul>

                              {(it as any).reviewedAt ? (
                                <div className="mt-3 text-xs text-amber-900/80">
                                  Son inceleme: {fmt((it as any).reviewedAt)}
                                </div>
                              ) : null}

                              {(it as any).reviewNote ? (
                                <div className="mt-2 rounded-md border border-amber-200/70 bg-white/70 px-3 py-2 text-sm text-amber-900">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Mevcut Review Note</div>
                                  <div className="mt-1 whitespace-pre-wrap">{String((it as any).reviewNote)}</div>
                                </div>
                              ) : null}

                              <div className="mt-3">
                                <Button
                                  variant="ghost"
                                  onClick={() => onLoadReviewLogs(itemId)}
                                  disabled={reviewLogsLoadingId === itemId}
                                >
                                  {reviewLogsLoadingId === itemId ? "Log yükleniyor…" : "Review Log"}
                                </Button>

                                {Array.isArray(reviewLogsById[itemId]) && reviewLogsById[itemId].length > 0 ? (
                                  <div className="mt-2 rounded-md border border-amber-200/70 bg-white/80">
                                    {reviewLogsById[itemId].map((log: any) => (
                                      <div key={log.id} className="border-t border-amber-100 px-3 py-2 text-sm first:border-t-0">
                                        <div className="font-medium text-amber-900">
                                          {(log.fromStatus ?? "NONE")} → {log.toStatus}
                                        </div>
                                        <div className="text-xs text-amber-800/80">{fmt(log.createdAt)}</div>
                                        {log.note ? <div className="mt-1 whitespace-pre-wrap text-amber-900">{log.note}</div> : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
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