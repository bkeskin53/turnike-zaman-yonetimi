"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.414l-7.07 7.07a1 1 0 01-1.414 0L3.296 8.85A1 1 0 014.71 7.436l4.217 4.217 6.364-6.363a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={onChange}
      className={cx(
        "group inline-flex h-7 w-7 items-center justify-center rounded-xl border transition",
        "shadow-[0_8px_18px_rgba(15,23,42,0.05)]",
        checked || indeterminate
          ? "border-indigo-300/70 bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.14))] text-indigo-700"
          : "border-slate-200/80 bg-white/92 text-transparent hover:border-indigo-200 hover:bg-indigo-50/60"
      )}
      title={ariaLabel}
    >
      {indeterminate ? (
        <span className="h-0.5 w-3 rounded-full bg-current" />
      ) : checked ? (
        <CheckIcon />
      ) : (
        <span className="h-3.5 w-3.5 rounded-md border border-dashed border-slate-300/80 group-hover:border-indigo-300/80" />
      )}
    </button>
  );
}

function PlannerShiftSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  className,
}: {
  value: string;
  options: PlannerShiftOption[];
  placeholder: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) setOpen(false);
    }
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((x) => x.id === value) ?? null;
  const compactLabel = selected ? selected.code : placeholder;
  const selectedTitle = selected ? `${selected.code} • ${selected.detail}` : placeholder;

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedTitle}
        onClick={() => !disabled && setOpen((s) => !s)}
        className={cx(
          "flex h-10 w-full items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm transition",
          "border-slate-200/80 bg-white/96 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
          "hover:border-indigo-300/70 hover:bg-indigo-50/35",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
          open && "border-indigo-400/70 ring-2 ring-indigo-500/20",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className={cx("truncate font-medium", selected ? "text-slate-900" : "text-slate-400")}>
          {compactLabel}
        </span>
        <span className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-180")}>
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[220px] overflow-hidden rounded-2xl border border-indigo-200/70 bg-white/98 shadow-[0_24px_50px_rgba(15,23,42,0.18)] backdrop-blur-sm"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={cx(
              "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition",
              !value ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50"
            )}
          >
            <span className="font-medium">{placeholder}</span>
            <span className="text-[11px] text-slate-400">Boş / temizle</span>
          </button>

          <div className="border-t border-slate-100" />

          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={value === opt.id}
              title={`${opt.code} • ${opt.detail}`}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition",
                value === opt.id ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-900"
              )}
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{opt.code}</div>
                <div className={cx("truncate text-[11px]", value === opt.id ? "text-indigo-100" : "text-slate-500")}>
                  {opt.detail}
                </div>
              </div>
              {!opt.isActive ? (
                <span
                  className={cx(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    value === opt.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  Pasif
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
    neutral: "border-slate-200/70 from-white via-slate-50/70 to-slate-100/60",
    info: "border-sky-200/60 from-white via-sky-50/65 to-cyan-50/55",
    good: "border-emerald-200/60 from-white via-emerald-50/65 to-teal-50/55",
    warn: "border-amber-200/65 from-white via-amber-50/70 to-orange-50/55",
    danger: "border-rose-200/65 from-white via-rose-50/65 to-pink-50/55",
    violet: "border-indigo-200/65 from-white via-indigo-50/70 to-violet-50/60",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)] min-w-0 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(79,70,229,0.12)]",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/65 pb-4">
          <div className="min-w-0">
            {title ? (
              <div className="text-lg font-bold text-slate-950 leading-tight tracking-tight">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-sm text-slate-600 font-medium leading-relaxed">
                {subtitle}
              </div>
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
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
  "w-full rounded-xl border border-slate-200/80 bg-white/88 px-3 py-2.5 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] font-medium text-slate-800 transition-all " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 focus:bg-white";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
};

type ShiftTemplate = {
  id: string;
  shiftCode?: string; // prisma: ShiftTemplate.shiftCode (API çoğu yerde döndürüyor)
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
};

type PlannerShiftOption = {
  id: string;
  code: string;
  detail: string;
  isActive: boolean;
  isOff: boolean;
};

type PlannerPlan = {
  employeeId: string;
  rangeTemplateId: string | null;
  dayTemplateIds: Array<string | null>; // length = rangeDays
};

type ResolvedDay = {
  dayKey: string; // YYYY-MM-DD
  shiftTimezone: string;
  shiftSource: string | null;
  shiftCode?: string | null;
  shiftSignature: string | null;
  shiftBadge: string; // "—" | "OFF" | "08:00–17:00"
  shiftStartMinute: number | null;
  shiftEndMinute: number | null;
  shiftSpansMidnight: boolean;
};

type ShiftSourceFilter =
  | "ALL"
  | "POLICY"
  | "WORK_SCHEDULE"
  | "WEEK_TEMPLATE"
  | "DAY_TEMPLATE"
  | "CUSTOM";

type BulkApplyMode = "RANGE" | "DAY";
type BulkApplyAction = "ASSIGN" | "CLEAR";
type BulkApplyTarget = "VISIBLE" | "SELECTED";

type BranchOption = { id: string; code: string; name: string; isActive: boolean };
type EmployeePageMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function trShiftSourceTR(src: string | null | undefined): string {
  const v = String(src ?? "").trim();
  switch (v) {
    case "WEEK_TEMPLATE":
      return "Haftalık Plan";
    case "DAY_TEMPLATE":
      return "Günlük Override";
    case "WORK_SCHEDULE":
      return "Çalışma Planı (Rota)";
    case "POLICY":
      return "Kural (Policy)";
    case "CUSTOM":
      return "Özel";
    default:
      return v || "Sistem";
  }
}

function trShiftSourceShortTR(src: string | null | undefined): string {
  const v = String(src ?? "").trim();
  switch (v) {
    case "WEEK_TEMPLATE":
      return "Plan";
    case "DAY_TEMPLATE":
      return "Override";
    case "WORK_SCHEDULE":
      return "Rota";
    case "POLICY":
      return "Policy";
    case "CUSTOM":
      return "Özel";
    default:
      return v || "Sistem";
  }
}

function sourceTone(src: string | null | undefined): Tone {
  const v = String(src ?? "").trim();
  switch (v) {
    case "WORK_SCHEDULE":
      return "info";
    case "POLICY":
      return "neutral";
    case "WEEK_TEMPLATE":
      return "violet";
    case "DAY_TEMPLATE":
      return "warn";
    case "CUSTOM":
      return "good";
    default:
      return "neutral";
  }
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
}

function getCurrentWeekMondayISO(): string {
  const dt = DateTime.now().startOf("day");
  return dt.minus({ days: dt.weekday - 1 }).toISODate()!;
}

function addDaysISO(iso: string, days: number): string {
  const dt = DateTime.fromISO(iso);
  if (!dt.isValid) return iso;
  return dt.plus({ days }).toISODate() ?? iso;
}

function clampRange(startISO: string, endISO: string) {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid && !e.isValid) {
    const t = todayISO();
    return { start: t, end: t };
  }
  if (!s.isValid) return { start: endISO, end: endISO };
  if (!e.isValid) return { start: startISO, end: startISO };
  if (e < s) return { start: endISO, end: startISO };
  return { start: startISO, end: endISO };
}

function buildDayKeys(startISO: string, endISO: string): string[] {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid || !e.isValid) return [];
  const days = Math.floor(e.diff(s, "days").days) + 1;
  const safeDays = Math.max(1, Math.min(days, 62)); // enterprise guard: 2 aya kadar
  const out: string[] = [];
  for (let i = 0; i < safeDays; i++) out.push(s.plus({ days: i }).toISODate()!);
  return out;
}

function nameOf(e: Employee) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

function weekdayLabelFromISO(iso: string) {
  const dt = DateTime.fromISO(iso);
  const w = dt.isValid ? dt.weekday : 0; // Mon=1..Sun=7
  return ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][w] ?? "";
}

function weekdayHeadClassFromISO(iso: string) {
  const dt = DateTime.fromISO(iso);
  const w = dt.isValid ? dt.weekday : 1;
  return w >= 6 ? "bg-amber-50/70 text-amber-800" : "bg-sky-50/60 text-sky-800";
}

function weekdayCellClassFromISO(iso: string) {
  const dt = DateTime.fromISO(iso);
  const w = dt.isValid ? dt.weekday : 1;
  return w >= 6 ? "bg-amber-50/30" : "bg-sky-50/20";
}

export default function ShiftPlannerClient({ canWrite }: { canWrite: boolean }) {
  const readOnly = !canWrite;
  const [rangeStartDate, setRangeStartDate] = useState(() => getCurrentWeekMondayISO());
  const [rangeEndDate, setRangeEndDate] = useState(() => addDaysISO(getCurrentWeekMondayISO(), 6)); // default: bulunduğu haftanın Pazartesi-Pazar aralığı
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branchCatalog, setBranchCatalog] = useState<BranchOption[]>([]);
  const [employeeMeta, setEmployeeMeta] = useState<EmployeePageMeta>({
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [plansByEmployeeId, setPlansByEmployeeId] = useState<Record<string, PlannerPlan>>({});
  const [dirtyEmployeeIds, setDirtyEmployeeIds] = useState<Record<string, boolean>>({});
  const [resolvedByEmployeeId, setResolvedByEmployeeId] = useState<Record<string, ResolvedDay[]>>({});
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<ShiftSourceFilter>("ALL");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [loadingCore, setLoadingCore] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingPlanner, setLoadingPlanner] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkApplyMode>("RANGE");
  const [bulkAction, setBulkAction] = useState<BulkApplyAction>("ASSIGN");
  const [bulkTarget, setBulkTarget] = useState<BulkApplyTarget>("VISIBLE");
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("");
  const [bulkDayIndex, setBulkDayIndex] = useState<number>(0);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Record<string, boolean>>({});

  // sticky layout jump fix (optional but nice)
  // (no behavior change)

  const clamped = useMemo(() => clampRange(rangeStartDate, rangeEndDate), [rangeStartDate, rangeEndDate]);
  const dayKeys = useMemo(() => buildDayKeys(clamped.start, clamped.end), [clamped.start, clamped.end]);
  const rangeDays = dayKeys.length;

  function isOffTemplate(t: ShiftTemplate): boolean {
    return (
      String((t as any)?.shiftCode ?? "").toUpperCase() === "OFF" ||
      String(t?.signature ?? "").toUpperCase() === "OFF"
    );
  }

  function createEmptyPlan(employeeId: string): PlannerPlan {
    return {
      employeeId,
      rangeTemplateId: null,
      dayTemplateIds: Array.from({ length: rangeDays }).map(() => null),
    };
  }

  function normalizePlanShape(plan: PlannerPlan): PlannerPlan {
    const nextDayTemplateIds = Array.isArray(plan.dayTemplateIds)
      ? [...plan.dayTemplateIds]
      : [];

    if (nextDayTemplateIds.length < rangeDays) {
      while (nextDayTemplateIds.length < rangeDays) nextDayTemplateIds.push(null);
    } else if (nextDayTemplateIds.length > rangeDays) {
      nextDayTemplateIds.length = rangeDays;
    }

    return {
      ...plan,
      dayTemplateIds: nextDayTemplateIds,
    };
  }

  function formatTemplateLabel(t: ShiftTemplate): string {
    if (isOffTemplate(t)) return `OFF${t.isActive ? "" : " [pasif]"}`;
    const code = String(t.shiftCode ?? "").trim() || t.signature;
    const timeRange = `${t.startTime}-${t.endTime}${t.spansMidnight ? "+1" : ""}`;
    return `${code} (${timeRange})${t.isActive ? "" : " [pasif]"}`;
  }

  function formatTemplateCodeOnly(t: ShiftTemplate | null | undefined): string {
    if (!t) return "—";
    if (isOffTemplate(t)) return "OFF";
    const code = String(t.shiftCode ?? "").trim() || String(t.signature ?? "").trim() || "—";
    return `${code}${t.isActive ? "" : " [pasif]"}`;
  }

  function formatTemplateDetail(t: ShiftTemplate | null | undefined): string {
    if (!t) return "";
    if (isOffTemplate(t)) return "Çalışmama günü";
    return `${t.startTime}-${t.endTime}${t.spansMidnight ? "+1" : ""}`;
  }

  function formatResolvedShiftCode(r: ResolvedDay | null | undefined): string {
    if (!r) return "—";
    const badge = String(r.shiftBadge ?? "").trim();
    const code = String(r.shiftCode ?? "").trim();
    if (badge === "OFF" || code === "OFF") return "OFF";
    if (code) return code;
    if (!badge || badge === "—") return "—";
    return badge;
  }

  function formatResolvedShiftLabel(r: ResolvedDay | null | undefined): string {
    if (!r) return "—";
    const badge = String(r.shiftBadge ?? "").trim();
    const code = String(r.shiftCode ?? "").trim();
    if (badge === "OFF") return "OFF";
    if (code) return badge || code;
    return badge || "—";
  }

  const bulkSelectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === bulkTemplateId) ?? null;
  }, [templates, bulkTemplateId]);

  const bulkSelectedTemplateLabel = useMemo(() => {
    if (bulkAction === "CLEAR") return "Inherit / Temizle";
    if (!bulkSelectedTemplate) return "Vardiya seçilmedi";
    return formatTemplateLabel(bulkSelectedTemplate);
  }, [bulkAction, bulkSelectedTemplate]);

  const bulkTargetLabel = useMemo(() => {
    if (bulkMode === "RANGE") return "Default aralık";
    const dk = dayKeys[bulkDayIndex];
    if (!dk) return "Gün seçilmedi";
    return `${weekdayLabelFromISO(dk)} • ${dk.slice(5)}`;
  }, [bulkMode, bulkDayIndex, dayKeys]);

  const bulkApplyButtonLabel = useMemo(() => {
    if (bulkMode === "RANGE") {
      return bulkAction === "CLEAR" ? "Default Alanı Temizle" : "Default Vardiyayı Uygula";
    }
    return bulkAction === "CLEAR" ? "Gün Override Temizle" : "Güne Override Uygula";
  }, [bulkMode, bulkAction]);

  function toggleEmployeeSelected(employeeId: string) {
    setSelectedEmployeeIds((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }));
  }

  function toggleSelectAllVisible() {
    setSelectedEmployeeIds((prev) => {
      const next = { ...prev };
      const shouldSelectAll = !allVisibleSelected;
      for (const id of visibleEmployeeIds) {
        next[id] = shouldSelectAll;
      }
      return next;
    });
  }

  function clearVisibleSelections() {
    setSelectedEmployeeIds((prev) => {
      const next = { ...prev };
      for (const id of visibleEmployeeIds) {
        delete next[id];
      }
      return next;
    });
  }

  const plannerTemplateOptions = useMemo<PlannerShiftOption[]>(() => {
    const off = templates.find((t) => isOffTemplate(t)) ?? null;
    const rest = templates
      .filter((t) => !isOffTemplate(t))
      .slice()
      .sort((a, b) =>
        String(a.shiftCode ?? a.signature ?? "").localeCompare(
          String(b.shiftCode ?? b.signature ?? ""),
          "tr"
        )
      );

    const ordered = off ? [off, ...rest] : rest;
    return ordered.map((t) => ({
      id: t.id,
      code: formatTemplateCodeOnly(t),
      detail: formatTemplateDetail(t),
      isActive: !!t.isActive,
      isOff: isOffTemplate(t),
    }));
  }, [templates]);

  const branchOptions = useMemo(() => {
    return branchCatalog
      .map((b) => ({ id: b.id, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [branchCatalog]);

  const effectiveShiftOptions = useMemo(() => {
    const set = new Set<string>();

    for (const arr of Object.values(resolvedByEmployeeId)) {
      if (!Array.isArray(arr)) continue;
      for (const d of arr) {
        const badge = formatResolvedShiftCode(d as ResolvedDay);
        if (!badge || badge === "—") continue;
        set.add(badge);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [resolvedByEmployeeId]);

  function employeeMatchesSource(employeeId: string, src: ShiftSourceFilter): boolean {
    if (src === "ALL") return true;
    const arr = resolvedByEmployeeId[employeeId];
    if (!Array.isArray(arr)) return false;
    return arr.some((d) => String(d?.shiftSource ?? "").trim() === src);
  }

  function employeeMatchesShift(employeeId: string, shift: string): boolean {
    if (shift === "ALL") return true;
    const arr = resolvedByEmployeeId[employeeId];
    if (!Array.isArray(arr)) return false;
    return arr.some((d) => formatResolvedShiftCode(d as ResolvedDay) === shift);
  }

  function resetFilters() {
    setSearch("");
    setBranchFilter("ALL");
    setSourceFilter("ALL");
    setShiftFilter("ALL");
    setOnlyActive(true);
    setPage(1);
  }

  const filteredEmployees = useMemo(() => {

    return employees.filter((e) => {

      if (!employeeMatchesSource(e.id, sourceFilter)) return false;
      if (!employeeMatchesShift(e.id, shiftFilter)) return false;

      return true;
    });
  }, [employees, sourceFilter, shiftFilter, resolvedByEmployeeId]);

  const visibleEmployeeIds = useMemo(() => filteredEmployees.map((e) => e.id), [filteredEmployees]);

  const selectedVisibleEmployeeIds = useMemo(() => {
    return visibleEmployeeIds.filter((id) => !!selectedEmployeeIds[id]);
  }, [visibleEmployeeIds, selectedEmployeeIds]);

  const bulkEffectiveEmployeeIds = useMemo(() => {
    return bulkTarget === "SELECTED" ? selectedVisibleEmployeeIds : visibleEmployeeIds;
  }, [bulkTarget, selectedVisibleEmployeeIds, visibleEmployeeIds]);

  const allVisibleSelected = useMemo(() => {
    return visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id) => !!selectedEmployeeIds[id]);
  }, [visibleEmployeeIds, selectedEmployeeIds]);

  const someVisibleSelected = useMemo(() => {
    return visibleEmployeeIds.some((id) => !!selectedEmployeeIds[id]);
  }, [visibleEmployeeIds, selectedEmployeeIds]);

  const dirtyCount = useMemo(() => Object.values(dirtyEmployeeIds).filter(Boolean).length, [dirtyEmployeeIds]);
  const filtersDisabled = !hasLoadedOnce && (loadingCore || loadingEmployees || loadingPlanner);
  const initialLoading = !hasLoadedOnce && (loadingCore || loadingEmployees || loadingPlanner);
  const refreshing = hasLoadedOnce && (loadingCore || loadingEmployees || loadingPlanner);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 7000);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchFilter, onlyActive, pageSize]);

  function buildEmployeesQuery() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("status", onlyActive ? "ACTIVE" : "ALL");
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);
    return params.toString();
  }

  function buildPlannerQuery(forStart: string, forEnd: string, employeeIds: string[]) {
    const params = new URLSearchParams();
    params.set("rangeStartDate", forStart);
    params.set("rangeEndDate", forEnd);
    if (employeeIds.length > 0) {
      params.set("employeeIds", employeeIds.join(","));
    }
    return params.toString();
  }

  async function loadCore() {
    setLoadingCore(true);
    try {
      const [tplRes, branchRes] = await Promise.all([
        fetch("/api/shift-templates?includeInactive=1", { cache: "no-store", credentials: "include" }),
        fetch("/api/org/branches", { cache: "no-store", credentials: "include" }),
      ]);

      if (!tplRes.ok) throw new Error(`GET /api/shift-templates failed: ${tplRes.status}`);
      if (!branchRes.ok) throw new Error(`GET /api/org/branches failed: ${branchRes.status}`);

      
      const tplJson = await tplRes.json();
      const branchJson = await branchRes.json();

      // API contracts:
      // - /api/employees => { items: Employee[] }
      // - /api/shift-templates => { items: ShiftTemplate[] }
      // Type-safe: API bazen bozuk/eksik item döndürürse TS "any" ve runtime sorun çıkarmasın
      const rawTpls: unknown[] = Array.isArray(tplJson?.items) ? tplJson.items : [];
      const safeTpls: ShiftTemplate[] = rawTpls
        .filter((t: unknown): t is ShiftTemplate => {
          if (!t || typeof t !== "object") return false;
          const anyT = t as any;
          return typeof anyT.id === "string" && typeof anyT.signature === "string";
        })
        .map((t) => t);
      setTemplates(safeTpls);
      setBranchCatalog(Array.isArray(branchJson) ? (branchJson as BranchOption[]) : []);
    } finally {
      setLoadingCore(false);
    }
  }

  async function loadPlannerPage(forStart: string, forEnd: string) {
    setLoadingEmployees(true);
    setLoadingPlanner(true);
    setError(null);
    setNotice(null);

    try {
      const empRes = await fetch(`/api/employees?${buildEmployeesQuery()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!empRes.ok) throw new Error(`GET /api/employees failed: ${empRes.status}`);

      const empJson = await empRes.json();
      const nextEmployees = Array.isArray(empJson?.items) ? (empJson.items as Employee[]) : [];
      const nextMeta = {
        total: Number(empJson?.meta?.total ?? 0) || 0,
        page: Number(empJson?.meta?.page ?? page) || page,
        pageSize: Number(empJson?.meta?.pageSize ?? pageSize) || pageSize,
        totalPages: Math.max(1, Number(empJson?.meta?.totalPages ?? 1) || 1),
      };

      setEmployees(nextEmployees);
      setEmployeeMeta(nextMeta);
      setLoadingEmployees(false);
      setHasLoadedOnce(true);

      const employeeIds = nextEmployees.map((e) => e.id);
      if (employeeIds.length === 0) {
        setPlansByEmployeeId({});
        setResolvedByEmployeeId({});
        setDirtyEmployeeIds({});
        return;
      }

      const plannerQuery = buildPlannerQuery(forStart, forEnd, employeeIds);

      const [planRes, resolvedRes] = await Promise.all([
        fetch(`/api/shift-assignments/planner?${plannerQuery}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/shift-assignments/planner-resolved?${plannerQuery}`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const planJson = await planRes.json().catch(() => ({}));
      const resolvedJson = await resolvedRes.json().catch(() => ({}));

      setResolvedByEmployeeId(
        resolvedRes.ok ? ((resolvedJson?.resolvedByEmployeeId ?? {}) as Record<string, ResolvedDay[]>) : {}
      );

      if (!planRes.ok) {
        setPlansByEmployeeId({});
        setDirtyEmployeeIds({});
        // Read-only modda (HR_CONFIG_ADMIN / SUPERVISOR) 401/403 beklenen olabilir.
        // UI'da "forbidden" toast göstermek yerine sessiz kal.
        if (!readOnly) {
          setError(planJson?.error ? String(planJson.error) : `Planner load failed (${planRes.status})`);
        }
        return;
      }
      setPlansByEmployeeId((planJson?.plansByEmployeeId ?? {}) as Record<string, PlannerPlan>);
      setDirtyEmployeeIds({});
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoadingEmployees(false);
      setLoadingPlanner(false);
    }
  }

  useEffect(() => {
    loadCore().catch((e) => setError(e?.message ?? "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clamped.start || !clamped.end) return;
    if (!DateTime.fromISO(clamped.start).isValid) return;
    if (!DateTime.fromISO(clamped.end).isValid) return;
    loadPlannerPage(clamped.start, clamped.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped.start, clamped.end, page, pageSize, debouncedSearch, branchFilter, onlyActive]);

  function ensurePlan(employeeId: string): PlannerPlan {
    const existing = plansByEmployeeId[employeeId];
    if (existing) return normalizePlanShape(existing);
    return createEmptyPlan(employeeId);
  }

  function getResolved(employeeId: string, dayIndex: number): ResolvedDay | null {
    const arr = resolvedByEmployeeId[employeeId];
    if (!Array.isArray(arr)) return null;
    return (arr[dayIndex] as ResolvedDay) ?? null;
  }

  function inheritDayLabel(employeeId: string, dayIndex: number): string {
    const r = getResolved(employeeId, dayIndex);
    const code = formatResolvedShiftCode(r);
    if (!code || code === "—") return "—";
    return code;
  }

  function markDirty(employeeId: string) {
    if (readOnly) return;
    setDirtyEmployeeIds((prev) => ({ ...prev, [employeeId]: true }));
  }

  function setRangeTemplate(employeeId: string, nextId: string | null) {
    if (readOnly) {
      setNotice("Bu ekranda sadece görüntüleme yetkin var (read-only).");
      return;
    }
    setPlansByEmployeeId((prev) => {
      const plan = ensurePlan(employeeId);
      return {
        ...prev,
        [employeeId]: { ...plan, rangeTemplateId: nextId },
      };
    });
    markDirty(employeeId);
  }

  function setDayTemplate(employeeId: string, dayIndex: number, nextId: string | null) {
    if (readOnly) {
      setNotice("Bu ekranda sadece görüntüleme yetkin var (read-only).");
      return;
    }
    setPlansByEmployeeId((prev) => {
      const plan = ensurePlan(employeeId);
      const copy = [...plan.dayTemplateIds];
      copy[dayIndex] = nextId;
      return {
        ...prev,
        [employeeId]: { ...plan, dayTemplateIds: copy },
      };
    });
    markDirty(employeeId);
  }

  async function applyBulk() {
    if (readOnly) {
      setNotice("Bu ekranda sadece görüntüleme yetkin var (read-only).");
      return;
    }

    if (bulkEffectiveEmployeeIds.length === 0) {
      setNotice(
        bulkTarget === "SELECTED"
          ? "Toplu işlem için seçili personel yok."
          : "Toplu işlem için bu sayfada görünür personel yok."
      );
      return;
    }

    if (bulkMode === "DAY" && (bulkDayIndex < 0 || bulkDayIndex >= rangeDays)) {
      setError("BULK_DAY_INVALID");
      return;
    }

    if (bulkAction === "ASSIGN" && !bulkTemplateId) {
      setError("Toplu atama için bir vardiya seçmelisin.");
      return;
    }

    setError(null);
    setNotice(null);

    setPlansByEmployeeId((prev) => {
      const next = { ...prev };

      for (const employeeId of bulkEffectiveEmployeeIds) {
        const current = normalizePlanShape(prev[employeeId] ?? createEmptyPlan(employeeId));

        if (bulkMode === "RANGE") {
          next[employeeId] = {
            ...current,
            rangeTemplateId: bulkAction === "CLEAR" ? null : bulkTemplateId,
          };
        } else {
          const copy = [...current.dayTemplateIds];
          copy[bulkDayIndex] = bulkAction === "CLEAR" ? null : bulkTemplateId;
          next[employeeId] = {
            ...current,
            dayTemplateIds: copy,
          };
        }
      }

      return next;
    });

    setDirtyEmployeeIds((prev) => {
      const next = { ...prev };
      for (const employeeId of bulkEffectiveEmployeeIds) next[employeeId] = true;
      return next;
    });

    const selectedTemplate = templates.find((t) => t.id === bulkTemplateId) ?? null;
    const selectedTemplateLabel =
      bulkAction === "CLEAR"
        ? "inherit / temizle"
        : selectedTemplate
          ? formatTemplateLabel(selectedTemplate)
          : "seçili vardiya";

    const targetLabel =
      bulkMode === "RANGE"
        ? "default aralık"
        : `${weekdayLabelFromISO(dayKeys[bulkDayIndex] ?? clamped.start)} ${String(dayKeys[bulkDayIndex] ?? "").slice(5)}`;

    setNotice(
      `${bulkEffectiveEmployeeIds.length} ${
        bulkTarget === "SELECTED" ? "seçili" : "görünür"
      } personel için ${targetLabel} alanına ${selectedTemplateLabel} uygulandı. Kaydetmeden DB’ye yazılmaz.`
    );
  }

  async function save() {
    if (readOnly) {
      setNotice("Kaydetme yetkin yok.");
      return;
    }
    if (saving) return;
    if (rangeDays <= 0) {
      setError("RANGE_INVALID");
      return;
    }
    const dirtyIds = Object.entries(dirtyEmployeeIds)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (dirtyIds.length === 0) {
      setNotice("Değişiklik yok.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        rangeStartDate: clamped.start,
        rangeEndDate: clamped.end,
        plans: dirtyIds.map((employeeId) => {
          const p = ensurePlan(employeeId);
          return {
            employeeId,
            rangeTemplateId: p.rangeTemplateId,
            dayTemplateIds: p.dayTemplateIds,
          };
        }),
      };

      const res = await fetch("/api/shift-assignments/planner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ? String(json.error) : `SAVE_FAILED_${res.status}`);
        return;
      }
      setNotice(`Kaydedildi. Güncellenen: ${json.updated ?? dirtyIds.length}`);
      // Reload to reflect any server-side normalization
      await loadPlannerPage(clamped.start, clamped.end);
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevRange() {
    if (readOnly) {
      setNotice("Kopyalama, plan üzerinde değişiklik yapar. Read-only modda kapalı.");
      return;
    }
    if (copying) return;
    if (rangeDays <= 0) {
      setError("RANGE_INVALID");
      return;
    }
    const s = DateTime.fromISO(clamped.start);
    if (!s.isValid) {
      setError("RANGE_START_INVALID");
      return;
    }
    // önceki aralık: (start - rangeDays) .. (start - 1)
    const srcStart = s.minus({ days: rangeDays }).toISODate();
    const srcEnd = s.minus({ days: 1 }).toISODate();
    if (!srcStart || !srcEnd) {
      setError("COPY_SRC_RANGE_INVALID");
      return;
    }

    setCopying(true);
    setError(null);
    setNotice(null);
    try {
      const currentPageEmployeeIds = employees.map((e) => e.id);
      const copyQuery = buildPlannerQuery(srcStart, srcEnd, currentPageEmployeeIds);
      const res = await fetch(`/api/shift-assignments/planner?${copyQuery}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ? String(json.error) : `COPY_LOAD_FAILED_${res.status}`);
        return;
      }

      const srcPlans: Record<string, PlannerPlan> = json?.plansByEmployeeId ?? {};
      const srcEmployeeIds = new Set(Object.keys(srcPlans));
      if (srcEmployeeIds.size === 0) {
        setNotice("Geçen hafta için plan bulunamadı.");
        return;
      }

      // Apply only for employees that exist in current employee list (avoid stale ids)
      // IMPORTANT: do NOT compute appliedIds inside setState updater. React may execute the updater later,
      // which would leave appliedIds empty here and therefore Save would say "Değişiklik yok".
      const currentEmployeeIds = new Set(employees.map((e) => e.id));
      const appliedIds: string[] = [];

      const patchPlans: Record<string, PlannerPlan> = {};

      for (const [employeeId, plan] of Object.entries(srcPlans)) {
        if (!currentEmployeeIds.has(employeeId)) continue;

        const dayTemplateIds =
          Array.isArray(plan.dayTemplateIds) && plan.dayTemplateIds.length === rangeDays
            ? [...plan.dayTemplateIds]
            : Array.from({ length: rangeDays }).map(() => null);

        patchPlans[employeeId] = {
          employeeId,
          rangeTemplateId: plan.rangeTemplateId ?? null,
          dayTemplateIds,
        };
        appliedIds.push(employeeId);
      }

      if (appliedIds.length === 0) {
        setNotice("Geçen hafta planı bulundu ama mevcut sayfadaki personel listesiyle eşleşmedi.");
        return;
      }

      setPlansByEmployeeId((prev) => ({ ...prev, ...patchPlans }));
      
      // Mark all applied employees as dirty (SAP behavior: copy then Save)
      setDirtyEmployeeIds((prev) => {
        const next = { ...prev };
        for (const id of appliedIds) next[id] = true;
        return next;
      });

      setNotice(`Önceki aralık yalnızca bu sayfa için kopyalandı. Etkilenen: ${appliedIds.length}. Kaydetmeyi unutma.`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="grid gap-6 w-full max-w-full overflow-x-hidden p-2 md:p-6 animate-in fade-in duration-500">
      <Card
        tone="violet"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Shift Planner</span>
            <Badge tone="violet">Haftalık Plan • Week + Day Override</Badge>
            {loadingCore ? <Badge tone="info">Temel veriler yükleniyor…</Badge> : null}
            {loadingEmployees ? <Badge tone="info">Personeller yükleniyor…</Badge> : null}
            {loadingPlanner ? <Badge tone="info">Plan verileri yükleniyor…</Badge> : null}
            {readOnly ? (
              <Badge tone="neutral">Read-only</Badge>
            ) : dirtyCount > 0 ? (
              <Badge tone="warn">Değişiklik: {dirtyCount}</Badge>
            ) : (
              <Badge tone="good">Temiz</Badge>
            )}
          </div>
        }
        subtitle={
          !readOnly
            ? "Week Template ataması + istersen gün bazında override. Değişiklikler kaydetmeden uygulanmaz."
            : "Read-only: Plan görüntülenir; değişiklik/kaydetme kapalıdır."
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={copyPrevRange}
              disabled={readOnly || loadingCore || loadingEmployees || loadingPlanner || saving || copying || rangeDays <= 0}
              title="Bir önceki aynı uzunlukta aralığın planını yalnızca bu sayfadaki personeller için kopyala (kaydetmez)"
            >
              {copying ? "Kopyalanıyor…" : "↺ Bu Sayfaya Önceki Aralığı Kopyala"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                loadCore().catch(() => undefined);
                loadPlannerPage(clamped.start, clamped.end);
              }}
              disabled={loadingCore || loadingEmployees || loadingPlanner || rangeDays <= 0}
              title="Yenile"
            >
              Yenile
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={readOnly || saving || loadingCore || loadingEmployees || loadingPlanner || rangeDays <= 0}
              title="Kaydet"
            >
              {saving ? "Kaydediliyor…" : `Kaydet${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </Button>
          </div>
        }
      > 
        {readOnly ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            İnceleme modu: plan üzerinde değişiklik yapamazsın.
          </div>
        ) : null}
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Başlangıç Tarihi
              </span>
              <input
                className={cx(inputClass, "h-11")}
                type="date"
                value={rangeStartDate}
                onChange={(e) => setRangeStartDate(e.target.value)}
              />
              <div className="h-4 text-[11px] text-zinc-500">
                Aralık: {clamped.start} → {clamped.end} ({rangeDays || 0} gün)
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Bitiş Tarihi
              </span>
              <input
                className={cx(inputClass, "h-11")}
                type="date"
                value={rangeEndDate}
                onChange={(e) => setRangeEndDate(e.target.value)}
              />
              <div className="h-4 text-[11px] text-zinc-500">
                Not: Max 62 gün (enterprise guard)
              </div>
            </label>

            <label className="grid gap-1.5 md:col-span-2 xl:col-span-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Arama (Kod / İsim / Şube)
              </span>
              <input
                className={cx(inputClass, "h-11")}
                placeholder="E1001, Ahmet, İstanbul…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={filtersDisabled}
              />
              <div className="h-4 text-[11px] text-zinc-500">
                İpucu: Şube adında da arar.
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Şube
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                disabled={filtersDisabled}
              >
                <option value="ALL">Tüm Şubeler</option>
                <option value="__NULL__">Şubesiz</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="h-4 text-[11px] text-zinc-500">
                Personel şubesine göre filtreler.
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Kaynak
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as ShiftSourceFilter)}
                disabled={filtersDisabled}
              >
                <option value="ALL">Tüm Kaynaklar</option>
                <option value="POLICY">Policy</option>
                <option value="WORK_SCHEDULE">Rota</option>
                <option value="WEEK_TEMPLATE">Haftalık Plan</option>
                <option value="DAY_TEMPLATE">Günlük Override</option>
                <option value="CUSTOM">Özel</option>
              </select>
              <div className="h-4 text-[11px] text-zinc-500">
                Range içinde en az bir gün eşleşme arar.
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label
              className={cx(
                "inline-flex h-11 select-none items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-sm",
                onlyActive
                  ? "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(240,253,250,0.92))] text-emerald-900 shadow-[0_10px_24px_rgba(16,185,129,0.08)]"
                  : "border-slate-200/80 bg-white/88 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
              )}
              title="Kapalıysa pasif personeller de görünür"
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="h-4 w-4"
                disabled={filtersDisabled}
              />
              Sadece aktif
            </label>

            <label className="grid gap-1.5 min-w-[220px]">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Vardiya
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                disabled={filtersDisabled}
              >
                <option value="ALL">Tüm Vardiyalar</option>
                {effectiveShiftOptions.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 min-w-[140px]">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Sayfa Boyutu
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 25)}
                disabled={filtersDisabled || loadingEmployees || loadingPlanner}
              >
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>

            <Button
              variant="ghost"
              className="h-11 px-4"
              onClick={resetFilters}
              type="button"
              title="Arama ve filtreleri temizle"
              disabled={filtersDisabled}
            >
              Filtreleri Temizle
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">
                {initialLoading ? "Personeller yükleniyor…" : `Toplam Kayıt: ${employeeMeta.total}`}
              </Badge>
              <Badge tone="neutral">Range: {clamped.start} → {clamped.end}</Badge>
              <Badge tone="warn">Day override, Week’i ezer</Badge>
              {filtersDisabled ? <Badge tone="neutral">Filtre seçenekleri yükleniyor…</Badge> : null}
              {branchFilter !== "ALL" ? (
                <Badge tone="violet">
                  Şube: {branchFilter === "__NULL__" ? "Şubesiz" : branchOptions.find((x) => x.id === branchFilter)?.name ?? "Seçili"}
                </Badge>
              ) : null}
              {sourceFilter !== "ALL" ? <Badge tone="info">Kaynak: {trShiftSourceShortTR(sourceFilter)}</Badge> : null}
              {shiftFilter !== "ALL" ? <Badge tone="good">Vardiya: {shiftFilter}</Badge> : null}
              {!initialLoading ? <Badge tone="neutral">Sayfa: {employeeMeta.page}/{employeeMeta.totalPages}</Badge> : null}
              {!initialLoading ? <Badge tone="neutral">Bu Sayfa: {employees.length}</Badge> : null}
              {(sourceFilter !== "ALL" || shiftFilter !== "ALL") && !initialLoading ? (
                <Badge tone="warn">Kaynak/Vardiya filtreleri mevcut sayfada çalışır</Badge>
              ) : null}
            </div>
          </div>

          {(notice || error) ? (
            <div className="grid gap-2">
              {notice ? (
                <div className="rounded-xl border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.06)]">
                  {notice}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-rose-800 shadow-[0_10px_24px_rgba(244,63,94,0.06)]">
                  {error}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
      
      {initialLoading ? (
        <div className="rounded-2xl border border-indigo-200/70 bg-[linear-gradient(135deg,rgba(238,242,255,0.96),rgba(255,255,255,0.96))] px-5 py-4 shadow-[0_18px_42px_rgba(79,70,229,0.10)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-slate-950">
                Shift Planner hazırlanıyor
              </div>
              <div className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                Personel listesi, template verileri ve plan tablosu yükleniyor. Özellikle geniş aralıklarda bu işlem birkaç saniye sürebilir.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Plan Tablosu</span>
            <Badge tone="info">{initialLoading ? "Yükleniyor…" : `${filteredEmployees.length} görünür personel`}</Badge>
            {!initialLoading ? <Badge tone="neutral">Sunucu Kaydı: {employeeMeta.total}</Badge> : null}
          </div>
        }
        subtitle="Satır sarı ise değişmiş demektir (dirty). Kaydetmeden DB’ye yazılmaz. Personeller sayfalı çekilir; sadece görünen sayfanın plan verisi yüklenir."
      >
        <div className="mb-4 rounded-2xl border border-indigo-200/70 bg-[linear-gradient(135deg,rgba(238,242,255,0.96),rgba(255,255,255,0.96))] p-4 shadow-[0_16px_36px_rgba(79,70,229,0.08)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet">Toplu İşlem</Badge>
            <Badge tone="info">
              Hedef: {bulkTarget === "SELECTED" ? "Yalnızca seçili personeller" : "Bu sayfada görünen personeller"}
            </Badge>
            <Badge tone="neutral">{bulkEffectiveEmployeeIds.length} kişi etkilenecek</Badge>
            <Badge tone="warn">Kaydetmeden DB’ye yazılmaz</Badge>
            {bulkTarget === "SELECTED" ? (
              <Badge tone={someVisibleSelected ? "good" : "warn"}>
                Seçili: {selectedVisibleEmployeeIds.length}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              Mod: <span className="font-medium ml-1">{bulkMode === "RANGE" ? "Default (Aralık)" : "Gün Override"}</span>
            </Badge>
            <Badge tone={bulkAction === "CLEAR" ? "warn" : "good"}>
              İşlem: <span className="font-medium ml-1">{bulkAction === "CLEAR" ? "Inherit / Temizle" : "Vardiya Ata"}</span>
            </Badge>
            <Badge tone="info">
              Hedef Alan: <span className="font-medium ml-1">{bulkTargetLabel}</span>
            </Badge>
            <Badge tone="violet">
              Seçim: <span className="font-medium ml-1">{bulkSelectedTemplateLabel}</span>
            </Badge>
          </div>

          <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-slate-600">
            {bulkMode === "RANGE" ? (
              <span>
                <b>Default (Aralık)</b> seçildiğinde, görünen personellerin seçili tarih aralığındaki <b>ana vardiyası</b> güncellenir.
                Mevcut gün override kayıtları varsa onları ezmez.
              </span>
            ) : (
              <span>
                <b>Gün Override</b> seçildiğinde, yalnızca seçili gün kolonu için override uygulanır.
                Diğer günler etkilenmez.
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[180px_180px_180px_minmax(220px,1fr)_auto]">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Hedef
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value as BulkApplyTarget)}
                disabled={readOnly || initialLoading || loadingEmployees || loadingPlanner}
              >
                <option value="VISIBLE">Görünen herkes</option>
                <option value="SELECTED">Yalnızca seçili personeller</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Uygulama Türü
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value as BulkApplyMode)}
                disabled={readOnly || initialLoading || loadingEmployees || loadingPlanner}
              >
                <option value="RANGE">Default (Aralık)</option>
                <option value="DAY">Gün Override</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                İşlem
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as BulkApplyAction)}
                disabled={readOnly || initialLoading || loadingEmployees || loadingPlanner}
              >
                <option value="ASSIGN">Vardiya Ata</option>
                <option value="CLEAR">Inherit / Temizle</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Gün
              </span>
              <select
                className={cx(inputClass, "h-11")}
                value={String(bulkDayIndex)}
                onChange={(e) => setBulkDayIndex(Number(e.target.value) || 0)}
                disabled={
                  readOnly ||
                  bulkMode !== "DAY" ||
                  initialLoading ||
                  loadingEmployees ||
                  loadingPlanner ||
                  rangeDays <= 0
                }
              >
                {dayKeys.map((dk, idx) => (
                  <option key={dk} value={String(idx)}>
                    {weekdayLabelFromISO(dk)} • {dk.slice(5)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Vardiya
              </span>
              <select
                className={cx(
                  inputClass,
                  "h-11",
                  bulkAction !== "ASSIGN" && "bg-slate-100/90 text-slate-400 border-slate-200"
                )}
                value={bulkTemplateId}
                onChange={(e) => setBulkTemplateId(e.target.value)}
                disabled={
                  readOnly ||
                  bulkAction !== "ASSIGN" ||
                  initialLoading ||
                  loadingEmployees ||
                  loadingPlanner
                }
              >
                <optgroup label="Aktif Template'ler">
                  {plannerTemplateOptions
                    .filter((opt) => opt.isActive)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.code} • {opt.detail}
                      </option>
                    ))}
                </optgroup>
                {plannerTemplateOptions.some((opt) => !opt.isActive) ? (
                  <optgroup label="Pasif Template'ler">
                    {plannerTemplateOptions
                      .filter((opt) => !opt.isActive)
                      .map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.code} • {opt.detail}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
            </label>

            <div className="flex items-end">
              <Button
                variant="primary"
                className="h-11 min-w-[180px]"
                onClick={applyBulk}
                disabled={
                  readOnly ||
                  initialLoading ||
                  loadingEmployees ||
                  loadingPlanner ||
                  rangeDays <= 0 ||
                  bulkEffectiveEmployeeIds.length === 0 ||
                  (bulkAction === "ASSIGN" && !bulkTemplateId)
                }
                title="Yalnızca bu sayfadaki görünür personellere uygular. Kaydetmeden DB’ye yazılmaz."
              >
                {bulkApplyButtonLabel}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Bu işlem yalnızca{" "}
              <b>{bulkTarget === "SELECTED" ? "seçili personelleri" : "görünen sayfadaki personelleri"}</b> etkiler.
              Değişiklik önce grid’de uygulanır, <b>Kaydet</b> ile veritabanına yazılır.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={toggleSelectAllVisible}
                disabled={readOnly || visibleEmployeeIds.length === 0}
              >
                {allVisibleSelected ? "Görünen Seçimleri Kaldır" : "Görünenlerin Hepsini Seç"}
              </Button>
              <Button
                variant="ghost"
                onClick={clearVisibleSelections}
                disabled={readOnly || !someVisibleSelected}
              >
                Seçimi Temizle
              </Button>
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_18px_38px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          {refreshing ? (
            <div className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-[0_10px_24px_rgba(79,70,229,0.10)]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              {loadingPlanner ? "Plan verileri güncelleniyor…" : "Liste güncelleniyor…"}
            </div>
          ) : null}
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(248,250,252,0.96))] text-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-center font-bold text-zinc-500 uppercase text-[11px] tracking-widest w-12">
                  <div className="flex items-center justify-center">
                    <SelectionCheckbox
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      ariaLabel="Bu sayfadaki tüm personelleri seç"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Personel</th>
                <th className="px-4 py-3 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Şube</th>
                <th
                  className="px-4 py-3 text-left font-bold uppercase text-[11px] tracking-widest bg-violet-50/60 text-violet-800"
                  style={{ minWidth: 180 }}
                >
                  Default (Aralık)
                </th>
                {dayKeys.map((dk) => (
                  <th
                    key={dk}
                    className={cx(
                      "px-2 py-3 text-left font-bold uppercase text-[11px] tracking-widest",
                      weekdayHeadClassFromISO(dk)
                    )}
                    title={dk}
                  >
                    <div className="flex flex-col leading-tight">
                      <span>{weekdayLabelFromISO(dk)}</span>
                      <span className="text-[10px] font-semibold text-zinc-400">{dk.slice(5)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/90">
              {initialLoading
                ? Array.from({ length: 8 }).map((_, rowIndex) => (
                    <tr
                      key={`planner-skeleton-${rowIndex}`}
                      className={cx(rowIndex % 2 === 0 ? "bg-slate-50/75" : "bg-white/92")}
                    >
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          <SkeletonLine className="h-4 w-36" />
                          <SkeletonLine className="h-3 w-24" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SkeletonLine className="h-6 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-2.5" style={{ minWidth: 180 }}>
                        <SkeletonLine className="h-10 w-full max-w-[180px]" />
                      </td>
                      {dayKeys.map((dk, idx) => (
                        <td
                          key={`planner-skeleton-day-${rowIndex}-${idx}-${dk}`}
                          className={cx("px-2 py-2.5", weekdayCellClassFromISO(dk))}
                        >
                          <div className="grid gap-1.5 min-w-[138px] max-w-[168px]">
                            <SkeletonLine className="h-10 w-full" />
                            <SkeletonLine className="h-4 w-24" />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                : null}

              {!initialLoading && filteredEmployees.map((e, rowIndex) => {
                const p = ensurePlan(e.id);
                const dirty = !!dirtyEmployeeIds[e.id];
                const zebra = rowIndex % 2 === 0; // 0,2,4... => 1.,3.,5... satırlar belirgin
                return (
                  <tr
                    key={e.id}
                    className={cx(
                      "group transition-colors border-l-4",
                      dirty
                        ? "bg-amber-50/70"
                        : zebra
                          ? "bg-slate-50/75"
                          : "bg-white/92",
                      dirty ? "border-amber-400" : "border-transparent",
                      selectedEmployeeIds[e.id] && !dirty && "bg-[linear-gradient(180deg,rgba(238,242,255,0.62),rgba(255,255,255,0.88))]",
                      "hover:bg-indigo-50/45"
                    )}
                    title={dirty ? "Değişti (Kaydet bekliyor)" : ""}
                  >
                    <td className="px-3 py-3 align-top text-center">
                      <div className="flex items-start justify-center pt-0.5">
                        <SelectionCheckbox
                          checked={!!selectedEmployeeIds[e.id]}
                          onChange={() => toggleEmployeeSelected(e.id)}
                          ariaLabel={`${e.employeeCode} personelini seç`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <Link
                            href={`/shift-assignments/planner/employee/${e.id}?rangeStartDate=${encodeURIComponent(
                              clamped.start
                            )}&rangeEndDate=${encodeURIComponent(clamped.end)}`}
                            className="group/employee block rounded-xl px-2 py-1 -mx-2 -my-1 transition hover:bg-white/90"
                            title="Personel vardiya detayını aç"
                          >
                            <div className="font-bold text-slate-950 truncate underline decoration-transparent underline-offset-4 transition group-hover/employee:text-indigo-800 group-hover/employee:decoration-indigo-300">
                              {nameOf(e)}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                              {e.isActive ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                  Pasif
                                </span>
                              )}

                              {e.employeeCode ? (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span
                                    className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/92 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"
                                    title={`Kod: ${e.employeeCode}`}
                                  >
                                    {e.employeeCode}
                                  </span>
                                </>
                              ) : null}

                              <span className="text-zinc-300">•</span>
                              <span className="font-medium text-indigo-600">Detayı aç</span>

                              {selectedEmployeeIds[e.id] ? (
                                <span className="ml-2 inline-flex items-center rounded-full border border-indigo-200/70 bg-indigo-50/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                  Seçili
                                </span>
                              ) : null}

                              {dirty ? <span className="ml-1 font-bold text-amber-700">• Değişti</span> : null}
                            </div>
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e.branch?.name ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100/85 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {e.branch.name}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" style={{ minWidth: 180 }}>
                      <div className="min-w-[150px] max-w-[180px]">
                        <PlannerShiftSelect
                          value={p.rangeTemplateId ?? ""}
                          onChange={(next) => setRangeTemplate(e.id, next || null)}
                          options={plannerTemplateOptions}
                          placeholder="—"
                          disabled={readOnly}
                        />
                      </div>
                    </td>
                    {p.dayTemplateIds.map((tplId, idx) => (
                      <td
                        key={idx}
                        className={cx(
                          "px-2 py-2.5 transition-colors",
                          weekdayCellClassFromISO(dayKeys[idx] ?? clamped.start),
                          "group-hover:bg-zinc-50/60"
                        )}
                      >
                        <div className="min-w-[138px] max-w-[168px]">
                        <PlannerShiftSelect
                          value={tplId ?? ""}
                          onChange={(next) => setDayTemplate(e.id, idx, next || null)}
                          options={plannerTemplateOptions}
                          placeholder={inheritDayLabel(e.id, idx)}
                          disabled={readOnly}
                        />

                        {(() => {
                          const r = getResolved(e.id, idx);
                          const badge = formatResolvedShiftCode(r);
                          const srcLong = trShiftSourceTR(r?.shiftSource ?? null);
                          const srcShort = trShiftSourceShortTR(r?.shiftSource ?? null);
                          const tip = `Geçerli: ${badge} • Kaynak: ${srcLong}`;
                          return (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                              <span
                                className="truncate text-zinc-600"
                                title={tip}
                              >
                                {badge}
                              </span>
                              <span className="text-zinc-300">•</span>
                              <span title={tip}>
                                <Badge tone={sourceTone(r?.shiftSource ?? null)} className="px-1.5 py-0.5 text-[10px]">
                                  {srcShort}
                                </Badge>
                              </span>
                            </div>
                          );
                        })()}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}

              {!loadingCore && filteredEmployees.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={4 + Math.max(1, rangeDays)}>
                    Seçili filtrelere uygun personel bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-600">
            {employeeMeta.total === 0
              ? "Kayıt yok"
              : `${employeeMeta.total} kayıt içinden ${employeeMeta.page}. sayfa gösteriliyor • Sayfa boyutu ${employeeMeta.pageSize}`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loadingEmployees || loadingPlanner}
            >
              « İlk
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loadingEmployees || loadingPlanner}
            >
              ‹ Önceki
            </Button>
            <div className="inline-flex h-11 items-center rounded-xl border border-slate-200/80 bg-white/88 px-4 text-sm font-bold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              Sayfa {employeeMeta.page} / {employeeMeta.totalPages}
            </div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPage((prev) => Math.min(employeeMeta.totalPages, prev + 1))}
              disabled={page >= employeeMeta.totalPages || loadingEmployees || loadingPlanner}
            >
              Sonraki ›
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPage(employeeMeta.totalPages)}
              disabled={page >= employeeMeta.totalPages || loadingEmployees || loadingPlanner}
            >
              Son »
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}