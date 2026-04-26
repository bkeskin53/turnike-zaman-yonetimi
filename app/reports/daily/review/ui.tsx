"use client";

import { useEffect, useMemo, useState } from "react";
import DailyInitialLoading from "@/app/reports/daily/_components/DailyInitialLoading";
import DailyModuleNav from "@/app/reports/daily/_components/DailyModuleNav";
import EmploymentExclusionNotice from "@/app/reports/daily/_components/EmploymentExclusionNotice";
import ReviewAccessBanner from "@/app/reports/daily/review/_components/ReviewAccessBanner";
import ReviewTable from "@/app/reports/daily/review/_components/ReviewTable";
import ReviewToolbar from "@/app/reports/daily/review/_components/ReviewToolbar";

type DailyItem = any;
type ReviewStatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function DailyReviewClient(props: { canRecompute: boolean; role: string }) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [items, setItems] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [exNotEmployed, setExNotEmployed] = useState<{
    count: number;
    limited: number;
    limit: number;
    items: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      lastEmployment: { startDate: string | null; endDate: string | null; reason: string | null } | null;
    }>;
  } | null>(null);

  const [showAllRows, setShowAllRows] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>("PENDING");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReviewNote, setBulkReviewNote] = useState("");
  const [showExNotEmployed, setShowExNotEmployed] = useState(false);

  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
  const [reviewLogsById, setReviewLogsById] = useState<Record<string, any[]>>({});
  const [reviewLogsLoadingId, setReviewLogsLoadingId] = useState<string | null>(null);

  const reviewSummary = useMemo(() => {
    const s = { pending: 0, approved: 0, rejected: 0, total: 0 };

    for (const it of items) {
      s.total += 1;
      const rs = String(it?.reviewStatus ?? "NONE");

      if (rs === "PENDING") s.pending += 1;
      else if (rs === "APPROVED") s.approved += 1;
      else if (rs === "REJECTED") s.rejected += 1;
    }

    return s;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (reviewStatusFilter === "ALL") return items;
    return items.filter((it: any) => String(it?.reviewStatus ?? "NONE") === reviewStatusFilter);
  }, [items, reviewStatusFilter]);

  useEffect(() => {
    if (!showAllRows && reviewStatusFilter !== "PENDING") {
      setReviewStatusFilter("PENDING");
    }
  }, [showAllRows, reviewStatusFilter]);

  const selectedReviewIds = useMemo(
    () => Object.entries(selectedIds).filter(([, v]) => !!v).map(([k]) => k),
    [selectedIds]
  );

  const visibleRowIds = useMemo(() => visibleItems.map((it: any) => String(it.id)), [visibleItems]);

  const allVisibleSelected = useMemo(() => {
    if (!visibleRowIds.length) return false;
    return visibleRowIds.every((id) => !!selectedIds[id]);
  }, [visibleRowIds, selectedIds]);

  function rowKey(it: any) {
    return String(it.id ?? `${it.employeeId ?? "emp"}__${it.workDate ?? "day"}`);
  }

  function onToolbarKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") load();
  }

  function onRowKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter" || e.key === " ") toggleRow(key);
  }

  function toggleRow(key: string) {
    setOpenRows((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = { ...prev };
      const shouldSelect = !allVisibleSelected;

      for (const id of visibleRowIds) {
        next[id] = shouldSelect;
      }

      return next;
    });
  }

  async function bulkSetReviewStatus(status: "APPROVED" | "REJECTED" | "PENDING") {
    if (!selectedReviewIds.length) return;

    setBulkBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/attendance/review-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ids: selectedReviewIds,
          status,
          note: bulkReviewNote.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? `REVIEW_BULK_UPDATE_FAILED: ${res.status}`);
      }

      setBulkReviewNote("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Toplu review işlemi başarısız oldu");
    } finally {
      setBulkBusy(false);
    }
  }

  async function setReviewStatus(id: string, status: "APPROVED" | "REJECTED" | "PENDING") {
    if (!id) return;

    setReviewBusyId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/attendance/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          status,
          note: (reviewNoteById[id] ?? "").trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? `REVIEW_UPDATE_FAILED: ${res.status}`);
      }

      setReviewNoteById((prev) => ({ ...prev, [id]: "" }));
      setReviewLogsById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Review durumu güncellenemedi");
    } finally {
      setReviewBusyId(null);
    }
  }

  async function loadReviewLogs(id: string) {
    if (!id) return;
    if (reviewLogsById[id]) return;

    setReviewLogsLoadingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/attendance/review-logs?dailyAttendanceId=${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? `REVIEW_LOG_FETCH_FAILED: ${res.status}`);
      }

      setReviewLogsById((prev) => ({
        ...prev,
        [id]: Array.isArray(json?.items) ? json.items : [],
      }));
    } catch (e: any) {
      setError(e?.message ?? "Review geçmişi yüklenemedi");
    } finally {
      setReviewLogsLoadingId(null);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/reports/daily?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Bu raporu görüntülemek için yetkiniz yok.");
        }
        throw new Error(`GET daily failed: ${res.status}`);
      }

      const json = await res.json();

      setItems(json.items ?? []);
      setOpenRows({});
      setSelectedIds({});
      setExNotEmployed(json?.meta?.exclusions?.notEmployed ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialLoading = loading && !hasLoadedOnce;
  const refreshing = hasLoadedOnce && loading;

  return (
    <div className="grid max-w-full gap-4 overflow-x-hidden">
      <style jsx global>{`
        .y-scrollbar-hide::-webkit-scrollbar {
          width: 0px;
        }
        .y-scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <ReviewAccessBanner role={props.role} />
      <DailyModuleNav mode="review" date={date} />

      {initialLoading ? <DailyInitialLoading /> : null}

      <ReviewToolbar
        date={date}
        setDate={setDate}
        onToolbarKeyDown={onToolbarKeyDown}
        onRefresh={load}
        loading={loading}
        showAllRows={showAllRows}
        setShowAllRows={setShowAllRows}
        reviewStatusFilter={reviewStatusFilter}
        setReviewStatusFilter={setReviewStatusFilter}
        allVisibleSelected={allVisibleSelected}
        toggleSelectAllVisible={toggleSelectAllVisible}
        bulkReviewNote={bulkReviewNote}
        setBulkReviewNote={setBulkReviewNote}
        selectedCount={selectedReviewIds.length}
        onBulkPending={() => bulkSetReviewStatus("PENDING")}
        onBulkApprove={() => bulkSetReviewStatus("APPROVED")}
        onBulkReject={() => bulkSetReviewStatus("REJECTED")}
        bulkBusy={bulkBusy}
        summary={reviewSummary}
      />

      {notice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </div>
      ) : null}

      {exNotEmployed?.count ? (
        <EmploymentExclusionNotice
          data={exNotEmployed}
          open={showExNotEmployed}
          onToggle={() => setShowExNotEmployed((s) => !s)}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <ReviewTable
        items={visibleItems}
        date={date}
        initialLoading={initialLoading}
        refreshing={refreshing}
        openRows={openRows}
        toggleRow={toggleRow}
        onRowKeyDown={onRowKeyDown}
        rowKey={rowKey}
        selectedIds={selectedIds}
        toggleSelected={toggleSelected}
        allVisibleSelected={allVisibleSelected}
        toggleSelectAllVisible={toggleSelectAllVisible}
        reviewBusyId={reviewBusyId}
        reviewNoteById={reviewNoteById}
        setReviewNoteById={setReviewNoteById}
        onSetReviewStatus={setReviewStatus}
        reviewLogsById={reviewLogsById}
        reviewLogsLoadingId={reviewLogsLoadingId}
        onLoadReviewLogs={loadReviewLogs}
      />
    </div>
  );
}