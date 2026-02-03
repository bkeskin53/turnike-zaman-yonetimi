"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type MonthlyItem = any;

function getCode(item: MonthlyItem) {
  return item.employeeCode ?? item.employee?.employeeCode ?? "";
}

function getName(item: MonthlyItem) {
  if (item.fullName) return item.fullName;
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.name ?? "";
}

function stripEmoji(input: string) {
  // UI-only: remove emoji/pictographs that make the row look childish / misaligned.
  // Keep "+1" etc. as-is.
  return String(input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function n0(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMin(v: any): string {
  return String(n0(v));
}

function fmtDaysShort(it: any): string {
  const p = n0(it.presentDays);
  const a = n0(it.absentDays);
  const o = n0(it.offDays);
  const l = n0(it.leaveDays);
  // Monthly summary: show distribution, not a single "status"
  // Keep it compact and stable even if some fields are missing.
  const parts = [`P ${p}`, `A ${a}`, `Off ${o}`];
  if (l > 0) parts.push(`L ${l}`);
  return parts.join(" · ");
}

function renderShiftSummary(item: MonthlyItem): string {
  const ss = item.shiftSummary ?? null;
  if (!ss) return "";
  const w = Number(ss.weekTemplateDays ?? 0);
  const c = Number(ss.dayCustomDays ?? 0);
  const d = Number(ss.dayTemplateDays ?? 0);
  const p = Number(ss.policyDays ?? 0);
  const o = Number(ss.overnightDays ?? 0);
  // Compact row display (no emoji)
  return `Policy ${p} · Week ${w} · DayTpl ${d} · Custom ${c} · Night ${o}`;
}

function shiftSummaryTitle(item: MonthlyItem) {
  const ss = item.shiftSummary ?? null;
  if (!ss) return "";
  const policyDays = Number(ss.policyDays ?? 0);
  const weekTemplateDays = Number(ss.weekTemplateDays ?? 0);
  const dayTemplateDays = Number(ss.dayTemplateDays ?? 0);
  const customDays = Number(ss.dayCustomDays ?? 0);
  const overnightDays = Number(ss.overnightDays ?? 0);
  return `PolicyDays: ${policyDays}\nWeekTemplateDays: ${weekTemplateDays}\nDayTemplateDays: ${dayTemplateDays}\nCustomDays: ${customDays}\nOvernightDays: ${overnightDays}`;
}

function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  if (kind === "ok") return "bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "bg-amber-50 text-amber-800";
  if (kind === "bad") return "bg-rose-50 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}

function anomalyLabel(code: string): string {
  switch (code) {
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT çifti tamamlanmamış)";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    default:
      return code;
  }
}

type MonthlyFilter =
  | "ALL"
  | "MISSING_PUNCH"
  | "MANUAL"
  | "HAS_ANY_ANOMALY";

export default function MonthlyReportClient() {
  const [month, setMonth] = useState(() => {
    // Local ay (UTC değil): ay başında/sonunda "bir önceki ay"a düşme bug'ını engeller
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }); // YYYY-MM
  const [items, setItems] = useState<MonthlyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<MonthlyFilter>("ALL");

  const [anomalyMap, setAnomalyMap] = useState<Record<string, any[]>>({});
  const [loadingAnomaly, setLoadingAnomaly] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => {
    const s = {
      employees: items.length,
      workedMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      presentDays: 0,
      absentDays: 0,
      offDays: 0,
      missingPunchDays: 0,
      manualEmployees: 0,
    };
    for (const it of items) {
      s.workedMinutes += n0(it.workedMinutes);
      s.overtimeMinutes += n0(it.overtimeMinutes ?? it.otMinutes);
      s.lateMinutes += n0(it.lateMinutes);
      s.earlyLeaveMinutes += n0(it.earlyLeaveMinutes);
      s.presentDays += n0(it.presentDays);
      s.absentDays += n0(it.absentDays);
      s.offDays += n0(it.offDays);
      s.missingPunchDays += n0(it.missingPunchDays ?? it.missingPunch);
      if (it.manualOverrideApplied) s.manualEmployees += 1;
    }
    return s;
  }, [items]);

  function rowKey(it: any) {
    return String(it.employeeId ?? `${getCode(it)}__${getName(it)}`);
  }

  function onToolbarKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") load();
  }

  function onRowKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter" || e.key === " ") toggleRow(key);
  }

  async function loadMonthlyAnomalies(employeeId: string) {
    if (anomalyMap[employeeId] || loadingAnomaly[employeeId]) return;

    setLoadingAnomaly((p) => ({ ...p, [employeeId]: true }));
    try {
      const qs = new URLSearchParams({ month, employeeId });
      const res = await fetch(`/api/reports/monthly/anomalies?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("anomaly load failed");
      const json = await res.json();
      setAnomalyMap((p) => ({ ...p, [employeeId]: json.items ?? [] }));
    } finally {
      setLoadingAnomaly((p) => ({ ...p, [employeeId]: false }));
    }
  }

  function toggleRow(key: string, it?: any) {
    setOpenRows((prev) => {
      const next = !prev[key];
      if (next && it?.employeeId) {
        loadMonthlyAnomalies(it.employeeId);
      }
      return {
        ...prev,
        [key]: next,
      };
    });
  }

  async function load(sync?: boolean) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      if (sync) qs.set("sync", "1");
      const res = await fetch(`/api/reports/monthly?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`GET monthly failed: ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function recomputeMonth() {
    setLoadingRecompute(true);
    setError(null);
    try {
      await load(true);
    } catch (e: any) {
      setError(e?.message ?? "Recompute failed");
    } finally {
      setLoadingRecompute(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;

    if (filter === "MISSING_PUNCH") {
      return items.filter((it) => n0(it.missingPunchDays ?? it.missingPunch) > 0);
    }

    if (filter === "MANUAL") {
      return items.filter((it) => !!it.manualOverrideApplied);
    }

    if (filter === "HAS_ANY_ANOMALY") {
      // Monthly summary already includes anomalyCount, so we can filter correctly
      // even before Details panel is opened (no lazy-load dependency).
      return items.filter((it) => {
        const c = n0((it as any).anomalyCount);
        if (c > 0) return true;
        // Backward-safe fallback (older payloads):
        return n0(it.missingPunchDays ?? it.missingPunch) > 0;
      });
    }

    return items;
  }, [items, filter, anomalyMap]);

  return (
    <div className="grid max-w-full gap-4 overflow-x-hidden">
      {/* Hide scrollbar but keep scroll */}
      <style jsx global>{`
      /* Prevent layout "jump" when content height changes (e.g., Details expand)
           by reserving scrollbar space consistently. */
        html {
          scrollbar-gutter: stable;
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

      {/* Toolbar */}
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Month</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              onKeyDown={onToolbarKeyDown}
            />
          </label>

          <button
            type="button"
            onClick={recomputeMonth}
            disabled={loadingRecompute}
            title="Seçili ayın tüm günlerini recompute eder ve sonucu senkron döner"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {loadingRecompute ? "Recomputing…" : "Recompute"}
          </button>

          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          <a
            href={`/api/reports/monthly/export?month=${encodeURIComponent(month)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title="Excel için CSV indirir (önce Recompute yapıp sonra indirmeniz önerilir)"
          >
            CSV İndir
          </a>
          <a
            href={`/api/reports/monthly/anomalies/export?month=${encodeURIComponent(month)}`}
            className={
              "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 " +
              (loading ? "pointer-events-none opacity-50" : "")
            }
            title="Seçili ayın anomaly kayıtlarını CSV olarak indirir (gün + personel satırları)"
          >
            Anomali CSV
          </a>
        </div>

        {/* Summary chips */}
        {/* 
         IMPORTANT:
         - Pinned sidebar narrows content width.
         - Chips must NEVER overflow the card; they should wrap instead.
       */}
       <div className="flex max-w-full flex-wrap items-center gap-2 text-sm">
         <button
           type="button"
           onClick={() => setFilter("ALL")}
           className={
             "inline-flex max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1 " +
             (filter === "ALL" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700")
           }
           title="Filtreyi temizle"
         >
           Employees <span className="font-semibold">{summary.employees}</span>
         </button>

         <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
           Worked <span className="font-semibold">{summary.workedMinutes}</span>
         </span>

         <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
           OT <span className="font-semibold">{summary.overtimeMinutes}</span>
         </span>

         <button
          type="button"
           onClick={() => setFilter(filter === "MISSING_PUNCH" ? "ALL" : "MISSING_PUNCH")}
           className={
             "inline-flex max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1 " +
             (filter === "MISSING_PUNCH" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800")
           }
           title="Sadece MissingPunch olanları göster"
         >
           MissingPunch <span className="font-semibold">{summary.missingPunchDays}</span>
         </button>

         <button
           type="button"
           onClick={() => setFilter(filter === "MANUAL" ? "ALL" : "MANUAL")}
           className={
             "inline-flex max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1 " +
             (filter === "MANUAL" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700")
           }
           title="Sadece manual override olan personeller"
         >
           Manual <span className="font-semibold">{summary.manualEmployees}</span>
         </button>

         <button
           type="button"
           onClick={() => setFilter(filter === "HAS_ANY_ANOMALY" ? "ALL" : "HAS_ANY_ANOMALY")}
           className={
             "inline-flex max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1 " +
             (filter === "HAS_ANY_ANOMALY" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700")
           }
           title="Ay içinde en az 1 anomali olanlar (detay yüklendiyse kesin, değilse MissingPunch üzerinden tahmini)"
         >
           Anomali
         </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="max-w-full rounded-xl border border-zinc-200 bg-white">
         {/* 
           IMPORTANT:
           - Pinned sidebar narrows the content area.
           - With table-fixed + fixed col widths, the table can exceed container width.
           - overflow-hidden was clipping the right side (Actions column).
           - Solution: allow horizontal scroll only when needed.
         */}
         <div className="scrollbar-hide max-h-[520px] w-full overflow-auto">
           <table className="min-w-[900px] w-full table-fixed border-collapse text-sm">
            {/* colgroup: içinde yorum/boşluk bırakma (hydration warning yapar) */}
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[190px]" />
               <col className="w-[280px]" />
               <col className="w-[100px]" />
               <col className="w-[160px]" />
               <col className="w-[110px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="border-b border-zinc-200 px-3 py-2">Code</th>
                <th className="border-b border-zinc-200 px-3 py-2">Name</th>
                <th className="border-b border-zinc-200 px-3 py-2">Shift</th>
                <th className="border-b border-zinc-200 px-3 py-2">Worked</th>
                <th className="border-b border-zinc-200 px-3 py-2">Days</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it: any) => {
                const key = rowKey(it);
                const isOpen = !!openRows[key];
                const shiftText = stripEmoji(renderShiftSummary(it));
                const manual = !!it.manualOverrideApplied;
                return (
                  <Fragment key={key}>
                    <tr
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                      onClick={() => toggleRow(key, it)}
                      onKeyDown={(e) => onRowKeyDown(e, key)}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isOpen}
                      title="Detay için tıkla"
                    >
                      <td className="whitespace-nowrap px-3 py-2">{getCode(it)}</td>
                      <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                          <div className="min-w-0 flex-1 truncate">{getName(it)}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {/* 
                         Shift is the longest field. Keep it single-line + truncate
                         (tooltip already exists), so the table stays compact.
                       */}
                        <span title={shiftSummaryTitle(it)} className="whitespace-nowrap">
                          <span className="block truncate">{shiftText || "—"}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtMin(it.workedMinutes)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-700">{fmtDaysShort(it)}</td>                     
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex justify-start">
                          <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            <span className="font-mono">{isOpen ? "▾" : "▸"}</span>
                            Details
                          </span>
                        </div>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr key={`${key}__details`} className="bg-zinc-50/50">
                        <td colSpan={6} className="border-t border-dashed border-zinc-200 px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            {/* Dakikalar */}
                            <div className="rounded-lg border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dakikalar</div>
                              <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">Worked</span>
                                  <span className="tabular-nums">{fmtMin(it.workedMinutes)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">OT(Total)</span>
                                  <span className="tabular-nums">{fmtMin(it.overtimeMinutes ?? it.otMinutes)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">OT(Early)</span>
                                  <span className="tabular-nums">{fmtMin(it.overtimeEarlyMinutes)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">OT(Late)</span>
                                  <span className="tabular-nums">{fmtMin(it.overtimeLateMinutes)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">Late</span>
                                  <span className="tabular-nums">{fmtMin(it.lateMinutes)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">Early</span>
                                  <span className="tabular-nums">{fmtMin(it.earlyLeaveMinutes)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Günler */}
                            <div className="rounded-lg border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Günler</div>
                              <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">PresentDays</span>
                                  <span className="tabular-nums">{fmtMin(it.presentDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">AbsentDays</span>
                                  <span className="tabular-nums">{fmtMin(it.absentDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">OffDays</span>
                                  <span className="tabular-nums">{fmtMin(it.offDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">MissingPunchDays</span>
                                  <span className="tabular-nums">{fmtMin(it.missingPunchDays ?? it.missingPunch)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">ManualDays</span>
                                  <span className="tabular-nums">{fmtMin(it.manualDays)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Vardiya Kaynağı */}
                            <div className="rounded-lg border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vardiya Kaynağı</div>
                              <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">PolicyDays</span>
                                  <span className="tabular-nums">{fmtMin(it.shiftSummary?.policyDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">WeekTemplateDays</span>
                                  <span className="tabular-nums">{fmtMin(it.shiftSummary?.weekTemplateDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">DayTemplateDays</span>
                                  <span className="tabular-nums">{fmtMin(it.shiftSummary?.dayTemplateDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">CustomDays</span>
                                  <span className="tabular-nums">{fmtMin(it.shiftSummary?.dayCustomDays)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-zinc-600">OvernightDays</span>
                                  <span className="tabular-nums">{fmtMin(it.shiftSummary?.overnightDays)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Anomali Günleri */}
                          <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Anomali Günleri
                            </div>

                            {loadingAnomaly[it.employeeId] ? (
                              <div className="mt-2 text-sm text-zinc-500">Yükleniyor…</div>
                            ) : (anomalyMap[it.employeeId]?.length ?? 0) === 0 ? (
                              <div className="mt-2 text-sm text-zinc-500">Bu ay anomali yok.</div>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {anomalyMap[it.employeeId].map((a: any) => (
                                  <div
                                    key={a.date}
                                    className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1"
                                  >
                                    <div className="text-xs font-medium text-amber-800">
                                      {a.date}
                                    </div>
                                    <ul className="mt-1 text-sm text-amber-900">
                                      {a.anomalies.map((c: string) => (
                                        <li key={c}>• {anomalyLabel(c)}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {manual ? (
                            <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                              Bu personelde ay içinde{" "}
                              <span className="font-semibold">{fmtMin(it.manualDays)}</span> gün{" "}
                              <span className="font-semibold">Manual Adjustment</span> uygulanmış.
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-zinc-500">No manual overrides.</div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-600">
                    Sonuç yok (filtreyi temizlemek için Employees’e tıklayın).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
