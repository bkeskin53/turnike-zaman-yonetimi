"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import DailyAccessBanner from "./_components/DailyAccessBanner";
import DailyInitialLoading from "./_components/DailyInitialLoading";
import DailyModuleNav from "./_components/DailyModuleNav";
import DailyTable from "./_components/DailyTable";
import DailyToolbar from "./_components/DailyToolbar";
import EmploymentExclusionNotice from "./_components/EmploymentExclusionNotice";

type DailyItem = any;
type DayViewFilter = "ALL" | "SCHEDULED" | "UNSCHEDULED";

export default function DailyReportClient(props: { canRecompute: boolean; role: string }) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [items, setItems] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [dayViewFilter, setDayViewFilter] = useState<DayViewFilter>("ALL");
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
  const [showExNotEmployed, setShowExNotEmployed] = useState(false);

  const summary = useMemo(() => {
    const s = { PRESENT: 0, ABSENT: 0, OFF: 0, LEAVE: 0, MISSING_PUNCH: 0, PENDING_REVIEW: 0 };
    for (const it of items) {
      if (it.status === "PRESENT") s.PRESENT++;
      else if (it.status === "ABSENT") s.ABSENT++;
      else if (it.status === "OFF") s.OFF++;
      else if (it.status === "LEAVE") s.LEAVE++;
      if (String(it.reviewStatus ?? "NONE") === "PENDING") s.PENDING_REVIEW++;
      const an = it.anomalies ?? [];
      if (Array.isArray(an) && an.includes("MISSING_PUNCH")) s.MISSING_PUNCH++;
    }
    return s;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (dayViewFilter === "SCHEDULED") {
      return items.filter((it) => Number(it?.scheduledWorkedMinutes ?? 0) > 0);
    }

    if (dayViewFilter === "UNSCHEDULED") {
      return items.filter((it) => Number(it?.unscheduledWorkedMinutes ?? 0) > 0);
    }

    return items;
  }, [items, dayViewFilter]);

  function rowKey(it: any) {
    return String(it.id ?? `${it.employeeId ?? "emp"}__${it.workDate ?? "day"}`);
  }

  function onToolbarKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") load();
  }

  function onRowKeyDown(e: KeyboardEvent, key: string) {
    if (e.key === "Enter" || e.key === " ") toggleRow(key);
  }

  function toggleRow(key: string) {
    setOpenRows((prev) => ({ ...prev, [key]: !prev[key] }));
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
        if (res.status === 403) throw new Error("Bu raporu görüntülemek için yetkiniz yok.");
        throw new Error(`GET daily failed: ${res.status}`);
      }
      const json = await res.json();
      setItems(json.items ?? []);
      setOpenRows({});
      setExNotEmployed(json?.meta?.exclusions?.notEmployed ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function recompute() {
    if (!props.canRecompute) {
      setError(null);
      setNotice("Bu rolde Yeniden Hesapla yetkiniz yok. Raporu görüntüleyebilirsiniz (salt okunur).");
      return;
    }
    setLoadingRecompute(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/attendance/recompute?date=${encodeURIComponent(date)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) {
          setNotice("Yeniden hesaplama işlemi için yetkiniz yok (POST 403).");
          return;
        }
        throw new Error(`POST recompute failed: ${res.status}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Yeniden hesaplama başarısız oldu");
    } finally {
      setLoadingRecompute(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialLoading = loading && !hasLoadedOnce;
  const refreshing = hasLoadedOnce && (loading || loadingRecompute);

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

      <DailyAccessBanner canRecompute={props.canRecompute} role={props.role} />
      <DailyModuleNav mode="daily" date={date} />

      {initialLoading ? <DailyInitialLoading /> : null}

      <DailyToolbar
        date={date}
        setDate={setDate}
        onToolbarKeyDown={onToolbarKeyDown}
        onRecompute={recompute}
        canRecompute={props.canRecompute}
        loadingRecompute={loadingRecompute}
        onRefresh={load}
        loading={loading}
        summary={summary}
        dayViewFilter={dayViewFilter}
        setDayViewFilter={setDayViewFilter}
        visibleCount={visibleItems.length}
        totalCount={items.length}
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

      <DailyTable
        items={visibleItems}
        date={date}
        dayViewFilter={dayViewFilter}
        initialLoading={initialLoading}
        refreshing={refreshing}
        loadingRecompute={loadingRecompute}
        openRows={openRows}
        toggleRow={toggleRow}
        onRowKeyDown={onRowKeyDown}
        rowKey={rowKey}
      />
    </div>
  );
}