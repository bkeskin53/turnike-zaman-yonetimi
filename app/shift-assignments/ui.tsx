"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

type ShiftTemplate = {
  id: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
};

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getThisWeeksMondayISO(): string {
  const d = new Date();
  // JS: Sun=0..Sat=6. We want Monday.
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7; // Mon->0, Sun->6
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diffToMonday);
  return toISODate(monday);
}

function nameOf(e: Employee) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

export default function ShiftAssignmentsClient() {
  const [weekStartDate, setWeekStartDate] = useState(getThisWeeksMondayISO);
  const [shiftTemplateId, setShiftTemplateId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [weekTemplateByEmployeeId, setWeekTemplateByEmployeeId] = useState<Record<string, string | null>>({});
  const [weekTemplateLabelByEmployeeId, setWeekTemplateLabelByEmployeeId] = useState<Record<string, string | null>>({});
  const [weekTemplateActiveByEmployeeId, setWeekTemplateActiveByEmployeeId] = useState<Record<string, boolean | null>>({});
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Auto-hide success/info notice after 3 seconds
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Auto-hide error after 7 seconds (user needs more time to read)
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 7000);
    return () => window.clearTimeout(t);
  }, [error]);

  const selectedIds = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id);
  }, [selected]);

  // If selection becomes empty, auto-disable "show only selected"
  useEffect(() => {
    if (selectedIds.length === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [selectedIds.length, showSelectedOnly]);

  const changeCandidateIds = useMemo(() => {
    // If week mapping not loaded yet, fall back to selectedIds (we'll let API handle idempotency)
    if (!shiftTemplateId) return selectedIds;
    if (!weekTemplateByEmployeeId) return selectedIds;
    return selectedIds.filter((id) => (weekTemplateByEmployeeId[id] ?? null) !== shiftTemplateId);
  }, [selectedIds, weekTemplateByEmployeeId, shiftTemplateId]);

  const templateLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templates) {
      m[t.id] = `${t.signature} (${t.startTime}-${t.endTime}${t.spansMidnight ? "+1" : ""})`;
    }
    return m;
  }, [templates]);

  const isWeekStartMonday = useMemo(() => {
    const dt = DateTime.fromISO(weekStartDate);
    return dt.isValid && dt.weekday === 1;
  }, [weekStartDate]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!weekStartDate) return false;
    if (!isWeekStartMonday) return false;
    if (!shiftTemplateId) return false;
    if (selectedIds.length === 0) return false;
    return true;
  }, [submitting, weekStartDate, isWeekStartMonday, shiftTemplateId, selectedIds.length, onlyChanged, changeCandidateIds.length]);

  async function loadWeekAssignments(forWeekStartDate: string) {
    if (!forWeekStartDate) return;
    if (!DateTime.fromISO(forWeekStartDate).isValid) return;
    if (!isWeekStartMonday) {
      setWeekTemplateByEmployeeId({});
      return;
    }
    setLoadingWeek(true);
    try {
      const res = await fetch(`/api/shift-assignments/week?weekStartDate=${encodeURIComponent(forWeekStartDate)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return; // UI’da sessiz geç; zaten submit disable / uyarı var
      setWeekTemplateByEmployeeId(json.byEmployeeId ?? {});
      setWeekTemplateLabelByEmployeeId(json.byEmployeeIdLabel ?? {});
      setWeekTemplateActiveByEmployeeId(json.byEmployeeIdIsActive ?? {});
    } finally {
      setLoadingWeek(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = onlyActive ? employees.filter((e) => e.isActive) : employees;
    const selectedFiltered = showSelectedOnly ? base.filter((e) => !!selected[e.id]) : base;
    if (!q) return selectedFiltered;
    return selectedFiltered.filter((e) => {
      const code = (e.employeeCode ?? "").toLowerCase();
      const nm = nameOf(e).toLowerCase();
      return code.includes(q) || nm.includes(q);
    });
  }, [employees, search, onlyActive, showSelectedOnly, selected]);

  const allVisibleSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    return filteredEmployees.every((e) => selected[e.id]);
  }, [filteredEmployees, selected]);

  function toggleAllVisible(next: boolean) {
    setSelected((prev) => {
      const copy = { ...prev };
      for (const e of filteredEmployees) copy[e.id] = next;
      return copy;
    });
  }

  function selectNoWeekPlansVisible() {
    // Select only employees currently visible under filters/search
    // whose weekly plan (week template) is empty for the selected week.
    setSelected((prev) => {
      const next = { ...prev };
      for (const e of filteredEmployees) {
        const tplId = weekTemplateByEmployeeId[e.id] ?? null;
        if (!tplId) next[e.id] = true;
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [empRes, tplRes] = await Promise.all([
        fetch("/api/employees", { cache: "no-store", credentials: "include" }),
        fetch("/api/shift-templates?includeInactive=1", { cache: "no-store", credentials: "include" }),
      ]);
      if (!empRes.ok) throw new Error(`GET /api/employees failed: ${empRes.status}`);
      if (!tplRes.ok) throw new Error(`GET /api/shift-templates failed: ${tplRes.status}`);

      const empJson = await empRes.json();
      const tplJson = await tplRes.json();
      const empItems: Employee[] = empJson.items ?? [];
      const tplItems: ShiftTemplate[] = tplJson.items ?? [];

      setEmployees(empItems);
      setTemplates(tplItems);
      if (!shiftTemplateId) {
        const firstActive = tplItems.find((t) => t.isActive);
        if (firstActive) setShiftTemplateId(firstActive.id);
      }
      // Load current week mapping after initial data load
      await loadWeekAssignments(weekStartDate);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When week changes, refresh mapping (only if Monday)
    loadWeekAssignments(weekStartDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartDate, isWeekStartMonday]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (!weekStartDate) throw new Error("Week start date required");
      if (!isWeekStartMonday) {
        throw new Error("Hafta başlangıcı Pazartesi olmalı.");
      }
      if (!shiftTemplateId) throw new Error("Shift template required");
      if (selectedIds.length === 0) throw new Error("En az 1 personel seçmelisin");

      // Backend is the single source of truth for diff calculation.

      const res = await fetch("/api/shift-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate, shiftTemplateId, employeeIds: selectedIds, onlyChanged }),
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = json?.error ? String(json.error) : `HTTP_${res.status}`;
        throw new Error(code);
      }
      const requested = Number(json?.requested ?? selectedIds.length);
      const updated = Number(json?.updated ?? 0);
      const skipped = Number(json?.skipped ?? Math.max(0, requested - updated));

      // Always show counts to avoid “sessiz” hissi
      if (updated === 0) {
        setNotice(`Değişiklik yok. Güncellenen: 0 · Zaten aynı: ${skipped} · İstek: ${requested}`);
      } else {
        setNotice(`Uygulandı. Güncellenen: ${updated} · Zaten aynı: ${skipped} · İstek: ${requested}`);
      }

      // Refresh badges after successful apply
      await loadWeekAssignments(weekStartDate);

      // Clear selection after success to avoid accidental re-apply
      setSelected({});
    } catch (e: any) {
      setError(e?.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      {/* 
        Prevent layout "jump" when the Monday warning appears/disappears.
        Root cause: page height changes -> browser vertical scrollbar toggles -> viewport width changes.
        Fix: keep scrollbar gutter stable (modern) + force consistent scrollbar behavior (fallback).
      */}
      <style jsx global>{`
        html {
          scrollbar-gutter: stable;
        }
        body {
          overflow-y: scroll;
        }
      `}</style>
      {/* Toast-like messages (top-right, compact) */}
      <div
        className="fixed right-4 top-[72px] z-[9999] grid w-[min(420px,calc(100vw-32px))] gap-2.5 pointer-events-none"
      >
        {error && (
          <div
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
          >
            <div className="text-sm leading-[18px] whitespace-pre-wrap">
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              aria-label="Close error"
              title="Kapat"
              className="rounded-md p-1 text-sm leading-none text-red-800/90 hover:bg-red-100"
            >
              ✕
            </button>
          </div>
        )}

        {notice && (
          <div
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
          >
            <div className="text-sm leading-[18px] whitespace-pre-wrap">
              {notice}
            </div>
            <button
              onClick={() => setNotice(null)}
              aria-label="Close notice"
              title="Kapat"
              className="rounded-md p-1 text-sm leading-none text-emerald-800/90 hover:bg-emerald-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>
            {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4">
          {/* Row 1 */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="grid gap-1.5">
                <div className="text-xs text-zinc-500">Hafta (Pzt)</div>
                <input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => {
                    setWeekStartDate(e.target.value);
                    setError(null);
                    setNotice(null);
                  }}
                  className="h-10 w-[170px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <div
                  className="mt-1 h-4 text-[11px] leading-4 text-red-700"
                  style={{ visibility: isWeekStartMonday ? "hidden" : "visible" }}
                >
                  Pazartesi seçmelisin
                </div>
              </div>

              <div className="grid min-w-[240px] flex-1 gap-1.5">
                <div className="text-xs text-zinc-500">Week Template</div>
                <select
                  value={shiftTemplateId}
                  onChange={(e) => setShiftTemplateId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                  <option value="" disabled>
                    Seç...
                  </option>
                  {templates
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.signature} ({t.startTime}-{t.endTime}
                        {t.spansMidnight ? "+1" : ""})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                title="Yenile"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
              <button
                onClick={selectNoWeekPlansVisible}
                disabled={loadingWeek || filteredEmployees.length === 0}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                title={loadingWeek ? "Hafta bilgileri yükleniyor..." : "Görünen listede haftası olmayanları seç"}
              >
                Bu haftası olmayanları seç
              </button>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid flex-1 gap-1.5 min-w-[260px]">
              <div className="text-xs text-zinc-500">Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kod / Ad"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <label
              className="inline-flex h-10 select-none items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700"
              title="Kapalıysa pasif personeller de listede görünür"
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="h-4 w-4"
              />
              Sadece aktifleri göster
            </label>
          </div>
        </div>
      </div>

      <div className="text-sm text-zinc-600">
        Bu ekran sadece <b>WEEK_TEMPLATE</b> (WeeklyShiftPlan.shiftTemplateId) atar. <b>Day Template</b> /{" "}
        <b>Custom</b> / <b>Manual</b> override'lar <b>asla</b> ezilmez.
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-600">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mevcut Week</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEmployees.map((e) => (
                <tr
                  key={e.id}
                  className={
                    (selected[e.id] ? "bg-zinc-50" : "bg-white") +
                    " cursor-pointer hover:bg-zinc-50/70"
                  }
                  tabIndex={0}
                  title="Satıra tıklayarak seçimi aç/kapat"
                  onClick={(ev) => {
                    const target = ev.target as HTMLElement | null;
                    if (target?.closest("input")) return;
                    toggleOne(e.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      toggleOne(e.id);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!selected[e.id]}
                      onChange={(ev) =>
                        setSelected((prev) => ({
                          ...prev,
                          [e.id]: ev.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono">{e.employeeCode}</td>
                  <td className="px-4 py-3">{nameOf(e)}</td>
                  <td className="px-4 py-3">
                    {loadingWeek ? (
                      <span className="text-zinc-500">...</span>
                    ) : (() => {
                      const tplId = weekTemplateByEmployeeId[e.id] ?? null;
                      if (!tplId) return <span className="text-zinc-500">—</span>;
                      const label =
                        (weekTemplateLabelByEmployeeId[e.id] ?? null) ??
                        (templateLabelById[tplId] ?? tplId);
                      const active = weekTemplateActiveByEmployeeId[e.id];
                      return (
                        <span className="inline-flex items-center gap-2">
                          <span
                            title={label}
                            className="inline-block max-w-[360px] truncate rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700"
                          >
                            {label}
                          </span>
                          {active === false ? (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                              Pasif
                            </span>
                          ) : null}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        e.isActive
                          ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                          : "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                      }
                      title={e.isActive ? "Personel aktif" : "Personel pasif"}
                    >
                      {e.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-zinc-500">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="h-10 rounded-xl border border-zinc-900 bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              title={!canSubmit ? "Seçim ve haftanın Pazartesi olması gerekli" : "Seçili personele haftalık atamayı uygula"}
            >
              {submitting ? "Applying..." : `Uygula (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={() => setSelected({})}
              disabled={submitting || selectedIds.length === 0}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={selectedIds.length === 0 ? "Seçili personel yok" : "Tüm seçimleri kaldır"}
            >
              Seçimi temizle
            </button>

            <label
              className="inline-flex h-10 select-none items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700"
              title="Aynı template olanlara yazmaz (idempotent)."
            >
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
                className="h-4 w-4"
              />
              Sadece değişecekleri uygula
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0) return;
                setShowSelectedOnly((v) => !v);
              }}
              disabled={selectedIds.length === 0}
              className={
                "h-9 rounded-full border px-3 text-xs font-semibold " +
                (showSelectedOnly
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100") +
                " disabled:cursor-not-allowed disabled:opacity-60"
              }
              title={
                selectedIds.length === 0
                  ? "Seçili personel yok"
                  : showSelectedOnly
                    ? "Tüm listeyi göster"
                    : "Sadece seçilileri göster"
              }
            >
              Seçili <span className="font-bold">{selectedIds.length}</span>
              {showSelectedOnly ? <span className="ml-1 opacity-80">· Filtre</span> : null}
            </button>

            {onlyChanged ? (
              <span
                className="h-9 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700"
                title="Mevcut week template farklı olanlar"
              >
                Değişecek <span className="ml-1 font-bold">{changeCandidateIds.length}</span>
              </span>
            ) : null}

            <span className="h-9 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700">
              Template <span className="ml-1 font-bold">{shiftTemplateId ? "Seçili" : "—"}</span>
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Not: Bu işlem günlük override'ları etkilemez. (Day Template / Custom / Manual her zaman üst katmandır.)
        </div>
      </div>  
    </div>
  );
}