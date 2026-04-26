"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Bundle = {
  company: { id: string; name: string };
  policy: {
    id: string;
    companyId: string;

    timezone: string;
    shiftStartMinute: number;
    shiftEndMinute: number;
    breakMinutes: number;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;

    breakAutoDeductEnabled: boolean;
    offDayEntryBehavior: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    leaveEntryBehavior: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    overtimeEnabled: boolean;
    /**
     * Enterprise: Overtime dynamic break
     * (nullable => disabled)
     */
    otBreakInterval?: number | null;
    otBreakDuration?: number | null;
    workedCalculationMode?: "ACTUAL" | "CLAMP_TO_SHIFT" | null;

    /**
     * Advanced / Optional policy fields
     * (varsayılan davranışı etkilemez)
     */
    graceAffectsWorked?: boolean | null;
    graceMode?: "ROUND_ONLY" | "PAID_PARTIAL" | null;
    exitConsumesBreak?: boolean | null;
    maxSingleExitMinutes?: number | null;
    ownershipNextShiftLookaheadMinutes?: number | null;
    maxDailyExitMinutes?: number | null;
    exitExceedAction?: "IGNORE" | "WARN" | "FLAG" | null;
  };
};

function minutesToHHMM(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Icon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("inline-flex items-center justify-center", className)}>{children}</span>;
}

const Icons = {
  Policy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7 4.5h8a2 2 0 0 1 2 2v12l-3-1.75L11 18.5 8 16.75 5 18.5v-12a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9h6M9 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Shift: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M14.5 3a7.5 7.5 0 1 0 6.5 11.25A8.5 8.5 0 1 1 14.5 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  Org: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 4.5h15v15h-15v-15Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 4.5v15M15 4.5v15M4.5 9h15M4.5 15h15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Company: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 20V7.5L12 4l7 3.5V20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 20v-4h6v4M9 9h.01M15 9h.01M9 12h.01M15 12h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Settings: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.05.05a1.5 1.5 0 0 1-2.12 2.12l-.05-.05a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.92V19a1.5 1.5 0 0 1-3 0v-.08a1 1 0 0 0-.66-.94 1 1 0 0 0-1.08.22l-.06.05a1.5 1.5 0 1 1-2.12-2.12l.05-.05a1 1 0 0 0 .22-1.08 1 1 0 0 0-.94-.66H5a1.5 1.5 0 0 1 0-3h.08a1 1 0 0 0 .94-.66 1 1 0 0 0-.22-1.08l-.05-.06a1.5 1.5 0 1 1 2.12-2.12l.06.05a1 1 0 0 0 1.08.22 1 1 0 0 0 .66-.94V5a1.5 1.5 0 0 1 3 0v.08a1 1 0 0 0 .66.94 1 1 0 0 0 1.08-.22l.05-.05a1.5 1.5 0 1 1 2.12 2.12l-.05.06a1 1 0 0 0-.22 1.08 1 1 0 0 0 .94.66H19a1.5 1.5 0 0 1 0 3h-.08a1 1 0 0 0-.94.66A1 1 0 0 0 19.4 15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Advanced: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 7.5l2.5 2.5M14 14l2.5 2.5M16.5 7.5 14 10M10 14l-2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  Save: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 4.5h11l3 3V19.5H5V4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 4.5v5h8v-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 19.5v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  Refresh: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0 2 5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v7h-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ------------------------------------------------------------
// Mini Design System (Palette / Badges / Buttons / Icons)
// ------------------------------------------------------------
const DS = {
  ring: "focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
  card: "rounded-3xl border border-zinc-300/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.055)] ring-1 ring-white/70",
  softCard:
    "rounded-3xl border border-zinc-300/70 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_26%),linear-gradient(135deg,rgba(240,249,255,0.98)_0%,rgba(255,255,255,0.98)_45%,rgba(245,243,255,0.98)_100%)] shadow-[0_12px_30px_rgba(79,70,229,0.06)] ring-1 ring-white/75",
  muted: "text-zinc-500",
};

function panelCard(extra?: string) {
  return cx(
    "rounded-3xl border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_10px_26px_rgba(15,23,42,0.055)] ring-1 ring-white/70",
    extra
  );
}

type BadgeTone = "neutral" | "good" | "warn" | "danger" | "info" | "violet";

function toneClasses(t: BadgeTone) {
  switch (t) {
    case "good":
      return {
        pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
        chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
        card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-white",
      };
    case "warn":
      return {
        pill: "border-amber-200 bg-amber-50 text-amber-800",
        chip: "border-amber-200 bg-amber-50 text-amber-900",
        card: "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white",
      };
    case "danger":
      return {
        pill: "border-red-200 bg-red-50 text-red-800",
        chip: "border-red-200 bg-red-50 text-red-800",
        card: "border-red-200/70 bg-gradient-to-br from-red-50 via-white to-white",
      };
    case "info":
      return {
        pill: "border-sky-200 bg-sky-50 text-sky-800",
        chip: "border-sky-200 bg-sky-50 text-sky-900",
        card: "border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-white",
      };
    case "violet":
      return {
        pill: "border-violet-200 bg-violet-50 text-violet-800",
        chip: "border-violet-200 bg-violet-50 text-violet-900",
        card: "border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-white",
      };
    default:
      return {
        pill: "border-zinc-200 bg-white/60 text-zinc-700",
        chip: "border-zinc-200 bg-zinc-50 text-zinc-700",
        card: "border-zinc-200 bg-white",
      };
  }
}

function Badge(props: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  const t = props.tone ?? "neutral";
  const tc = toneClasses(t);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tc.pill,
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
function Button(props: {
  variant?: BtnVariant;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: () => void;
}) {
  const v = props.variant ?? "secondary";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold transition";
  const variants = {
    // Daha “ürün” hissi: mavi/indigo accent
    primary:
      "border border-indigo-700 bg-[linear-gradient(180deg,rgba(129,140,248,0.98)_0%,rgba(99,102,241,0.98)_100%)] text-white shadow-[0_10px_22px_rgba(99,102,241,0.22)] hover:border-indigo-800 hover:bg-[linear-gradient(180deg,rgba(99,102,241,1)_0%,rgba(79,70,229,1)_100%)]",
    secondary:
      "border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,244,245,0.94)_100%)] text-zinc-800 hover:bg-zinc-50 shadow-sm",
    ghost: "border border-transparent bg-transparent text-zinc-700 hover:bg-zinc-50",
    danger: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  }[v];
  const disabled = props.disabled ? "cursor-not-allowed opacity-60" : "";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={cx(base, variants, DS.ring, disabled, props.className)}
    >
      {props.children}
    </button>
  );
}

function IconChip(props: { tone?: BadgeTone; children: ReactNode }) {
  const t = props.tone ?? "neutral";
  const tc = toneClasses(t);
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl border text-[16px] shadow-sm",
        tc.chip
      )}
    >
      {props.children}
    </span>
  );
}

function TonePill(props: { tone?: "neutral" | "good" | "warn"; children: ReactNode }) {
  const tone = props.tone ?? "neutral";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "neutral" && "border-zinc-200 bg-white/60 text-zinc-700"
      )}
    >
      {props.children}
    </span>
  );
}

function NavButton(props: { onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "rounded-2xl border border-zinc-300/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,247,255,0.92)_100%)] px-3 py-2.5 text-left",
        "shadow-[0_8px_18px_rgba(79,70,229,0.04)] transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(238,242,255,0.96)_100%)]",
        DS.ring
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900">{props.title}</div>
      <div className="mt-1 text-[11px] leading-5 text-zinc-500">{props.desc}</div>
    </button>
  );
}

function SectionNavButton(props: {
  active?: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "rounded-2xl border px-3 py-2.5 text-left transition",
        props.active
          ? "border-indigo-300/80 bg-[linear-gradient(180deg,rgba(238,242,255,1)_0%,rgba(224,231,255,0.96)_100%)] shadow-[0_10px_20px_rgba(79,70,229,0.08)] ring-1 ring-white/75"
          : "border-zinc-300/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,247,255,0.92)_100%)] shadow-[0_8px_18px_rgba(79,70,229,0.04)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(238,242,255,0.96)_100%)]",
        DS.ring
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border",
            props.active
              ? "border-indigo-200/80 bg-white/85 text-indigo-700 shadow-sm"
              : "border-zinc-200/80 bg-white/80 text-zinc-600 shadow-sm"
          )}
        >
          {props.icon}
        </span>
        <span className="min-w-0">
          <span
            className={cx(
              "block text-xs font-semibold uppercase tracking-[0.08em]",
              props.active ? "text-indigo-900" : "text-zinc-900"
            )}
          >
            {props.title}
          </span>
          <span className="mt-1 block text-[11px] leading-5 text-zinc-500">{props.desc}</span>
        </span>
      </div>
    </button>
  );
}

function FieldShell(props: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-zinc-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-[11px] text-zinc-500">{props.hint}</span> : null}
    </label>
  );
}

function InlineInfo(props: { tone?: "neutral" | "warn"; title: string; desc: ReactNode }) {
  const tone = props.tone ?? "neutral";
  return (
    <div
      className={cx(
        "rounded-2xl border p-3 ring-1 ring-white/70",
        tone === "warn"
          ? "border-amber-300/65 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]"
          : "border-zinc-300/65 bg-[linear-gradient(180deg,rgba(250,250,250,1)_0%,rgba(244,244,245,0.84)_100%)]"
      )}
    >
      <div className={cx("text-xs font-semibold", tone === "warn" ? "text-amber-900" : "text-zinc-700")}>
        {props.title}
      </div>
      <div className={cx("mt-1 text-xs", tone === "warn" ? "text-amber-800" : "text-zinc-600")}>{props.desc}</div>
    </div>
  );
}

function ShortcutCard(props: {
  href: string;
  title: string;
  desc: ReactNode;
  badge?: string;
  icon?: ReactNode;
  tone?: BadgeTone;
}) {
  const tone = props.tone ?? "neutral";
  const tc = toneClasses(tone);
  return (
    <a
      href={props.href}
      className={cx(
        "group block rounded-3xl border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-white/70",
        tc.card,
        "transition hover:-translate-y-0.5 hover:shadow-md",
        DS.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {props.icon ? <IconChip tone={tone}>{props.icon}</IconChip> : null}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950">{props.title}</div>
              <div className="mt-1 text-xs text-zinc-600">{props.desc}</div>
            </div>
          </div>
        </div>
        {props.badge ? (
          <Badge tone={tone}>{props.badge}</Badge>
        ) : null}
      </div>
      <div className="mt-3 inline-flex items-center rounded-xl border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm group-hover:text-zinc-900">
        Aç →
      </div>
    </a>
  );
}

export default function CompanySettingsClient({ canWrite }: { canWrite: boolean }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  const readOnly = !canWrite;

  function showReadOnlyNotice() {
    setNotice("Supervisor modu: sadece görüntüleme. Değişiklik yapamazsın.");
    window.clearTimeout((showReadOnlyNotice as any)._t);
    (showReadOnlyNotice as any)._t = window.setTimeout(() => setNotice(null), 2500);
  }

  const companyRef = useRef<HTMLDivElement | null>(null);
  const policyRef = useRef<HTMLDivElement | null>(null);
  const advancedRef = useRef<HTMLDivElement | null>(null);
  const scrollTo = (r: React.RefObject<HTMLDivElement | null>) => r.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [breakMin, setBreakMin] = useState(60);
  const [lateGrace, setLateGrace] = useState(5);
  const [earlyGrace, setEarlyGrace] = useState(5);

  const [breakAutoDeductEnabled, setBreakAutoDeductEnabled] = useState(true);
  const [offDayEntryBehavior, setOffDayEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("IGNORE");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [workedCalculationMode, setWorkedCalculationMode] =
    useState<"ACTUAL" | "CLAMP_TO_SHIFT">("ACTUAL");

  // Enterprise: Overtime dynamic break (optional)
  const [otBreakInterval, setOtBreakInterval] = useState<string>("");
  const [otBreakDuration, setOtBreakDuration] = useState<string>("");

  // Behavior when punches occur on leave days
  const [leaveEntryBehavior, setLeaveEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("FLAG");

  // Advanced / Optional policy states
  const [graceAffectsWorked, setGraceAffectsWorked] = useState<boolean>(false);
  const [exitConsumesBreak, setExitConsumesBreak] = useState<boolean>(false);
  const [maxSingleExitMinutes, setMaxSingleExitMinutes] = useState<string>("");
  const [maxDailyExitMinutes, setMaxDailyExitMinutes] = useState<string>("");
  const [ownershipNextShiftLookaheadMinutes, setOwnershipNextShiftLookaheadMinutes] = useState<string>("");
  const [exitExceedAction, setExitExceedAction] =
    useState<"" | "IGNORE" | "WARN" | "FLAG">("");

  const canSave = useMemo(() => !!name && !!timezone, [name, timezone]);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<"company" | "policy" | "advanced">("company");


  async function load() {
    setError(null);
    // include credentials so that session cookie is sent; disable caching
    const res = await fetch("/api/company", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      setError(`Load failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as Bundle;
    setBundle(data);

    setName(data.company.name);
    setTimezone(data.policy.timezone);
    setStart(minutesToHHMM(data.policy.shiftStartMinute));
    setEnd(minutesToHHMM(data.policy.shiftEndMinute));
    setBreakMin(data.policy.breakMinutes);
    setLateGrace(data.policy.lateGraceMinutes);
    setEarlyGrace(data.policy.earlyLeaveGraceMinutes);

    setBreakAutoDeductEnabled(Boolean(data.policy.breakAutoDeductEnabled));
    setOffDayEntryBehavior(data.policy.offDayEntryBehavior);
    setLeaveEntryBehavior(data.policy.leaveEntryBehavior ?? "FLAG");
    setOvertimeEnabled(Boolean(data.policy.overtimeEnabled));
    setWorkedCalculationMode((data.policy.workedCalculationMode ?? "ACTUAL") as any);

    // Enterprise: Overtime dynamic break (optional)
    setOtBreakInterval(
      data.policy.otBreakInterval != null ? String(data.policy.otBreakInterval) : ""
    );
    setOtBreakDuration(
      data.policy.otBreakDuration != null ? String(data.policy.otBreakDuration) : ""
    );

    // Advanced / Optional policy fields
    // Determine grace toggle based on graceMode (preferred) or graceAffectsWorked (legacy)
    if (data.policy.graceMode != null) {
      setGraceAffectsWorked(data.policy.graceMode === "PAID_PARTIAL");
    } else {
      setGraceAffectsWorked(Boolean(data.policy.graceAffectsWorked));
    }
    setExitConsumesBreak(Boolean(data.policy.exitConsumesBreak));

    setMaxSingleExitMinutes(
      data.policy.maxSingleExitMinutes != null
        ? String(data.policy.maxSingleExitMinutes)
        : ""
    );

    setMaxDailyExitMinutes(
      data.policy.maxDailyExitMinutes != null
        ? String(data.policy.maxDailyExitMinutes)
        : ""
    );

    setOwnershipNextShiftLookaheadMinutes(
      data.policy.ownershipNextShiftLookaheadMinutes != null
        ? String(data.policy.ownershipNextShiftLookaheadMinutes)
        : ""
    );

    setExitExceedAction(
      data.policy.exitExceedAction ?? ""
    );
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const sections = [
      { key: "company" as const, ref: companyRef },
      { key: "policy" as const, ref: policyRef },
      { key: "advanced" as const, ref: advancedRef },
    ];

    const onScroll = () => {
      const threshold = 140;
      let current: "company" | "policy" | "advanced" = "company";

      for (const s of sections) {
        const el = s.ref.current;
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= threshold) current = s.key;
      }

      setActiveSection(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function saveCompany() {
    if (readOnly) {
      showReadOnlyNotice();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(`Save company failed (${res.status})`);
        return;
      }
      await load();
      setJustSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function savePolicy() {
    if (readOnly) {
      showReadOnlyNotice();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          timezone,
          shiftStartMinute: hhmmToMinutes(start),
          shiftEndMinute: hhmmToMinutes(end),
          breakMinutes: Number(breakMin),
          lateGraceMinutes: Number(lateGrace),
          earlyLeaveGraceMinutes: Number(earlyGrace),

          breakAutoDeductEnabled,
          offDayEntryBehavior,
          leaveEntryBehavior,
          overtimeEnabled,
          workedCalculationMode,

          // Enterprise: Overtime dynamic break
          // "" => null (disable)
          otBreakInterval:
            otBreakInterval.trim() === ""
              ? null
              : (Number.isFinite(Number(otBreakInterval)) && Number(otBreakInterval) > 0
                  ? Number(otBreakInterval)
                  : null),
          otBreakDuration:
            otBreakDuration.trim() === ""
              ? null
              : (Number.isFinite(Number(otBreakDuration)) && Number(otBreakDuration) > 0
                  ? Number(otBreakDuration)
                  : null),

          // ✅ Advanced / Optional (boşsa gönderme)
          graceMode: graceAffectsWorked ? "PAID_PARTIAL" : "ROUND_ONLY",
          // IMPORTANT:
          // false/0 değerleri de persist edilebilsin diye undefined'a düşürmüyoruz.
          exitConsumesBreak,
          maxSingleExitMinutes: maxSingleExitMinutes === "" ? 0 : Number(maxSingleExitMinutes),
          maxDailyExitMinutes: maxDailyExitMinutes === "" ? 0 : Number(maxDailyExitMinutes),    
          ownershipNextShiftLookaheadMinutes:
            ownershipNextShiftLookaheadMinutes.trim() === ""
              ? 0
              : Number(ownershipNextShiftLookaheadMinutes), 
          exitExceedAction: exitExceedAction !== "" ? exitExceedAction : undefined,
        }),
      });
      if (!res.ok) {
        setError(`Save policy failed (${res.status})`);
        return;
      }
      await load();
      setJustSaved(true);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const dirtyCompany = useMemo(() => {
    if (!bundle) return false;
    return name !== (bundle.company?.name ?? "");
  }, [bundle, name]);
  const dirtyPolicy = useMemo(() => {
    if (!bundle) return false;
    const p = bundle.policy;
    const curStart = hhmmToMinutes(start);
    const curEnd = hhmmToMinutes(end);
   const curBreak = Number(breakMin);
    const curLate = Number(lateGrace);
    const curEarly = Number(earlyGrace);

    const curGraceMode = graceAffectsWorked ? "PAID_PARTIAL" : "ROUND_ONLY";
    const curMaxSingle = maxSingleExitMinutes === "" ? 0 : Number(maxSingleExitMinutes);
    const curMaxDaily = maxDailyExitMinutes === "" ? 0 : Number(maxDailyExitMinutes);
    const curOwnershipNextShiftLookahead = ownershipNextShiftLookaheadMinutes === "" ? 0 : Number(ownershipNextShiftLookaheadMinutes);
    const curExitExceedAction = exitExceedAction !== "" ? exitExceedAction : undefined;
    const curOtBreakInterval = otBreakInterval.trim() === "" ? null : Number(otBreakInterval);
    const curOtBreakDuration = otBreakDuration.trim() === "" ? null : Number(otBreakDuration);
    // API'den null gelebilir; UI'da boş değer undefined. Dirty hesapta eşitleyelim.
    const savedExitExceedAction = (p.exitExceedAction ?? undefined) as any;

   return (
      timezone !== (p.timezone ?? "") ||
      curStart !== (p.shiftStartMinute ?? 0) ||
      curEnd !== (p.shiftEndMinute ?? 0) ||
      curBreak !== (p.breakMinutes ?? 0) ||
      curLate !== (p.lateGraceMinutes ?? 0) ||
      curEarly !== (p.earlyLeaveGraceMinutes ?? 0) ||
      Boolean(breakAutoDeductEnabled) !== Boolean(p.breakAutoDeductEnabled) ||
      offDayEntryBehavior !== (p.offDayEntryBehavior ?? "IGNORE") ||
      (leaveEntryBehavior ?? "FLAG") !== (p.leaveEntryBehavior ?? "FLAG") ||
      Boolean(overtimeEnabled) !== Boolean(p.overtimeEnabled) ||
      (workedCalculationMode ?? "ACTUAL") !== ((p.workedCalculationMode ?? "ACTUAL") as any) ||
      (p.otBreakInterval ?? null) !== curOtBreakInterval ||
      (p.otBreakDuration ?? null) !== curOtBreakDuration ||
      curGraceMode !== (p.graceMode ?? "ROUND_ONLY") ||
      Boolean(exitConsumesBreak) !== Boolean(p.exitConsumesBreak) ||
      curMaxSingle !== (p.maxSingleExitMinutes ?? 0) ||
      curMaxDaily !== (p.maxDailyExitMinutes ?? 0) ||
      curOwnershipNextShiftLookahead !== (p.ownershipNextShiftLookaheadMinutes ?? 0) ||
      curExitExceedAction !== savedExitExceedAction
    );
  }, [
    bundle,
    timezone,
    start,
    end,
    breakMin,
    lateGrace,
    earlyGrace,
    breakAutoDeductEnabled,
    offDayEntryBehavior,
    leaveEntryBehavior,
    overtimeEnabled,
    workedCalculationMode,
    otBreakInterval,
    otBreakDuration,
    graceAffectsWorked,
    exitConsumesBreak,
    maxSingleExitMinutes,
    maxDailyExitMinutes,
    ownershipNextShiftLookaheadMinutes,
    exitExceedAction,
  ]);

  const showSaveBar = !readOnly && (dirtyCompany || dirtyPolicy);

  if (error) {
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">Hata</div>
          <div className="mt-1">{error}</div>
        </div>
        <button
          className="w-fit rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
          onClick={load}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        Yükleniyor...
      </div>
    );
  }

  // Vazgeç (Yenile): server'daki son kaydedilmiş haline dön
  async function revertToSaved() {
    setJustSaved(false);
    await load();
  }

  return (
    <div className="grid gap-4 pb-10">
      {/* Hero */}
     <div className={cx(DS.softCard, "p-5 md:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-zinc-500">Ayarlar</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-xl font-semibold tracking-tight text-zinc-900">Şirket &amp; Politika</div>
              {readOnly ? <TonePill tone="warn">Read-only (Supervisor)</TonePill> : null}
              <TonePill tone={showSaveBar ? "warn" : "good"}>
                {showSaveBar ? "Kaydedilmemiş değişiklik var" : "Kaydedildi"}
              </TonePill>
              <TonePill tone="neutral">TZ: {timezone}</TonePill>
              <TonePill tone="neutral">{name || bundle.company.name}</TonePill>
            </div>
            <div className="mt-2 max-w-3xl text-[13px] leading-6 text-zinc-600">
              Firma kimliği ve çalışma kuralları. Hesap motoru bu ayarları tek merkezden kullanır (tek kural kaynağı).
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              İpucu: Değişiklik yaptığınızda altta “Kaydedilmemiş değişiklikler” çubuğu görünür. Kaydetmeden çıkarsanız değerler korunmaz.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={saving}>
              <Icon>{Icons.Refresh}</Icon>
              Yenile
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (readOnly) {
                  showReadOnlyNotice();
                  return;
                }
                if (dirtyCompany) await saveCompany();
                if (dirtyPolicy) await savePolicy();
              }}
              disabled={!canSave || saving || !showSaveBar}
              title={!showSaveBar ? "Değişiklik yok" : "Hepsini Kaydet"}
            > 
              <Icon>{Icons.Save}</Icon>
              {saving ? "Kaydediliyor..." : "Hepsini Kaydet"}
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mt-3 rounded-2xl border border-amber-300/65 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)] px-4 py-3 text-sm text-amber-900 ring-1 ring-white/70">
            {notice}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ShortcutCard
            href="/policy/rule-sets"
            title="Kural Setleri"
            icon={Icons.Policy}
            tone="violet"
            desc={<>Çalışma kurallarını tanımlayın ve Workforce/Segment ile vardiya katmanlarında yönetin.</>}
            badge="POLICY"
          />
          <ShortcutCard
            href="/policy/shift-overrides"
            title="Vardiya Kural İstisnaları"
            icon={Icons.Shift}
            tone="warn"
            desc={<>Vardiya bazlı kural istisnası tanımlayın (Model-B). ShiftCode üzerinden kural seti bağlanır.</>}
            badge="SHIFT"
          />
          <ShortcutCard
            href="/org"
            title="Organizasyon"
            icon={Icons.Org}
            tone="info"
            desc={<>Şube / Kapı / Cihaz envanteri. Kaynaklar ve görünürlük için tek yer.</>}
            badge="ORG"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className={cx("sticky top-4", panelCard("p-3 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,248,255,0.96)_100%)]"))}>
            <div className="text-[11px] font-semibold tracking-wide text-zinc-500">Hızlı Geçiş</div>
            <div className="mt-2 grid gap-2">
              <SectionNavButton
                active={activeSection === "company"}
                onClick={() => {
                  setActiveSection("company");
                  scrollTo(companyRef);
                }}
                title="Company"
                desc="Firma adı ve temel kimlik"
                icon={Icons.Company}
              />
              <SectionNavButton
                active={activeSection === "policy"}
                onClick={() => {
                  setActiveSection("policy");
                  scrollTo(policyRef);
                }}
                title="Policy"
                desc="Timezone, shift, grace, davranışlar"
                icon={Icons.Settings}
              />
              <SectionNavButton
                active={activeSection === "advanced"}
                onClick={() => {
                  setActiveSection("advanced");
                  scrollTo(advancedRef);
                }}
                title="Advanced"
                desc="Opsiyonel alanlar / limitler"
                icon={Icons.Advanced}
              />
           </div>
          </div>
        </aside>

        <main className="lg:col-span-9 grid gap-4">

      {/* Company */}
      <section
        ref={companyRef}
        className={panelCard(
          "p-5 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.96)_100%)] border-sky-200/70"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Company</h2>
            <div className="mt-1 text-xs text-zinc-500">Firma adı ve temel kimlik bilgisi.</div>
          </div>
          <Badge tone="info">ADMIN</Badge>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldShell label="Firma Adı">
            <input
              className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Turnike Demo"
              disabled={saving || readOnly}
            />
          </FieldShell>

          <div className="flex items-end justify-end">
            <Button
              variant="primary"
              disabled={!canSave || saving || !dirtyCompany}
              onClick={() => {
                if (readOnly) return showReadOnlyNotice();
                saveCompany();
              }}
              className="h-10 text-sm"
            >
              <Icon>{Icons.Save}</Icon>
              {saving ? "Kaydediliyor..." : "Company Kaydet"}
            </Button>
          </div>
        </div>
      </section>

      {/* Policy */}
      <section
        ref={policyRef}
        className={panelCard(
          "p-5 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.10),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.96)_100%)] border-violet-200/70"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Company Policy</h2>
            <div className="mt-1 text-xs text-zinc-500">
              Vardiya, grace, break, izin (LEAVE) ve fazla mesai (OT) davranışları.
            </div>
          </div>
          <Badge tone="info">ADMIN/HR</Badge>
        </div>

        {/* Core */}
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell
              label="Timezone"
              hint="Canonical work day bu timezone’a göre tekilleştirilir."
            >
              <input
                className="h-10 w-full min-w-0 rounded-2xl border border-violet-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Istanbul"
                disabled={saving || readOnly}
              />
            </FieldShell>

            <div className="rounded-2xl border border-violet-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.90)_100%)] p-3 shadow-sm ring-1 ring-white/70">
              <div className="text-xs font-medium text-zinc-700">Gün Anahtarı (Canonical Work Day)</div>
              <div className="mt-1 text-xs text-zinc-600">
                Tüm UI/rapor/servis aynı gün anahtarını üretir. Timezone değişimi “bugün/dün kayması” gibi rapor eşleşmelerini etkiler.
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Öneri: Canlı sistemde timezone değişimini mesai dışı planlayın.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-4 rounded-2xl border border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
              <div className="text-sm font-semibold text-zinc-900">Shift</div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label="Shift Start">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={saving || readOnly}
                  />
                </FieldShell>
                <FieldShell label="Shift End">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={saving || readOnly}
                  />
                </FieldShell>
              </div>
              <FieldShell label="Break Minutes" hint="Otomatik break düşümü açıksa worked’dan düşer.">
                <input
                  className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  type="number"
                  value={breakMin}
                  onChange={(e) => setBreakMin(Number(e.target.value))}
                  disabled={saving || readOnly}
                />
              </FieldShell>
              <div className="text-[11px] text-zinc-500">
                Not: Break Auto Deduct kapalıysa, break dakikaları sadece raporlamada bilgi amaçlı kalır.
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-violet-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
              <div className="text-sm font-semibold text-zinc-900">Grace</div>
              <div className="text-[11px] text-zinc-500">
                Grace, geç kalma / erken çıkma toleransıdır. Anomali üretimini ve bazı modlarda worked hesabını etkileyebilir.
              </div>
              <div className="grid gap-4 xl:grid-cols-2 items-start">
                <FieldShell label="Late Grace Minutes">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-violet-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="number"
                    value={lateGrace}
                    onChange={(e) => setLateGrace(Number(e.target.value))}
                    disabled={saving || readOnly}
                  />
                </FieldShell>
                <FieldShell label="Early Leave Grace Minutes">
                  <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-violet-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    type="number"
                    value={earlyGrace}
                    onChange={(e) => setEarlyGrace(Number(e.target.value))}
                    disabled={saving || readOnly}
                  />
                </FieldShell>
              </div>
            </div>
          </div>

          {/* Behaviors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
              <div className="text-sm font-semibold text-zinc-900">Davranışlar</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-white/85 p-3 shadow-sm">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Break Auto Deduct</div>
                    <div className="text-xs text-zinc-500">Açıksa, break süresi worked’dan otomatik düşülür.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={breakAutoDeductEnabled}
                    onChange={(e) => setBreakAutoDeductEnabled(e.target.checked)}
                    className="h-4 w-4"
                    disabled={saving || readOnly}
                  />
                </div>

                <FieldShell
                  label="Off Day Entry Behavior"
                  hint="OFF: hafta sonu / resmi tatil gibi çalışılmayan gün (LEAVE değildir). OFF gününde punch gelirse ne olacak?"
                >
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-amber-200/70 bg-white/95 px-3 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={offDayEntryBehavior}
                    onChange={(e) => setOffDayEntryBehavior(e.target.value as any)}
                    disabled={saving || readOnly}
                  >
                    <option value="IGNORE">IGNORE (yok say)</option>
                    <option value="FLAG">FLAG (göster + anomali üret)</option>
                    <option value="COUNT_AS_OT">COUNT_AS_OT (fazla mesaiye yaz)</option>
                  </select>
                </FieldShell>

                <FieldShell
                  label="Leave Entry Behavior"
                  hint="LEAVE: yıllık izin/rapor/mazeret (OFF ≠ LEAVE). İzin gününde punch gelirse ne olacak?"
                >
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-amber-200/70 bg-white/95 px-3 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={leaveEntryBehavior}
                    onChange={(e) => setLeaveEntryBehavior(e.target.value as any)}
                    disabled={saving || readOnly}
                  >
                    <option value="IGNORE">IGNORE (çalışmayı yok say)</option>
                    <option value="FLAG">FLAG (çalışmayı göster + anomali)</option>
                    <option value="COUNT_AS_OT">COUNT_AS_OT (çalışmayı OT yaz)</option>
                  </select>
                </FieldShell>

                <InlineInfo
                  title="OFF ≠ LEAVE"
                  tone="warn"
                  desc={
                    <>
                      OFF: takvimsel tatil/hafta sonu. LEAVE: personel bazlı izin. Raporlama ve bordro için bu ayrım kritiktir.
                    </>
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
              <div className="text-sm font-semibold text-zinc-900">Overtime</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/70 bg-white/85 p-3 shadow-sm">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Overtime Enabled</div>
                    <div className="text-xs text-zinc-500">Açıksa fazla mesai (OT) hesaplamaları devreye girer.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    disabled={saving || readOnly}
                    className="h-4 w-4"
                  />
                </div>

                <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">Worked Calculation Mode</div>
                      <div className="text-xs text-zinc-500">
                        ACTUAL: gerçek IN/OUT’a göre hesaplar. CLAMP: vardiya sınırlarına kırpar.
                      </div>
                    </div>
                  </div>
                  <select
                    className="mt-2 h-10 w-full min-w-0 rounded-2xl border border-emerald-200/70 bg-white/95 px-3 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10 overflow-hidden text-ellipsis whitespace-nowrap"
                    value={workedCalculationMode}
                    onChange={(e) => setWorkedCalculationMode(e.target.value as any)}
                    disabled={saving || readOnly}
                  >
                    <option value="ACTUAL">ACTUAL (Gerçek giriş/çıkışa göre)</option>
                    <option value="CLAMP_TO_SHIFT">CLAMP_TO_SHIFT (Vardiya saatlerine kırp)</option>
                  </select>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    İpucu: ACTUAL seçilirse erken giriş/geç çıkış worked’u artırabilir. CLAMP seçilirse vardiya dışı süreler kırpılır.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div
            ref={advancedRef}
            className={panelCard(
              "p-4 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.94)_100%)] border-amber-200/70"
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-amber-200/70 bg-white/90 px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-amber-50/70"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <span>Advanced / Optional</span>
              <Badge tone={advancedOpen ? "warn" : "neutral"}>{advancedOpen ? "Açık" : "Kapalı"}</Badge>
            </button>

            {advancedOpen ? (
              <div className="mt-4 grid gap-4">
                <InlineInfo
                  title="Opsiyonel alanlar"
                  desc={
                    <>
                      Bu bölüm ileri seviye kısıtlar içindir. Değerler genellikle <span className="font-medium">0 = sınırsız</span> şeklinde çalışır.
                      Değişiklik yapmadan önce etkisini doğrulayın.
                    </>
                  }
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-violet-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
                    <div className="text-sm font-semibold text-zinc-900">Grace Mode</div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-violet-200/70 bg-white/85 p-3 shadow-sm">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">Grace affects worked</div>
                        <div className="text-xs text-zinc-500">
                          Açıksa grace süreleri worked’a “ücretli” olarak yansıyabilir.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={graceAffectsWorked}
                        onChange={(e) => setGraceAffectsWorked(e.target.checked)}
                        className="h-4 w-4"
                        disabled={saving || readOnly}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,249,255,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
                    <div className="text-sm font-semibold text-zinc-900">Exit & Break</div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-sky-200/70 bg-white/85 p-3 shadow-sm">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">Exit consumes break</div>
                        <div className="text-xs text-zinc-500">
                          Çıkış/pause sürelerini break’e sayar (break tüketimi).
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={exitConsumesBreak}
                        onChange={(e) => setExitConsumesBreak(e.target.checked)}
                        className="h-4 w-4"
                        disabled={saving || readOnly}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="rounded-2xl border border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(238,242,255,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
                  <div className="text-sm font-semibold text-zinc-900">Attendance Ownership</div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Gece vardiyası, vardiya geçişi ve boundary event senaryolarında bir olayın sonraki vardiyaya
                    ne kadar erken aday olacağını belirler.
                  </div>

                  <div className="mt-3 grid gap-4">
                    <FieldShell
                      label="Next Shift Lookahead (minutes)"
                      hint="Sonraki vardiya başlangıcından kaç dakika önce ownership adaylığı başlasın? 0: kapalı / sadece normal erken giriş toleransı."
                    >
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-indigo-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={ownershipNextShiftLookaheadMinutes}
                        onChange={(e) => setOwnershipNextShiftLookaheadMinutes(e.target.value)}
                        placeholder="Örn: 90"
                        disabled={saving || readOnly}
                      />
                    </FieldShell>
                    <div className="text-[11px] text-zinc-500">
                      Bu alan sadece ownership kararını etkiler. Shift saati, worked veya OT kuralı değildir.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label="Max single exit minutes" hint="Tek bir çıkış/pause için üst limit. 0: sınırsız (mevcut davranış).">
                    <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                      type="number"
                      value={maxSingleExitMinutes}
                      onChange={(e) => setMaxSingleExitMinutes(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </FieldShell>
                  <FieldShell label="Max daily exit minutes" hint="Gün toplam çıkış/pause için üst limit. 0: sınırsız (mevcut davranış).">
                    <input
                    className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                      type="number"
                      value={maxDailyExitMinutes}
                      onChange={(e) => setMaxDailyExitMinutes(e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </FieldShell>
                </div>

                <FieldShell label="Exit exceed action" hint="Limit aşılırsa üretilecek davranış/anomali.">
                  <select
                    className="h-10 w-full min-w-0 rounded-2xl border border-sky-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={exitExceedAction}
                    onChange={(e) => setExitExceedAction(e.target.value as any)}
                    disabled={saving || readOnly}
                  >
                    <option value="">-- None --</option>
                    <option value="IGNORE">IGNORE (yok say)</option>
                    <option value="WARN">WARN (uyarı üret)</option>
                    <option value="FLAG">FLAG (anomali üret)</option>
                  </select>
                </FieldShell>
                {/* Enterprise: Overtime Dynamic Break */}
                <div className="grid gap-4 rounded-2xl border border-emerald-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.92)_100%)] p-4 shadow-sm ring-1 ring-white/70">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">Overtime Dynamic Break</div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Fazla mesai dakikası hesaplandıktan sonra, tanımlı periyotlarda otomatik mola düşer.
                        <span className="ml-1">(Örn: her 180 dk OT&apos;de 30 dk mola)</span>
                      </div>
                    </div>
                    <span
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[11px]",
                        overtimeEnabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600"
                      )}
                    >
                      {overtimeEnabled ? "OT Açık" : "OT Kapalı"}
                    </span>
                  </div>

                  <InlineInfo
                    title="Nasıl çalışır?"
                    desc={
                      <>
                        Formül: <span className="font-medium">OT -= floor(OT / Interval) × Duration</span>. Sonuç 0 altına düşmez.
                        Boş bırakırsanız kural devre dışı kalır.
                      </>
                    }
                  />

                  <div className={cx("grid gap-4 md:grid-cols-2", (!overtimeEnabled || readOnly) && "opacity-70")}>
                    <FieldShell
                      label="OT Break Interval (minutes)"
                      hint="Kaç dakikalık fazla mesai sonunda bir mola tetiklensin? (boş: kapalı)"
                    >
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-emerald-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={otBreakInterval}
                        onChange={(e) => setOtBreakInterval(e.target.value)}
                        placeholder="Örn: 180"
                        disabled={!overtimeEnabled || saving || readOnly}
                      />
                    </FieldShell>

                    <FieldShell
                      label="OT Break Duration (minutes)"
                      hint="Tetiklenen mola süresi kaç dakika? (boş: kapalı)"
                    >
                      <input
                        className="h-10 w-full min-w-0 rounded-2xl border border-emerald-200/70 bg-white/95 px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={otBreakDuration}
                        onChange={(e) => setOtBreakDuration(e.target.value)}
                        placeholder="Örn: 30"
                        disabled={!overtimeEnabled || saving || readOnly}
                      />
                    </FieldShell>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Inline save (secondary) */}
        <div className="mt-5 flex items-center justify-end gap-2 rounded-2xl border border-zinc-300/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,247,255,0.86)_100%)] px-4 py-3 shadow-sm ring-1 ring-white/70">
          <div className="mr-auto text-[11px] text-zinc-500">
            Not: “Policy Kaydet” sadece policy alanlarında değişiklik varsa aktif olur.
          </div>
          <Button
            variant="primary"
            disabled={!canSave || saving || !dirtyPolicy}
            onClick={() => {
              if (readOnly) return showReadOnlyNotice();
              savePolicy();
            }}
            className="h-10 text-sm"
          >
            <Icon>{Icons.Save}</Icon>
            {saving ? "Kaydediliyor..." : "Policy Kaydet"}
          </Button>
        </div>
      </section>

        </main>
      </div>

      {/* Sticky Save Bar */}
      {mounted &&
        createPortal(
          <div
            className={cx(
              "fixed inset-x-0 bottom-3 z-[90] sm:bottom-4",
              (!readOnly && (showSaveBar || justSaved)) ? "" : "hidden"
            )}
          >
            <div className="pointer-events-none px-2 sm:px-3">
              <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-2xl sm:rounded-3xl border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(244,247,255,0.90)_100%)] px-3 py-2.5 sm:p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ring-1 ring-white/75 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {showSaveBar ? (
                      <div className="flex min-w-0 items-start gap-2 sm:items-center">
                        <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:mt-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-5 text-zinc-900">
                            Kaydedilmemiş değişiklikler
                          </div>
                          <div className="text-[11px] leading-5 text-zinc-500">
                            {dirtyCompany && dirtyPolicy ? "Firma + Policy" : dirtyCompany ? "Firma" : "Policy"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-start gap-2 sm:items-center">
                        <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 sm:mt-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-5 text-zinc-900">Kaydedildi</div>
                          <div className="text-[11px] leading-5 text-zinc-500">
                            Değişiklikler başarıyla kaydedildi.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
                    {showSaveBar ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={revertToSaved}
                          disabled={saving}
                          className="h-10 w-full text-sm sm:w-auto"
                        >
                          <Icon>{Icons.Refresh}</Icon>
                          Vazgeç (Yenile)
                        </Button>
                        <Button
                          variant="primary"
                          onClick={async () => {
                            if (dirtyCompany) await saveCompany();
                            if (dirtyPolicy) await savePolicy();
                          }}
                          disabled={!canSave || saving}
                          className="h-10 w-full text-sm sm:w-auto"
                        >
                          <Icon>{Icons.Save}</Icon>
                          {saving ? "Kaydediliyor..." : "Hepsini Kaydet"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => setJustSaved(false)}
                        className="h-10 w-full text-sm sm:w-auto"
                      >
                        Kapat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
