"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-slate-100/90 text-slate-700 ring-slate-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    info: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45 shadow-[0_8px_22px_rgba(14,165,233,0.12)]",
    good: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45 shadow-[0_8px_22px_rgba(16,185,129,0.12)]",
    warn: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45 shadow-[0_8px_22px_rgba(245,158,11,0.10)]",
    danger: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45 shadow-[0_8px_22px_rgba(244,63,94,0.10)]",
    violet: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45 shadow-[0_10px_24px_rgba(99,102,241,0.12)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset shadow-sm uppercase tracking-tight",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function Card({
  tone = "neutral",
  title,
  subtitle,
  right,
  children,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "border-slate-200/60 from-white/96 via-slate-50/92 to-slate-100/88",
    info: "border-sky-200/55 from-white/96 via-sky-50/88 to-cyan-50/78",
    good: "border-emerald-200/55 from-white/96 via-emerald-50/88 to-teal-50/76",
    warn: "border-amber-200/60 from-white/96 via-amber-50/88 to-orange-50/78",
    danger: "border-rose-200/60 from-white/96 via-rose-50/88 to-pink-50/78",
    violet: "border-indigo-200/60 from-white/96 via-indigo-50/88 to-violet-50/80",
  };
  return (
    <div
      className={cx(
        "rounded-[26px] border bg-gradient-to-br p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] min-w-0 transition-all duration-300 hover:shadow-[0_24px_55px_rgba(79,70,229,0.12)] backdrop-blur-sm",
        toneBg[tone],
        className
      )}
    >
      {title || subtitle || right ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/70 pb-4">
          <div className="min-w-0">
            {title ? (
              <div className="text-lg font-bold text-slate-950 leading-tight tracking-tight">{title}</div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-sm text-slate-600 font-medium leading-relaxed">{subtitle}</div>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const map = {
    primary: "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] hover:brightness-105",
    secondary: "border border-slate-200/80 bg-white/88 text-slate-700 backdrop-blur-sm hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-slate-950",
    ghost: "bg-transparent text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700 border border-transparent",
    danger: "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:brightness-105",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.92))] px-3 py-2.5 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.05)] font-medium text-slate-800 transition-all " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 focus:bg-white";

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

export default function ShiftAssignmentsClient({ canWrite }: { canWrite: boolean }) {
  const readOnly = !canWrite;
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
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

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

  // Filters değişince sayfayı 1'e çek
  useEffect(() => {
    setPage(1);
  }, [search, onlyActive, showSelectedOnly, pageSize]);

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

  const totalCount = useMemo(() => filteredEmployees.length, [filteredEmployees.length]);

  const totalPages = useMemo(() => {
    const ps = Math.max(1, Number(pageSize) || 50);
    return Math.max(1, Math.ceil(totalCount / ps));
  }, [totalCount, pageSize]);

  // Clamp page when totalPages shrinks
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pageEmployees = useMemo(() => {
    const ps = Math.max(1, Number(pageSize) || 50);
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (p - 1) * ps;
    return filteredEmployees.slice(start, start + ps);
  }, [filteredEmployees, page, pageSize, totalPages]);

  const allVisibleSelected = useMemo(() => {
    if (pageEmployees.length === 0) return false;
    return pageEmployees.every((e) => selected[e.id]);
  }, [pageEmployees, selected]);

  function toggleAllVisible(next: boolean) {
    if (readOnly) return;
    setSelected((prev) => {
      const copy = { ...prev };
      for (const e of pageEmployees) copy[e.id] = next;
      return copy;
    });
  }

  function selectNoWeekPlansVisible() {
    // Select only employees currently visible under filters/search
    // whose weekly plan (week template) is empty for the selected week.
    setSelected((prev) => {
      const next = { ...prev };
      for (const e of pageEmployees) {
        const tplId = weekTemplateByEmployeeId[e.id] ?? null;
        if (!tplId) next[e.id] = true;
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    if (readOnly) return;
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
    if (readOnly) return;
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
    <div className="grid gap-6 w-full max-w-full overflow-x-hidden p-2 md:p-6 animate-in fade-in duration-500">
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
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-rose-800 shadow-[0_16px_36px_rgba(244,63,94,0.12)]"
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
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-emerald-800 shadow-[0_16px_36px_rgba(16,185,129,0.10)]"
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
      {/* Header / Toolbar (Employee sayfası stili) */}
      <Card
        tone="violet"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Toplu Vardiya</span>
            <Badge tone="violet">Stage 4 • WEEK_TEMPLATE</Badge>
            {loading ? <Badge tone="info">Yükleniyor…</Badge> : null}
            {loadingWeek ? <Badge tone="info">Hafta okunuyor…</Badge> : null}
            {readOnly ? <Badge tone="warn">Read-only</Badge> : null}
          </div>
        }
        subtitle={
          <>
            Bu ekran sadece <b>WEEK_TEMPLATE</b> (WeeklyShiftPlan.shiftTemplateId) atar.{" "}
            <b>Day Template</b> / <b>Custom</b> / <b>Manual</b> override'lar <b>asla</b> ezilmez.
          </>
        }
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading} title="Yenile">
              {loading ? "Yükleniyor…" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              onClick={selectNoWeekPlansVisible}
              disabled={readOnly || loadingWeek || filteredEmployees.length === 0}
              title={loadingWeek ? "Hafta bilgileri yükleniyor..." : "Görünen listede haftası olmayanları seç"}
            >
              Bu haftası olmayanları seç
            </Button>
          </div>
        }
      >
        {readOnly ? (
          <div className="mb-4 rounded-xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm font-semibold text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
            İnceleme modu: toplu atama yapamazsın. Listeleme/filtreleme serbesttir.
          </div>
        ) : null}
        <div className="grid gap-4">
          {/* Row 1 */}
          <div className="grid gap-4 md:grid-cols-2 lg:flex lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-start gap-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Hafta (Pzt)</span>
                <input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => {
                    setWeekStartDate(e.target.value);
                    setError(null);
                    setNotice(null);
                  }}
                  className={cx(inputClass, "w-[170px]")}
                  disabled={loading || submitting}
                />
                <div
                  className="mt-0.5 h-4 text-[11px] leading-4 text-rose-700 font-semibold"
                  style={{ visibility: isWeekStartMonday ? "hidden" : "visible" }}
                >
                  Pazartesi seçmelisin
                </div>
              </label>

              <label className="grid gap-1.5 min-w-[240px] flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Week Template</span>
                <select
                  value={shiftTemplateId}
                  onChange={(e) => setShiftTemplateId(e.target.value)}
                  className={inputClass}
                  disabled={loading || submitting || readOnly}
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
              </label>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid gap-3 md:grid-cols-2 lg:flex lg:items-end lg:gap-3">
            <label className="grid flex-1 gap-1.5 min-w-[260px]">
              <span className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Arama</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kod / Ad"
                className={inputClass}
                disabled={loading}
              />
            </label>
            
            <div className="grid gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Sayfa</span>
              <select
                className={cx(inputClass, "w-28")}
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                title="Sayfa boyutu"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>

            <label
              className="inline-flex select-none items-center gap-2 rounded-xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.92))] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              title="Kapalıysa pasif personeller de listede görünür"
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="h-4 w-4 rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                disabled={loading}
              />
              Sadece aktifleri göster
            </label>

            <div className="lg:ml-auto flex items-center gap-2">
              <div className="text-sm font-medium text-slate-500 whitespace-nowrap">
                {loading ? "Yükleniyor…" : `Toplam: ${totalCount}`}
              </div>
            </div>

          </div>
        </div>
      </Card>

      {/* Table */}
      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Personel Listesi</span>
            <Badge tone="info">{loading ? "Yükleniyor…" : `${filteredEmployees.length} sonuç`}</Badge>
          </div>
        }
        subtitle="Satıra tıklayarak seçim yapın. Checkbox ile de seçebilirsiniz."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_18px_38px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,rgba(232,238,252,0.98),rgba(244,247,252,0.96))] text-slate-700 sticky top-0 z-10">
              <tr>
                <th className="w-12 px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    className="rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    title="Görünenlerin tümünü seç/kaldır"
                    disabled={readOnly || loading || submitting || pageEmployees.length === 0}
                  />
                </th>
                <th className="w-[160px] px-4 py-4 text-left font-bold text-slate-500 uppercase text-[11px] tracking-widest">
                  Code
                </th>
                <th className="px-4 py-4 text-left font-bold text-slate-500 uppercase text-[11px] tracking-widest">
                  Name
                </th>
                <th className="px-4 py-4 text-left font-bold text-slate-500 uppercase text-[11px] tracking-widest">
                  Mevcut Week
                </th>
                <th className="w-[140px] px-4 py-4 text-center font-bold text-slate-500 uppercase text-[11px] tracking-widest">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/90">
              {pageEmployees.map((e) => (
                <tr
                  key={e.id}
                  className={cx(
                    "group cursor-pointer transition-colors",
                    selected[e.id]
                      ? "bg-[linear-gradient(90deg,rgba(238,242,255,0.85),rgba(248,250,252,0.9))]"
                      : "bg-white/88 hover:bg-[linear-gradient(90deg,rgba(248,250,252,0.92),rgba(238,242,255,0.60))]",
                  )}
                  tabIndex={0}
                  title="Satıra tıklayarak seçimi aç/kapat"
                  onClick={(ev) => {
                    if (readOnly) return;
                    const target = ev.target as HTMLElement | null;
                    if (target?.closest("input")) return;
                    toggleOne(e.id);
                  }}
                  onKeyDown={(ev) => {
                    if (readOnly) return;
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      toggleOne(e.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={!!selected[e.id]}
                      onChange={(ev) =>
                        setSelected((prev) => ({
                          ...prev,
                          [e.id]: ev.target.checked,
                        }))
                      }
                      className="rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={readOnly || submitting}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{e.employeeCode}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-950">{nameOf(e)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {loadingWeek ? (
                      <span className="text-slate-500">...</span>
                    ) : (() => {
                      const tplId = weekTemplateByEmployeeId[e.id] ?? null;
                      if (!tplId) return <span className="text-slate-500">—</span>;
                      const label =
                        (weekTemplateLabelByEmployeeId[e.id] ?? null) ??
                        (templateLabelById[tplId] ?? tplId);
                      const active = weekTemplateActiveByEmployeeId[e.id];
                      return (
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span
                            title={label}
                            className="inline-block max-w-[420px] truncate rounded-full border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.92))] px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                          >
                            {label}
                          </span>
                          {active === false ? <Badge tone="warn">Pasif</Badge> : null}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={e.isActive ? "good" : "neutral"}>{e.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                </tr>
              ))}
              {pageEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-slate-600">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            Sayfa <span className="font-medium text-slate-950">{page}</span> /{" "}
            <span className="font-medium text-slate-950">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Önceki
            </Button>
            <Button
              variant="secondary"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki →
            </Button>
          </div>
        </div>
      </Card>

      {/* Bottom action bar */}
      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>İşlem</span>
            <Badge tone={canSubmit ? "good" : "warn"}>{canSubmit ? "Hazır" : "Eksik bilgi"}</Badge>
          </div>
        }
        subtitle="Seçili personele haftalık atamayı uygular. Günlük override'lar etkilenmez."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={submit}
              disabled={readOnly || !canSubmit}
              title={!canSubmit ? "Seçim + Pazartesi + template gerekli" : "Seçili personele haftalık atamayı uygula"}
              className="min-w-[140px]"
            >
              {submitting ? "Applying..." : `Uygula (${selectedIds.length})`}
            </Button>

            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                if (readOnly) return;
                setSelected({});
              }}
              disabled={readOnly || submitting || selectedIds.length === 0}
              title={selectedIds.length === 0 ? "Seçili personel yok" : "Tüm seçimleri kaldır"}
            >
              Seçimi temizle
            </Button>

            <label
              className="inline-flex select-none items-center gap-2 rounded-xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.92))] px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              title="Aynı template olanlara yazmaz (idempotent)."
            >
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
                className="h-4 w-4 rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                disabled={submitting || readOnly}
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
              className={cx(
                "h-9 rounded-full border px-3 text-xs font-semibold transition",
                showSelectedOnly
                  ? "border-indigo-500/30 bg-[linear-gradient(135deg,#4338ca,#6366f1)] text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)]"
                  : "border-slate-200/80 bg-slate-50/90 text-slate-700 hover:bg-slate-100",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
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
                className="h-9 inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/90 px-3 text-xs font-semibold text-amber-900 shadow-[0_8px_20px_rgba(245,158,11,0.06)]"
                title="Mevcut week template farklı olanlar"
              >
                Değişecek <span className="ml-1 font-bold">{changeCandidateIds.length}</span>
              </span>
            ) : null}

            <span className="h-9 inline-flex items-center rounded-full border border-indigo-200/70 bg-indigo-50/85 px-3 text-xs font-semibold text-indigo-800 shadow-[0_8px_20px_rgba(99,102,241,0.06)]">
              Template <span className="ml-1 font-bold">{shiftTemplateId ? "Seçili" : "—"}</span>
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.92))] px-3 py-2 text-xs text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          Not: Bu işlem günlük override'ları etkilemez. (Day Template / Custom / Manual her zaman üst katmandır.)
        </div>
      </Card>  
    </div>
  );
}