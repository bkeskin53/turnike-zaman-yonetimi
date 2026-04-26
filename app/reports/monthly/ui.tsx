"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type MonthlyItem = any;
type MonthlyCoverage = {
  expectedEmployeeCount: number;
  daysInMonth: number;
  expectedRows: number;
  computedRows: number;
  missingRows: number;
  coveragePct: number;
  isComplete: boolean;
  missingDayKeys: string[];
} | null;

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";
function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return { chip: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45", soft: "border-sky-200/70 bg-gradient-to-br from-white via-sky-50/65 to-cyan-50/55" };
    case "good":
      return { chip: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45", soft: "border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/65 to-teal-50/55" };
    case "warn":
      return { chip: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45", soft: "border-amber-200/70 bg-gradient-to-br from-white via-amber-50/70 to-orange-50/55" };
    case "violet":
      return { chip: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45", soft: "border-indigo-200/70 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/60" };
    case "danger":
      return { chip: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45", soft: "border-rose-200/70 bg-gradient-to-br from-white via-rose-50/65 to-pink-50/55" };
    default:
      return { chip: "bg-slate-100/90 text-slate-700 ring-slate-300/55", soft: "border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))]" };
  }
}

function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset shadow-sm", t.chip)}>
      {children}
    </span>
  );
}

function SkeletonLine({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-lg bg-[linear-gradient(90deg,rgba(226,232,240,0.9),rgba(241,245,249,1),rgba(226,232,240,0.9))]",
        className
      )}
    />
  );
}

function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  title,
  type = "button",
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.22)] hover:brightness-105"
      : variant === "danger"
      ? "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.16)] hover:brightness-105"
      : variant === "ghost"
      ? "bg-transparent text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700"
      : "border border-slate-200/80 bg-white/88 text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-indigo-200 hover:bg-indigo-50/50";
  return (
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

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
  if (kind === "ok") return "bg-emerald-50/90 text-emerald-800 ring-1 ring-emerald-200/70";
  if (kind === "warn") return "bg-amber-50/90 text-amber-900 ring-1 ring-amber-200/70";
  if (kind === "bad") return "bg-rose-50/90 text-rose-800 ring-1 ring-rose-200/70";
  return "bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/70";
}

function anomalyLabel(code: string): string {
  switch (code) {
    case "LATE_OUT_CAPTURED":
      return "Geç OUT yakalandı (ertesi güne sarkan çıkış bugünü kapattı)";
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT çifti tamamlanmamış)";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "UNSCHEDULED_WORK":
      return "Vardiya dışı fiili çalışma (planlanan vardiya ile uyuşmuyor)";
    case "OUTSIDE_SHIFT_IGNORED":
      return "Vardiya penceresi dışında punch (CLAMP: worked'e dahil edilmedi)";
    default:
      return code;
  }
}

type MonthlyFilter =
  | "ALL"
  | "MISSING_PUNCH"
  | "MANUAL"
  | "HAS_ANY_ANOMALY";

export default function MonthlyReportClient(props: { canRecompute: boolean; role: string }) {
  const [month, setMonth] = useState(() => {
    // Local ay (UTC değil): ay başında/sonunda "bir önceki ay"a düşme bug'ını engeller
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }); // YYYY-MM
  const [items, setItems] = useState<MonthlyItem[]>([]);
  const [coverage, setCoverage] = useState<MonthlyCoverage>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      if (!res.ok) {
        if (res.status === 403) {
          // Scope dışı: supervisor bu personelin anomalilerini göremez.
          setAnomalyMap((p) => ({ ...p, [employeeId]: [] }));
          return;
        }
        throw new Error("anomaly load failed");
      }
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

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const qs = new URLSearchParams({ month });

      const res = await fetch(`/api/reports/monthly?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Bu raporu görüntülemek için yetkiniz yok.");
        }

        throw new Error(`GET monthly failed: ${res.status}`);
      }

      const json = await res.json();
      setItems(json.items ?? []);
      setCoverage(json.coverage ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  async function recomputeMonth() {
    if (!props.canRecompute) {
      setError(null);
      setNotice("Bu rolde Recompute yetkiniz yok. Raporu görüntüleyebilirsiniz (read-only).");
     return;
    }
    setLoadingRecompute(true);
    setError(null);
    setNotice(null);
    try {
      const [y, m] = month.split("-");
      if (!y || !m) throw new Error("Invalid month format");

      const year = Number(y);
      const monthIndex = Number(m) - 1;

      const startDayKey = `${y}-${m}-01`;

      const endDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const endDayKey = `${y}-${m}-${String(endDay).padStart(2, "0")}`;

      const res = await fetch(`/api/admin/recompute-required`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rangeStartDayKey: startDayKey,
          rangeEndDayKey: endDayKey,
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          setNotice("Recompute işlemi için yetkiniz yok (403).");
          return;
        }

        throw new Error(`Recompute job creation failed: ${res.status}`);
      }

      setNotice("Recompute job queued");
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

  const coverageTone: Tone = useMemo(() => {
    if (!coverage) return "neutral";
    if (coverage.isComplete) return "good";
    if ((coverage.coveragePct ?? 0) >= 80) return "warn";
    return "danger";
  }, [coverage]);

  const initialLoading = loading && !hasLoadedOnce;
  const refreshing = loading && hasLoadedOnce;

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

      {/* Access / Role banner (Daily pattern) */}
      <div className={cx("rounded-2xl border p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]", toneStyles(props.canRecompute ? "violet" : "warn").soft)}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-extrabold tracking-tight text-slate-950">Aylık Rapor</div>
              <PillBadge tone="violet">Monthly</PillBadge>
              <PillBadge tone="neutral">Role: {props.role}</PillBadge>
              {!props.canRecompute ? <PillBadge tone="warn">Read-only</PillBadge> : <PillBadge tone="good">Recompute açık</PillBadge>}
            </div>
            <div className="mt-1 text-sm text-slate-600 font-medium leading-relaxed">
              Bu ekran ay özetini gösterir. Recompute, operasyonel bir aksiyondur ve sadece yetkili roller tarafından çalıştırılabilir.
            </div>
            {!props.canRecompute ? (
              <div className="mt-2 text-[11px] text-amber-900/80">
                Not: Görülen sonuçlar en son yapılan hesap çıktısıdır. Güncelleme için yetkili bir rol ile recompute gerekir.
              </div>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Coverage / completeness */}
      {coverage ? (
        <div className={cx("rounded-2xl border p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]", toneStyles(coverageTone).soft)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-extrabold tracking-tight text-slate-950">Coverage</div>
                <PillBadge tone={coverageTone}>
                  {coverage.isComplete ? "Complete" : "Incomplete"}
                </PillBadge>
                <PillBadge tone="neutral">%{coverage.coveragePct}</PillBadge>
              </div>
              <div className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                Monthly rapor yalnızca mevcut günlük hesap kayıtlarını toplar. Eksik daily coverage varsa bu ayın rakamları kısmi olabilir.
              </div>
              <div className="mt-3 flex max-w-full flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200/80">
                  Beklenen Satır <span className="font-semibold">{coverage.expectedRows}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50/90 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-200/70">
                  Hesaplanan <span className="font-semibold">{coverage.computedRows}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50/90 px-2.5 py-1 text-amber-900 ring-1 ring-amber-200/70">
                  Eksik <span className="font-semibold">{coverage.missingRows}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50/90 px-2.5 py-1 text-indigo-800 ring-1 ring-indigo-200/70">
                  Personel <span className="font-semibold">{coverage.expectedEmployeeCount}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200/80">
                  Gün <span className="font-semibold">{coverage.daysInMonth}</span>
                </span>
              </div>
              {!coverage.isComplete && (coverage.missingDayKeys?.length ?? 0) > 0 ? (
                <div className="mt-3 text-[11px] text-slate-600">
                  Eksik gün örnekleri: {coverage.missingDayKeys.slice(0, 8).join(", ")}
                  {coverage.missingDayKeys.length > 8 ? " ..." : ""}
                </div>
              ) : null}
            </div>

            {!coverage.isComplete ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/admin/recompute-required"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(79,70,229,0.22)] hover:brightness-105"
                  title="Eksik günlük hesaplar için recompute kuyruğunu aç"
                >
                  Recompute Kuyruğunu Aç
                </a>
                <a
                  href="/reports/daily"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-indigo-200 hover:bg-indigo-50/50"
                  title="Günlük coverage ve sonuçları incele"
                >
                  Daily Rapor
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.94))] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Month</span>
            <input
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              onKeyDown={onToolbarKeyDown}
            />
          </label>

          <Button
            variant="primary"
            onClick={recomputeMonth}
            disabled={loadingRecompute || !props.canRecompute}
            title={!props.canRecompute ? "Bu rolde Recompute yetkisi yok" : "Seçili ay aralığı için recompute job oluştur"}
          >
            {loadingRecompute ? "Recomputing…" : "Recompute"}
          </Button>

          <Button variant="secondary" onClick={() => load()} disabled={loading} title="Listeyi yenile">
            {loading ? "Loading…" : "Refresh"}
          </Button>

          <a
            href={`/api/reports/monthly/export?month=${encodeURIComponent(month)}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-indigo-200 hover:bg-indigo-50/50"
            title="Excel için CSV indirir. Eksik coverage varsa dosya kısmi sonuç içerebilir."
          >
            CSV İndir
          </a>
          <a
            href={`/api/reports/monthly/anomalies/export?month=${encodeURIComponent(month)}`}
            className={
              "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-indigo-200 hover:bg-indigo-50/50 " +
              (loading ? "pointer-events-none opacity-50" : "")
            }
            title="Seçili ayın anomaly kayıtlarını CSV olarak indirir. Eksik coverage varsa dosya kısmi olabilir."
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
             (filter === "ALL" ? "bg-[linear-gradient(135deg,#312e81,#4f46e5)] text-white shadow-[0_12px_24px_rgba(79,70,229,0.20)]" : "bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/80")
           }
           title="Filtreyi temizle"
         >
           Employees <span className="font-semibold">{summary.employees}</span>
         </button>

         <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-emerald-50/90 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-200/70">
           Worked <span className="font-semibold">{summary.workedMinutes}</span>
         </span>

         <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-indigo-50/90 px-2.5 py-1 text-indigo-800 ring-1 ring-indigo-200/70">
           OT <span className="font-semibold">{summary.overtimeMinutes}</span>
         </span>

         <button
          type="button"
           onClick={() => setFilter(filter === "MISSING_PUNCH" ? "ALL" : "MISSING_PUNCH")}
           className={
             "inline-flex max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1 " +
             (filter === "MISSING_PUNCH" ? "bg-[linear-gradient(135deg,#d97706,#f59e0b)] text-white shadow-[0_12px_24px_rgba(217,119,6,0.18)]" : "bg-amber-50/90 text-amber-900 ring-1 ring-amber-200/70")
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
             (filter === "MANUAL" ? "bg-[linear-gradient(135deg,#0f172a,#334155)] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : "bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/80")
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
             (filter === "HAS_ANY_ANOMALY" ? "bg-[linear-gradient(135deg,#be123c,#f43f5e)] text-white shadow-[0_12px_24px_rgba(190,24,93,0.18)]" : "bg-rose-50/90 text-rose-800 ring-1 ring-rose-200/70")
           }
           title="Ay içinde en az 1 anomali olanlar (detay yüklendiyse kesin, değilse MissingPunch üzerinden tahmini)"
         >
           Anomali
         </button>
        </div>
      </div>
      
      {notice ? (
        <div className={cx("flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", toneStyles("warn").soft)}>
          <div className="text-amber-900 font-semibold">{notice}</div>
          <Button variant="ghost" onClick={() => setNotice(null)} title="Kapat">
            <span className="text-amber-900 font-semibold">Kapat</span>
          </Button>
        </div>
      ) : null}

      {initialLoading ? (
        <div className="rounded-2xl border border-indigo-200/70 bg-[linear-gradient(135deg,rgba(238,242,255,0.96),rgba(255,255,255,0.96))] px-4 py-4 shadow-[0_16px_36px_rgba(79,70,229,0.08)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-slate-950">
                Aylık kayıtlar hazırlanıyor
              </div>
              <div className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                Personel satırları, coverage ve özet alanları yükleniyor. Özellikle çok personelli aylarda bu işlem birkaç saniye sürebilir.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="rounded-xl border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))] px-4 py-3 text-sm text-rose-900 shadow-[0_12px_28px_rgba(244,63,94,0.08)]">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="relative max-w-full rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_18px_38px_rgba(15,23,42,0.06)] backdrop-blur-sm">
         {refreshing ? (
           <div className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-[0_10px_24px_rgba(79,70,229,0.10)]">
             <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
             Liste güncelleniyor…
           </div>
         ) : null}
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
            <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(248,250,252,0.96))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="border-b border-slate-200 px-3 py-2">Code</th>
                <th className="border-b border-slate-200 px-3 py-2">Name</th>
                <th className="border-b border-slate-200 px-3 py-2">Shift</th>
                <th className="border-b border-slate-200 px-3 py-2">Worked</th>
                <th className="border-b border-slate-200 px-3 py-2">Days</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading
                ? Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`monthly-skeleton-${idx}`} className="border-t border-zinc-100">
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-4 w-16" />
                      </td>
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-4 w-40" />
                      </td>
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-4 w-full max-w-[220px]" />
                      </td>
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-4 w-14" />
                      </td>
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-4 w-24" />
                      </td>
                      <td className="px-3 py-3">
                        <SkeletonLine className="h-8 w-24 rounded-md" />
                      </td>
                    </tr>
                  ))
                : null}

              {!initialLoading && visibleItems.map((it: any) => {
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
                          <span className="inline-flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
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
                            <div className="rounded-xl border border-indigo-200/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,242,255,0.72))] p-3 shadow-[0_10px_24px_rgba(99,102,241,0.06)]">
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
                            <div className="rounded-xl border border-sky-200/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,249,255,0.72))] p-3 shadow-[0_10px_24px_rgba(14,165,233,0.06)]">
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
                            <div className="rounded-xl border border-violet-200/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.72))] p-3 shadow-[0_10px_24px_rgba(139,92,246,0.06)]">
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
                          <div className="mt-3 rounded-xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] p-3 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
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
                            <div className="mt-3 rounded-xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-3 py-2 text-sm text-slate-700">
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
              {!loading && visibleItems.length === 0 && (
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
