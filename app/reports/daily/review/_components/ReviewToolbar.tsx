import type { KeyboardEvent } from "react";
import { cx } from "../../_components/dailyShared";
import { Button } from "../../_components/dailyShared";

export default function ReviewToolbar({
  date,
  setDate,
  onToolbarKeyDown,
  onRefresh,
  loading,
  showAllRows,
  setShowAllRows,
  reviewStatusFilter,
  setReviewStatusFilter,
  allVisibleSelected,
  toggleSelectAllVisible,
  bulkReviewNote,
  setBulkReviewNote,
  selectedCount,
  onBulkPending,
  onBulkApprove,
  onBulkReject,
  bulkBusy,
  summary,
}: {
  date: string;
  setDate: (value: string) => void;
  onToolbarKeyDown: (e: KeyboardEvent) => void;
  onRefresh: () => void;
  loading: boolean;
  showAllRows: boolean;
  setShowAllRows: (value: boolean) => void;
  reviewStatusFilter: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  setReviewStatusFilter: (value: "PENDING" | "APPROVED" | "REJECTED" | "ALL") => void;
  allVisibleSelected: boolean;
  toggleSelectAllVisible: () => void;
  bulkReviewNote: string;
  setBulkReviewNote: (value: string) => void;
  selectedCount: number;
  onBulkPending: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  bulkBusy: boolean;
  summary: { pending: number; approved: number; rejected: number; total: number };
}) {
  function selectFilter(value: "PENDING" | "APPROVED" | "REJECTED" | "ALL") {
    setReviewStatusFilter(value);
    if (value === "PENDING") {
      setShowAllRows(false);
      return;
    }
    setShowAllRows(true);
  }

  return (
    <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(0,1fr)]">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={onToolbarKeyDown}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto]">
            <Button variant="secondary" onClick={onRefresh} disabled={loading} title="Seçili günün review verisini getir">
              {loading ? "Yükleniyor…" : "Yenile"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600 xl:max-w-[360px]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectFilter("PENDING")}
              className={cx(
                "inline-flex rounded-full px-2.5 py-1 font-semibold transition cursor-pointer",
                reviewStatusFilter === "PENDING"
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              )}
            >
              Pending {summary.pending}
            </button>
            <button
              type="button"
              onClick={() => selectFilter("APPROVED")}
              className={cx(
                "inline-flex rounded-full px-2.5 py-1 font-semibold transition cursor-pointer",
                reviewStatusFilter === "APPROVED"
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              Approved {summary.approved}
            </button>
            <button
              type="button"
              onClick={() => selectFilter("REJECTED")}
              className={cx(
                "inline-flex rounded-full px-2.5 py-1 font-semibold transition cursor-pointer",
                reviewStatusFilter === "REJECTED"
                  ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              )}
            >
              Rejected {summary.rejected}
            </button>
            <button
              type="button"
              onClick={() => selectFilter("ALL")}
              className={cx(
                "inline-flex rounded-full px-2.5 py-1 font-semibold transition cursor-pointer",
                reviewStatusFilter === "ALL"
                  ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              )}
            >
              Toplam {summary.total}
            </button>
          </div>
          <div>
            Varsayılan görünüm pending satırları gösterir. Tarih değiştiğinde liste otomatik yenilenmez; yeni günü görmek için
            <span className="font-semibold text-zinc-800"> Yenile</span> kullan.
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[auto_auto_minmax(260px,1fr)_auto_auto_auto_auto] xl:items-center">
        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm">
          <input type="checkbox" checked={showAllRows} onChange={(e) => setShowAllRows(e.target.checked)} />
          Tüm Satırları Göster
        </label>

        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
          Görünenleri Seç
        </label>

        <input
          className="h-10 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
          placeholder="Toplu review notu…"
          value={bulkReviewNote}
          onChange={(e) => setBulkReviewNote(e.target.value)}
        />

        <span className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-700">
          Seçili: {selectedCount}
        </span>

        <Button variant="secondary" onClick={onBulkPending} disabled={bulkBusy || selectedCount === 0}>
          Toplu Pending
        </Button>
        <Button variant="primary" onClick={onBulkApprove} disabled={bulkBusy || selectedCount === 0}>
          Toplu Approve
        </Button>
        <Button variant="danger" onClick={onBulkReject} disabled={bulkBusy || selectedCount === 0}>
          Toplu Reject
        </Button>
      </div>
    </div>
  );
}