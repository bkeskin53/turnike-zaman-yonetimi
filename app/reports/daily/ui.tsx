"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type DailyItem = any;

function formatShiftSourceTR(src: string | null | undefined): string {
  switch (src) {
    case "POLICY":
      return "Policy";
    case "WEEK_TEMPLATE":
      return "Week Template";
    case "DAY_TEMPLATE":
      return "Day Template";
    case "CUSTOM":
      return "Custom";
    default:
      return src ? String(src) : "";
  }
}

function isOvernightBadge(badgeOrLabel: string | null | undefined): boolean {
  if (!badgeOrLabel) return false;
  // Badge may contain "🌙" or signature may contain "+1"
  return badgeOrLabel.includes("🌙") || badgeOrLabel.includes("+1");
}

function buildShiftTooltip(it: any): string {
  const src = formatShiftSourceTR(it.shiftSource);
  const label = (it.shiftLabel ?? it.shiftSignature ?? "").toString();
  const badge = (it.shiftBadge ?? "").toString();
  const overnight = isOvernightBadge(badge || label) ? "Evet" : "Hayır";
  const parts = [];
  if (src) parts.push(`Kaynak: ${src}`);
  if (label) parts.push(`Vardiya: ${label}`);
  if (src || label) parts.push(`Gece: ${overnight}`);
  return parts.join("\n");
}

function stripEmoji(input: string) {
  // UI-only: remove emoji/pictographs that make the Shift column look childish / misaligned.
  // Keep "+1" etc. as-is.
  return input
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // most emoji blocks
    .replace(/[\u{2600}-\u{26FF}]/gu, "")   // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")   // dingbats
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

function n0(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMin(v: any): string {
  // minutes -> "480" etc (UI only)
  const n = n0(v);
  return String(n);
}

function issuesBadge(anomalies: string[]) {
  const c = anomalies.length;
  if (!c) return { label: "—", cls: "bg-zinc-100 text-zinc-600" };
  if (c >= 3) return { label: `${c} issue`, cls: "bg-rose-50 text-rose-700" };
  return { label: `${c} issue`, cls: "bg-amber-50 text-amber-800" };
}

function prettyAnomaly(code: string): string {
  // Minimal, safe mapping (unknown codes are shown as-is)
  switch (code) {
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT eksik)";
    case "MISSING_IN":
      return "IN eksik";
    case "MISSING_OUT":
      return "OUT eksik";
    case "DUPLICATE_PUNCH":
      return "Duplicate punch";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "DUPLICATE_EVENT":
      return "Duplicate event (aynı kayıt tekrarlandı)";
    case "EARLY_IN":
      return "Vardiya öncesi giriş";
    case "LATE_IN":
      return "Geç giriş";
    case "EARLY_OUT":
      return "Erken çıkış";
    case "LATE_OUT":
      return "Geç çıkış";
    case "OVERNIGHT":
      return "Gece sınırı (+1) aşıldı";
    case "PUNCH_BEFORE_SHIFT":
      return "Vardiya başlamadan punch";
    case "PUNCH_AFTER_SHIFT":
      return "Vardiya bitince punch";
    default:
      return code;
  }
}

function getCode(item: DailyItem) {
  return item.employee?.employeeCode ?? item.employeeCode ?? "";
}

function getName(item: DailyItem) {
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.fullName ?? item.name ?? "";
}

function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  if (kind === "ok") return "bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "bg-amber-50 text-amber-800";
  if (kind === "bad") return "bg-rose-50 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}

function statusBadge(status: string) {
  switch (status) {
    case "PRESENT":
      return { label: "PRESENT", cls: badgeClass("ok") };
    case "ABSENT":
      return { label: "ABSENT", cls: badgeClass("bad") };
    case "OFF":
      return { label: "OFF", cls: badgeClass("neutral") };
    default:
      return { label: String(status ?? ""), cls: badgeClass("neutral") };
  }
}

export default function DailyReportClient() {
  const [date, setDate] = useState(() => {
    // Local tarih (UTC değil): 00:00-03:00 arası "dün"e kayma bug'ını engeller
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [items, setItems] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => {
    const s = { PRESENT: 0, ABSENT: 0, OFF: 0, LEAVE: 0, MISSING_PUNCH: 0 };
    for (const it of items) {
      if (it.status === "PRESENT") s.PRESENT++;
      else if (it.status === "ABSENT") s.ABSENT++;
      else if (it.status === "OFF") s.OFF++;
      else if (it.status === "LEAVE") s.LEAVE++;
      const an = it.anomalies ?? [];
      if (Array.isArray(an) && an.includes("MISSING_PUNCH")) s.MISSING_PUNCH++;
    }
    return s;
  }, [items]);

  function rowKey(it: any) {
    // stable key: prefer attendance id; fallback to employeeId+date
    return String(it.id ?? `${it.employeeId ?? "emp"}__${it.workDate ?? "day"}`);
  }

  function onToolbarKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") load();
  }

  function onRowKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter" || e.key === " ") toggleRow(key);
  }

  function toggleRow(key: string) {
    setOpenRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`GET daily failed: ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function recompute() {
    setLoadingRecompute(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/recompute?date=${encodeURIComponent(date)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`POST recompute failed: ${res.status}`);
      await load();
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

  return (
    <div className="grid max-w-full gap-4 overflow-x-hidden">
      {/* Hide scrollbar but keep scroll */}
      <style jsx global>{`
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
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={onToolbarKeyDown}
            />
          </label>

          <button
            type="button"
            onClick={recompute}
            disabled={loadingRecompute}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {loadingRecompute ? "Recomputing…" : "Recompute"}
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          <a
            href={`/api/reports/daily/export?date=${encodeURIComponent(date)}`}
            className={
              "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 " +
              (loading ? "pointer-events-none opacity-50" : "")
            }
            title="CSV indir (Excel)"
          >
            CSV
          </a>

          <a
            href={`/api/reports/anomalies/export?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title="Bu günün anomalilerini CSV indir (Excel)"
          >
            Anomali CSV
          </a>
        </div>

        {/* Summary chips */}
        <div className="scrollbar-hide flex max-w-full items-center gap-2 overflow-x-auto text-sm sm:flex-wrap sm:overflow-visible">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            Present <span className="font-semibold">{summary.PRESENT}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            Absent <span className="font-semibold">{summary.ABSENT}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
            Leave <span className="font-semibold">{summary.LEAVE}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
            Off <span className="font-semibold">{summary.OFF}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-800">
            MissingPunch <span className="font-semibold">{summary.MISSING_PUNCH}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {/* Table */}
        <div className="max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="scrollbar-hide max-h-[520px] w-full overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              {/* colgroup: içinde yorum/boşluk bırakma (hydration warning yapar) */}
              <colgroup>
                <col className="w-12" />
                <col className="w-[98px]" />
                <col className="w-[128px]" />
                <col className="w-32" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-20" />
              </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="border-b border-zinc-200 px-3 py-2">Code</th>
                <th className="border-b border-zinc-200 px-3 py-2">Name</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-center">Status</th>
                <th className="border-b border-zinc-200 px-3 py-2">Shift</th>
                <th className="border-b border-zinc-200 px-3 py-2">Worked</th>
                <th className="border-b border-zinc-200 px-3 py-2">Issues</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
            {items.map((it: any) => {
              const key = rowKey(it);
              const anomalies = Array.isArray(it.anomalies) ? (it.anomalies as string[]) : [];
              const hasAnomaly = anomalies.length > 0;
              const isOpen = !!openRows[key];
              const st = statusBadge(String(it.status ?? ""));
              const ib = issuesBadge(anomalies);
              return (
                <Fragment key={key}>
                  <tr
                    className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                    onClick={() => toggleRow(key)}
                    onKeyDown={(e) => onRowKeyDown(e, key)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isOpen}
                    title="Detay için tıkla"
                  >
                    <td className="whitespace-nowrap px-3 py-2">{getCode(it)}</td>
                    <td className="px-3 py-2">
                      <div className="truncate">{getName(it)}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {it.manualOverrideApplied ? (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            MANUAL
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span title={buildShiftTooltip(it)} className="whitespace-nowrap">
                        <span className="block truncate">
                          {stripEmoji(String(it.shiftLabel ?? it.shiftSignature ?? it.shiftBadge ?? ""))}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {it.workedMinutes ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ib.cls}`}>
                        {ib.label}
                      </span>
                    </td>
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
                      <td colSpan={7} className="border-t border-dashed border-zinc-200 px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          {/* Zaman */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zaman</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">FirstIn</span>
                                <span className="tabular-nums">{fmt(it.firstIn) || "—"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">LastOut</span>
                                <span className="tabular-nums">{fmt(it.lastOut) || "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Hesap */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hesap</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Worked</span>
                                <span className="tabular-nums">{fmtMin(it.workedMinutes)}</span>
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

                          {/* Overtime */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Overtime</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Early)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeEarlyMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Late)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeLateMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Total)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeMinutes)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {hasAnomaly ? (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Issues</div>
                            <ul className="m-0 mt-2 list-disc pl-5 text-sm text-amber-900">
                              {anomalies.map((a, idx) => (
                                <li key={`${key}__a__${idx}`} className="py-0.5">
                                  <span className="font-mono text-xs">{a}</span>
                                  <span className="text-amber-700"> — </span>
                                  <span>{prettyAnomaly(a)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-zinc-500">No issues.</div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-600">
                  No data.
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
