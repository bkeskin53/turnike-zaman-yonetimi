"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card({
  title,
  description,
  right,
  children,
  className,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-white shadow-sm min-w-0 max-w-full",
        "dark:border-zinc-800/70 dark:bg-zinc-950/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800/70">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{children}</span>;
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium " +
    "transition focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      : variant === "secondary"
        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-900"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "bg-transparent text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900/60";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, styles, className)}
    >
      {children}
    </button>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
        "placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        "dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700",
        className,
      )}
    />
  );
}

function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
        "focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        "dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100 dark:focus:border-zinc-700",
        className,
      )}
    />
  );
}

function Badge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "ok" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60"
        : tone === "muted"
          ? "bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800"
          : "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60";
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", cls)}>
      {children}
    </span>
  );
}

function ChipButton({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800",
        "hover:bg-zinc-50",
        "dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200 dark:hover:bg-zinc-900/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Minimal, calm inline icons (emoji yerine)
function Icon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center opacity-80 dark:opacity-90">{children}</span>;
}
const I = {
  Calendar: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.5 9.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19V8a2.5 2.5 0 0 1 2.5-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
 ),
  ChevronL: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronR: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
     <path d="M9.5 6.5 15 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Copy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M9 9h10v10H9V9Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Moon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21 13.2A7.6 7.6 0 0 1 10.8 3a6.8 6.8 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
 ),
  Pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M14 3 10 7v4l-3 3h10l-3-3V7l-1-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 14v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Pencil: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
     <path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-3L16 4a2 2 0 0 0-3 0L2.5 14.5V18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  Layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

// Convert minutes to HH:mm string. Returns empty string if value is null or undefined.
function minutesToHHMM(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || isNaN(mins)) return "";
  const hh = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const mm = (mins % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}`;
}

// Compute the Monday (week start) in ISO YYYY-MM-DD for a given date, using policy timezone.
function computeWeekStart(date: Date, tz: string): string {
  const dt = DateTime.fromJSDate(date, { zone: tz }).startOf("day");
  const monday = dt.minus({ days: dt.weekday - 1 });
  return monday.toISODate()!;
}

// Add days to an ISO date string (YYYY-MM-DD), using policy timezone.
function addDays(dateStr: string, days: number, tz: string): string {
  const dt = DateTime.fromISO(dateStr, { zone: tz }).startOf("day").plus({ days });
  return dt.toISODate()!;
}

// Days keys and their human-readable Turkish names
const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const dayNames = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;

// Type for time fields state
type TimesState = {
  monStart: string;
  monEnd: string;
  tueStart: string;
  tueEnd: string;
  wedStart: string;
  wedEnd: string;
  thuStart: string;
  thuEnd: string;
  friStart: string;
  friEnd: string;
  satStart: string;
  satEnd: string;
  sunStart: string;
  sunEnd: string;
  };

type ShiftTemplateItem = {
  id: string;
  signature: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  spansMidnight: boolean;
};

export default function WeeklyPlanClient({ id }: { id: string }) {
const [timezone, setTimezone] = useState<string>("Europe/Istanbul");
 const [weekStart, setWeekStart] = useState<string>(() =>
    computeWeekStart(new Date(), "Europe/Istanbul")
  );
  const [times, setTimes] = useState<TimesState>(() => ({
    monStart: "",
    monEnd: "",
    tueStart: "",
    tueEnd: "",
    wedStart: "",
    wedEnd: "",
  thuStart: "",
    thuEnd: "",
    friStart: "",
    friEnd: "",
    satStart: "",
    satEnd: "",
    sunStart: "",
    sunEnd: "",
  }));

  const [defaultStart, setDefaultStart] = useState<string>("");
  const [defaultEnd, setDefaultEnd] = useState<string>("");
  // Stage 3: week-level default template + day overrides
  const [templates, setTemplates] = useState<ShiftTemplateItem[]>([]);
  const [weekTemplateId, setWeekTemplateId] = useState<string>("NONE");
  const [dayMode, setDayMode] = useState<Record<(typeof dayKeys)[number], string>>({
    mon: "DEFAULT",
    tue: "DEFAULT",
    wed: "DEFAULT",
    thu: "DEFAULT",
    fri: "DEFAULT",
    sat: "DEFAULT",
    sun: "DEFAULT",
  });
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [templateQuery, setTemplateQuery] = useState<string>("");
  const [highlightDays, setHighlightDays] = useState<Record<string, boolean>>({});

  // ------------------------------------------------------------
  // Week summary (UI only)
  const weekSummary = useMemo(() => {
    let weekTemplateDays = 0;
    let policyDays = 0;
    let dayTemplateDays = 0;
    let customDays = 0;
    let overnightDays = 0;

    dayKeys.forEach((key) => {
      const mode = dayMode[key];

      const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
      const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
      const isPolicyDefault = mode === "DEFAULT" && (weekTemplateId === "NONE" || !weekTemplateId);
      const isCustom = mode === "CUSTOM";

      const overnightByDayTemplate = isOvernightMode(mode);
      const overnightByWeekTemplate =
        mode === "DEFAULT" && weekTemplateId !== "NONE" ? !!getWeekTemplate()?.spansMidnight : false;
      // For CUSTOM, we can infer overnight from displayed times
      const startKey = `${key}Start` as keyof TimesState;
      const endKey = `${key}End` as keyof TimesState;
      const s = (times[startKey] as string) || "";
      const e = (times[endKey] as string) || "";
      const overnightByCustom = isCustom && s && e ? e <= s : false;

      const isOvernight = overnightByDayTemplate || overnightByWeekTemplate || overnightByCustom;

      if (isExplicitDayTemplate) dayTemplateDays += 1;
      else if (isCustom) customDays += 1;
      else if (isWeekTemplateDefault) weekTemplateDays += 1;
      else if (isPolicyDefault) policyDays += 1;

      if (isOvernight) overnightDays += 1;
    });

    return { weekTemplateDays, policyDays, dayTemplateDays, customDays, overnightDays };
  }, [dayMode, weekTemplateId, times, templates]);
  
  function classifyDay(key: (typeof dayKeys)[number]) {
    const mode = dayMode[key];
    const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
    const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
    const isPolicyDefault = mode === "DEFAULT" && (weekTemplateId === "NONE" || !weekTemplateId);
    const isCustom = mode === "CUSTOM";

    const overnightByDayTemplate = isOvernightMode(mode);
    const overnightByWeekTemplate =
      mode === "DEFAULT" && weekTemplateId !== "NONE" ? !!getWeekTemplate()?.spansMidnight : false;
    const startKey = `${key}Start` as keyof TimesState;
    const endKey = `${key}End` as keyof TimesState;
    const s = (times[startKey] as string) || "";
    const e = (times[endKey] as string) || "";
    const overnightByCustom = isCustom && s && e ? e <= s : false;

    const isOvernight = overnightByDayTemplate || overnightByWeekTemplate || overnightByCustom;

    return {
      isExplicitDayTemplate,
      isWeekTemplateDefault,
      isPolicyDefault,
      isCustom,
      isOvernight,
    };
  }

  function scrollToDays(keys: (typeof dayKeys)[number][]) {
    if (!keys.length) return;
    // highlight
    const next: Record<string, boolean> = {};
    keys.forEach((k) => (next[k] = true));
    setHighlightDays(next);
    // scroll to first match
    const el = document.querySelector(`[data-day-row="${keys[0]}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // auto clear highlight
    window.setTimeout(() => setHighlightDays({}), 1800);
  }

  function onSummaryClick(kind: "WEEK" | "POLICY" | "DAY_TEMPLATE" | "CUSTOM" | "OVERNIGHT") {
    const keys: (typeof dayKeys)[number][] = [];
    dayKeys.forEach((k) => {
      const c = classifyDay(k);
      if (kind === "WEEK" && c.isWeekTemplateDefault) keys.push(k);
      if (kind === "POLICY" && c.isPolicyDefault) keys.push(k);
      if (kind === "DAY_TEMPLATE" && c.isExplicitDayTemplate) keys.push(k);
      if (kind === "CUSTOM" && c.isCustom) keys.push(k);
      if (kind === "OVERNIGHT" && c.isOvernight) keys.push(k);
    });
    scrollToDays(keys);
  }

  async function loadTemplates() {
    try {
      const res = await fetch(`/api/shift-templates`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      setTemplates(items);
    } catch {
      // ignore
    }
  }

  function getTemplateById(tplId: string | null | undefined): ShiftTemplateItem | null {
    if (!tplId) return null;
    return templates.find((t) => t.id === tplId) ?? null;
  }

  function getWeekTemplate(): ShiftTemplateItem | null {
    if (!weekTemplateId || weekTemplateId === "NONE") return null;
    return getTemplateById(weekTemplateId);
  }

  function getFilteredTemplates(): ShiftTemplateItem[] {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const sig = (t.signature ?? "").toLowerCase();
      return sig.includes(q);
    });
  }
  
  function signatureAlreadyHasPlus1(sig: string): boolean {
    // Handle common forms: "+1" or "(+1)" anywhere in signature
    return /\(\s*\+1\s*\)|\+1/.test(sig);
  }

  function formatTemplateLabel(t: ShiftTemplateItem): string {
    if (!t.spansMidnight) return t.signature;
    if (signatureAlreadyHasPlus1(t.signature)) return t.signature;
    return `${t.signature} (+1)`;
  }

  function isOvernightMode(mode: string): boolean {
    if (!mode || mode === "DEFAULT" || mode === "CUSTOM") return false;
    const tpl = getTemplateById(mode);
    return !!tpl?.spansMidnight;
  }

  function getTemplatesForSelect(selectedId?: string | null): ShiftTemplateItem[] {
    const list = getFilteredTemplates();
    if (!selectedId) return list;
    // selectedId may be "NONE" or special mode strings; only handle real template ids
    if (selectedId === "NONE" || selectedId === "DEFAULT" || selectedId === "CUSTOM") return list;
    const already = list.some((t) => t.id === selectedId);
    if (already) return list;
    const selected = getTemplateById(selectedId);
    if (!selected) return list;
    // Ensure selected template remains visible even when filtered out
    return [selected, ...list];
  }

  function getDefaultDayLabel(): string {
    return weekTemplateId && weekTemplateId !== "NONE"
      ? "(Default \u2192 Week Template)"
      : "(Default \u2192 Policy)";
  }

  function getDisplayedTime(day: (typeof dayKeys)[number], kind: "start" | "end"): string {
    const mode = dayMode[day];
    // Day override template
    if (mode && mode !== "DEFAULT" && mode !== "CUSTOM") {
      const tpl = getTemplateById(mode);
      if (tpl) return kind === "start" ? tpl.startTime : tpl.endTime;
    }

    // Default (week template -> policy)
    if (mode === "DEFAULT") {
      const wk = getWeekTemplate();
      if (wk) return kind === "start" ? wk.startTime : wk.endTime;
      return kind === "start" ? defaultStart : defaultEnd;
    }

    // Custom: state values
    const startKey = `${day}Start` as keyof TimesState;
    const endKey = `${day}End` as keyof TimesState;
    return kind === "start" ? (times[startKey] as string) : (times[endKey] as string);
  }

  // Load company policy to get default shift times
  async function loadPolicy() {
    try {
      const res = await fetch(`/api/company`, { credentials: "include" });
     if (!res.ok) return;
      const data = await res.json();
      const policy = data?.policy ?? {};
      if (typeof policy.timezone === "string" && policy.timezone.trim()) {
        setTimezone(policy.timezone);
      }
      const startMin = policy.shiftStartMinute;
      const endMin = policy.shiftEndMinute;
      if (typeof startMin === "number") setDefaultStart(minutesToHHMM(startMin));
      if (typeof endMin === "number") setDefaultEnd(minutesToHHMM(endMin));
    } catch {
      // ignore policy errors
    }
  }

  // Load weekly plan for the current weekStart
  async function loadPlan() {
   if (!id || !weekStart) return;
    setLoadingPlan(true);
    setError(null);
    setNotice(null);
    // Load is the source of truth; it resets dirty state.
    setIsDirty(false);
    try {
      const res = await fetch(
        `/api/employees/${id}/weekly-plan?weekStart=${encodeURIComponent(
          weekStart
        )}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.item;
        if (item) {
          // Week default template
          setWeekTemplateId(item.shiftTemplateId ?? "NONE");

          // Day modes: templateId > custom(minutes) > default
          setDayMode({
            mon: item.monShiftTemplateId ?? (item.monStartMinute != null || item.monEndMinute != null ? "CUSTOM" : "DEFAULT"),
            tue: item.tueShiftTemplateId ?? (item.tueStartMinute != null || item.tueEndMinute != null ? "CUSTOM" : "DEFAULT"),
            wed: item.wedShiftTemplateId ?? (item.wedStartMinute != null || item.wedEndMinute != null ? "CUSTOM" : "DEFAULT"),
            thu: item.thuShiftTemplateId ?? (item.thuStartMinute != null || item.thuEndMinute != null ? "CUSTOM" : "DEFAULT"),
            fri: item.friShiftTemplateId ?? (item.friStartMinute != null || item.friEndMinute != null ? "CUSTOM" : "DEFAULT"),
            sat: item.satShiftTemplateId ?? (item.satStartMinute != null || item.satEndMinute != null ? "CUSTOM" : "DEFAULT"),
            sun: item.sunShiftTemplateId ?? (item.sunStartMinute != null || item.sunEndMinute != null ? "CUSTOM" : "DEFAULT"),
          });
          // Set times from plan
          setTimes({
            monStart: minutesToHHMM(item.monStartMinute),
            monEnd: minutesToHHMM(item.monEndMinute),
            tueStart: minutesToHHMM(item.tueStartMinute),
           tueEnd: minutesToHHMM(item.tueEndMinute),
            wedStart: minutesToHHMM(item.wedStartMinute),
            wedEnd: minutesToHHMM(item.wedEndMinute),
            thuStart: minutesToHHMM(item.thuStartMinute),
            thuEnd: minutesToHHMM(item.thuEndMinute),
            friStart: minutesToHHMM(item.friStartMinute),
            friEnd: minutesToHHMM(item.friEndMinute),
            satStart: minutesToHHMM(item.satStartMinute),
            satEnd: minutesToHHMM(item.satEndMinute),
            sunStart: minutesToHHMM(item.sunStartMinute),
            sunEnd: minutesToHHMM(item.sunEndMinute),
          });
        } else {
          // No plan: prefill with default shift times if available
          setWeekTemplateId("NONE");
          setDayMode({
            mon: "DEFAULT",
            tue: "DEFAULT",
            wed: "DEFAULT",
            thu: "DEFAULT",
            fri: "DEFAULT",
            sat: "DEFAULT",
            sun: "DEFAULT",
          });
          setTimes({
            monStart: defaultStart,
            monEnd: defaultEnd,
            tueStart: defaultStart,
            tueEnd: defaultEnd,
           wedStart: defaultStart,
            wedEnd: defaultEnd,
            thuStart: defaultStart,
            thuEnd: defaultEnd,
            friStart: defaultStart,
            friEnd: defaultEnd,
            satStart: defaultStart,
           satEnd: defaultEnd,
            sunStart: defaultStart,
            sunEnd: defaultEnd,
          });
        }
      } else if (res.status === 404) {
        // Not found: treat as no plan
        setWeekTemplateId("NONE");
        setDayMode({
          mon: "DEFAULT",
          tue: "DEFAULT",
          wed: "DEFAULT",
          thu: "DEFAULT",
          fri: "DEFAULT",
          sat: "DEFAULT",
          sun: "DEFAULT",
        });
       setTimes({
          monStart: defaultStart,
          monEnd: defaultEnd,
          tueStart: defaultStart,
          tueEnd: defaultEnd,
          wedStart: defaultStart,
          wedEnd: defaultEnd,
          thuStart: defaultStart,
         thuEnd: defaultEnd,
          friStart: defaultStart,
          friEnd: defaultEnd,
          satStart: defaultStart,
          satEnd: defaultEnd,
          sunStart: defaultStart,
          sunEnd: defaultEnd,
        });
      } else {
       const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to load plan");
      }
   } catch (e: any) {
      setError(e?.message ?? "Plan load failed");
    } finally {
     setLoadingPlan(false);
    }
  }

  // Copy previous week's plan into current week
  async function copyPreviousWeek() {
    const prevWeek = addDays(weekStart, -7, timezone);
    try {
      setError(null);
      setNotice(null);
     const res = await fetch(
        `/api/employees/${id}/weekly-plan?weekStart=${encodeURIComponent(
          prevWeek
        )}`,
       { credentials: "include" }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        setError(txt || "Önceki hafta planı okunamadı.");
        return;
      }
      const data = await res.json();
      const item = data?.item;

      if (item) {
        setIsDirty(true);
        // Week default template (can be null)
        setWeekTemplateId(item.shiftTemplateId ?? "NONE");

       // Day modes: templateId > custom(minutes) > default
        setDayMode({
          mon:
            item.monShiftTemplateId ??
            (item.monStartMinute != null || item.monEndMinute != null ? "CUSTOM" : "DEFAULT"),
          tue:
            item.tueShiftTemplateId ??
            (item.tueStartMinute != null || item.tueEndMinute != null ? "CUSTOM" : "DEFAULT"),
          wed:
            item.wedShiftTemplateId ??
            (item.wedStartMinute != null || item.wedEndMinute != null ? "CUSTOM" : "DEFAULT"),
          thu:
            item.thuShiftTemplateId ??
            (item.thuStartMinute != null || item.thuEndMinute != null ? "CUSTOM" : "DEFAULT"),
          fri:
            item.friShiftTemplateId ??
            (item.friStartMinute != null || item.friEndMinute != null ? "CUSTOM" : "DEFAULT"),
          sat:
            item.satShiftTemplateId ??
            (item.satStartMinute != null || item.satEndMinute != null ? "CUSTOM" : "DEFAULT"),
          sun:
            item.sunShiftTemplateId ??
            (item.sunStartMinute != null || item.sunEndMinute != null ? "CUSTOM" : "DEFAULT"),
        });

        // Copy legacy minutes as visible times (Custom days will reflect these)
        setTimes({
          monStart: minutesToHHMM(item.monStartMinute),
          monEnd: minutesToHHMM(item.monEndMinute),
          tueStart: minutesToHHMM(item.tueStartMinute),
          tueEnd: minutesToHHMM(item.tueEndMinute),
          wedStart: minutesToHHMM(item.wedStartMinute),
          wedEnd: minutesToHHMM(item.wedEndMinute),
          thuStart: minutesToHHMM(item.thuStartMinute),
          thuEnd: minutesToHHMM(item.thuEndMinute),
          friStart: minutesToHHMM(item.friStartMinute),
          friEnd: minutesToHHMM(item.friEndMinute),
          satStart: minutesToHHMM(item.satStartMinute),
          satEnd: minutesToHHMM(item.satEndMinute),
          sunStart: minutesToHHMM(item.sunStartMinute),
          sunEnd: minutesToHHMM(item.sunEndMinute),
        });
        setNotice("Geçen haftanın planı kopyalandı. Kaydetmeyi unutma.");
      } else {
        // No previous plan: fill with default
        setIsDirty(true);
        setWeekTemplateId("NONE");
          setDayMode({
            mon: "DEFAULT",
            tue: "DEFAULT",
            wed: "DEFAULT",
            thu: "DEFAULT",
            fri: "DEFAULT",
            sat: "DEFAULT",
            sun: "DEFAULT",
          });
       setTimes({
          monStart: defaultStart,
          monEnd: defaultEnd,
          tueStart: defaultStart,
          tueEnd: defaultEnd,
          wedStart: defaultStart,
          wedEnd: defaultEnd,
          thuStart: defaultStart,
          thuEnd: defaultEnd,
          friStart: defaultStart,
          friEnd: defaultEnd,
          satStart: defaultStart,
          satEnd: defaultEnd,
          sunStart: defaultStart,
          sunEnd: defaultEnd,
        });
        setNotice("Önceki hafta için kayıtlı plan yok; varsayılan değerler yüklendi.");
      }
    } catch {
     setError("Önceki hafta planı kopyalanırken bir hata oluştu.");
    }
  }

 // Save the current plan
  async function save() {
    if (!id || !weekStart) return;
   setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Build payload; empty strings should be sent as null
     const payload: any = {
        weekStartDate: weekStart,
        shiftTemplateId: weekTemplateId !== "NONE" ? weekTemplateId : null,
      };

      dayKeys.forEach((key) => {
        const mode = dayMode[key];
        // Template override: send day template id, keep times null (server will derive)
        if (mode && mode !== "DEFAULT" && mode !== "CUSTOM") {
          payload[`${key}ShiftTemplateId`] = mode;
          payload[`${key}Start`] = null;
          payload[`${key}End`] = null;
          return;
        }
        // Default: inherit week template (or policy). Keep everything null.
        if (mode === "DEFAULT") {
          payload[`${key}ShiftTemplateId`] = null;
          payload[`${key}Start`] = null;
          payload[`${key}End`] = null;
          return;
        }
        // Custom: send explicit times
        const startKey = `${key}Start` as keyof TimesState;
        const endKey = `${key}End` as keyof TimesState;
        payload[`${key}ShiftTemplateId`] = null;
        payload[`${key}Start`] = times[startKey] || null;
        payload[`${key}End`] = times[endKey] || null;
      });

      const res = await fetch(`/api/employees/${id}/weekly-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
     });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to save");
      }
      // Reload plan after save to reflect normalization (server may coerce undefined -> null)
      await loadPlan();
      setNotice("Plan kaydedildi.");
      setIsDirty(false);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Change week by delta weeks (-1 for previous, +1 for next)
  function changeWeek(delta: number) {
    const newWeek = addDays(weekStart, delta * 7, timezone);
   setWeekStart(newWeek);
  }

  // Load policy once on mount
  useEffect(() => {
    loadPolicy();
    loadTemplates();
  }, []);

  // When timezone is known/updated, normalize weekStart to Monday in that timezone.
  // This prevents "Sunday" or "shifted day" issues on machines with different timezone settings.
  useEffect(() => {
    setWeekStart(computeWeekStart(new Date(), timezone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);

  // Reload plan whenever weekStart or id changes
  useEffect(() => {
    loadPlan();
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, weekStart]);

  // Auto-dismiss notice after a short delay
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      setNotice(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="grid gap-5 max-w-full min-w-0">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">İşlem sırasında hata</div>
              <div className="mt-1 break-words text-red-800/90 dark:text-red-200/90">{error}</div>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => setError(null)}>
              Kapat
            </Button>
          </div>
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Bilgi</div>
              <div className="mt-1 break-words text-sky-800/90 dark:text-sky-200/90">{notice}</div>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => setNotice(null)}>
              Kapat
            </Button>
          </div>
        </div>
      )}
      {/* Week selector and actions */}
      <div className="grid gap-5 lg:grid-cols-12 max-w-full min-w-0">
        <div className="lg:col-span-5 min-w-0">
          <Card
            title="Hafta"
            description="Hafta seçimi ve hızlı işlemler"
            right={isDirty ? <Badge tone="warn">Kaydedilmedi</Badge> : <Badge tone="muted">Güncel</Badge>}
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => changeWeek(-1)}>
                <Icon>{I.ChevronL}</Icon> Önceki
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => changeWeek(1)}>
                Sonraki <Icon>{I.ChevronR}</Icon>
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={copyPreviousWeek}>
                <Icon>{I.Copy}</Icon>
                <span className="sm:hidden">Geçen hafta</span>
                <span className="hidden sm:inline">Geçen haftayı kopyala</span>
              </Button>
            </div>

            <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/60 dark:bg-zinc-900/40 dark:ring-zinc-800">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Icon>{I.Calendar}</Icon>
                Hafta başlangıcı
              </div>
              <div className="mt-1 font-mono text-sm text-zinc-700 dark:text-zinc-300">{weekStart}</div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Varsayılan vardiya: {defaultStart || "--"} – {defaultEnd || "--"}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7 min-w-0">
          <Card title="Hafta Varsayılan Template" description="Template seçimi ve arama">
            <div className="grid gap-3 min-w-0">
              <div className="grid gap-1.5">
                <Label>Template ara</Label>
                <div className="flex gap-2 min-w-0">
                  <Input
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                    placeholder="Örn: 0900, 22:00, 0900-1700"
                  />
                  {templateQuery.trim() ? (
                    <Button variant="secondary" onClick={() => setTemplateQuery("")}>
                      Temizle
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Varsayılan</Label>
                <Select
                  value={weekTemplateId}
                  onChange={(e) => {
                    setWeekTemplateId(e.target.value);
                    setIsDirty(true);
                  }}
                >
                  <option value="NONE">(Policy Default)</option>
                  {getTemplatesForSelect(weekTemplateId).map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTemplateLabel(t)}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Week Summary Chips */}
              <div className="mt-1 flex flex-wrap items-center gap-2 min-w-0">
                <span className="mr-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Hafta Özeti</span>
                <ChipButton
                  onClick={() => onSummaryClick("WEEK")}
                  title="DEFAULT ve Week Template seçili günler"
                >
                  <Icon>{I.Layers}</Icon> {weekSummary.weekTemplateDays} gün Week Template
                </ChipButton>
                <ChipButton
                  onClick={() => onSummaryClick("POLICY")}
                  title="DEFAULT ve Week Template yoksa (Policy fallback)"
                >
                  <Icon>{I.Layers}</Icon> {weekSummary.policyDays} gün Policy
                </ChipButton>
                <ChipButton
                  onClick={() => onSummaryClick("DAY_TEMPLATE")}
                  title="Gün bazlı template seçili günler"
                >
                  <Icon>{I.Pin}</Icon> {weekSummary.dayTemplateDays} gün Day Template
                </ChipButton>
                <ChipButton
                  onClick={() => onSummaryClick("CUSTOM")}
                  title="Gün bazlı custom saat girilen günler"
                >
                  <Icon>{I.Pencil}</Icon> {weekSummary.customDays} gün Custom
                </ChipButton>
                <ChipButton
                  onClick={() => onSummaryClick("OVERNIGHT")}
                  title="Gece vardiyası (+1)"
                  className="dark:border-zinc-700"
                >
                  <span className="hidden dark:inline-flex"><Icon>{I.Moon}</Icon></span>
                  <span className="inline-flex dark:hidden"><Icon>{I.Moon}</Icon></span>
                  {weekSummary.overnightDays} gün Gece
                </ChipButton>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {/* Times input grid */}
     <Card title="Vardiya Saatleri" description="Gün bazında template veya custom saat girin">
        {loadingPlan ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Yükleniyor…</div>
        ) : (
          <div className="overflow-x-auto max-w-full min-w-0">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <th className="border-b border-zinc-200/70 py-2 pr-4 dark:border-zinc-800">Gün</th>
                  <th className="border-b border-zinc-200/70 py-2 pr-4 dark:border-zinc-800" style={{ width: 320 }}>
                    Template
                  </th>
                  <th className="border-b border-zinc-200/70 py-2 pr-4 dark:border-zinc-800" style={{ width: 160 }}>
                    Başlangıç
                  </th>
                  <th className="border-b border-zinc-200/70 py-2 pr-4 dark:border-zinc-800" style={{ width: 160 }}>
                    Bitiş
                  </th>
                  <th className="border-b border-zinc-200/70 py-2 dark:border-zinc-800" style={{ width: 160 }}>
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayKeys.map((key, idx) => {
                  const mode = dayMode[key];
                  const startKey = `${key}Start` as keyof TimesState;
                  const endKey = `${key}End` as keyof TimesState;
                  // Day is template-driven if:
                  // 1) explicit day template override selected OR
                  // 2) day is DEFAULT but weekTemplateId is set (Default -> Week Template)
                  const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
                  const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
                  const isTemplateDriven = isExplicitDayTemplate || isWeekTemplateDefault;  
                  const overnightByDayTemplate = isOvernightMode(mode);
                  const overnightByWeekTemplate =
                    mode === "DEFAULT" && weekTemplateId !== "NONE"
                      ? !!getWeekTemplate()?.spansMidnight
                      : false;
                  const isOvernight = overnightByDayTemplate || overnightByWeekTemplate;                
                  return (
                    <tr
                      key={key}
                      data-day-row={key}
                      className={cx(
                        "text-sm",
                        highlightDays[key] && "ring-2 ring-amber-400/70 ring-inset rounded-lg",
                      )}
                    >
                      <td className="border-b border-zinc-100 py-2 pr-4 font-medium text-zinc-900 dark:border-zinc-900/60 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span>{dayNames[idx]}</span>
                          {isOvernight ? (
                            <span className="inline-flex items-center">
                              <Badge tone="muted">
                                <span className="inline-flex items-center gap-1">
                                  <Icon>{I.Moon}</Icon>
                                  +1
                                </span>
                              </Badge>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 py-2 pr-4 dark:border-zinc-900/60">
                        <Select
                          value={mode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDayMode((prev) => ({ ...prev, [key]: v }));
                            setIsDirty(true);
                            // Keep times state roughly aligned for a predictable Save
                            if (v !== "DEFAULT" && v !== "CUSTOM") {
                              const tpl = getTemplateById(v);
                              if (tpl) {
                                setTimes((prev) => ({
                                  ...prev,
                                  [startKey]: tpl.startTime,
                                  [endKey]: tpl.endTime,
                                }));
                              }
                            } else if (v === "DEFAULT") {
                              const wk = getWeekTemplate();
                              const s = wk ? wk.startTime : defaultStart;
                              const e2 = wk ? wk.endTime : defaultEnd;
                              setTimes((prev) => ({
                                ...prev,
                                [startKey]: s,
                                [endKey]: e2,
                              }));
                            }
                          }}
                        >
                          <option value="DEFAULT">{getDefaultDayLabel()}</option>
                          <option value="CUSTOM">Custom</option>
                          {getTemplatesForSelect(mode).map((t) => (
                            <option key={t.id} value={t.id}>
                              {formatTemplateLabel(t)}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="border-b border-zinc-100 py-2 pr-4 dark:border-zinc-900/60">
                        <Input
                          type="time"
                          value={getDisplayedTime(key, "start")}
                          disabled={isTemplateDriven}
                          onChange={(e) => {
                            setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                            setTimes((prev) => ({ ...prev, [startKey]: e.target.value }));
                            setIsDirty(true);
                          }}
                        />
                      </td>
                      <td className="border-b border-zinc-100 py-2 pr-4 dark:border-zinc-900/60">
                        <Input
                          type="time"
                          value={getDisplayedTime(key, "end")}
                          disabled={isTemplateDriven}
                          onChange={(e) => {
                            setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                            setTimes((prev) => ({ ...prev, [endKey]: e.target.value }));
                            setIsDirty(true);
                          }}
                        />
                      </td>
                      
                      <td className="border-b border-zinc-100 py-2 dark:border-zinc-900/60">
                        {isTemplateDriven ? (
                          <Button
                            type="button"
                            onClick={() => {
                              const currentStart = getDisplayedTime(key, "start");
                              const currentEnd = getDisplayedTime(key, "end");
                              setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                              setTimes((prev) => ({
                                ...prev,
                                [startKey]: currentStart,
                                [endKey]: currentEnd,
                              }));
                              setIsDirty(true);
                            }}
                            variant="secondary"
                            className="px-2 py-1.5 text-xs"
                          >
                            Custom&apos;a geç
                          </Button>
                        ) : (
                          <span className="text-sm text-zinc-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white px-4 py-3 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/40">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {isDirty ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500/90" />
              Değişiklikler kaydedilmedi
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
              Kaydedilmiş görünüyor
            </span>
          )}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Planı Kaydet"}
        </Button>
      </div>
    </div>
  );
}