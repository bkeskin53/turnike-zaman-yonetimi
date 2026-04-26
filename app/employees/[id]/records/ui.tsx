/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import EmployeeDetailSubnav from "../_components/EmployeeDetailSubnav";
import { employeeCardScopeTerms, trEmployeeScopeActionType, trEmployeeScopeApiError } from "@/src/features/employees/cardScopeTerminology";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function anomalyLabelTR(code: string): string {
  switch (String(code ?? "").trim()) {
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT tamamlanmamış)";
    case "NO_PLAN":
      return "Plan yok (referans vardiya bulunamadı)";
    case "LATE_OUT_CAPTURED":
      return "Geç OUT yakalandı (ertesi güne sarkan çıkış bugünü kapattı)";
    default:
      return code;
  }
}

function trPolicySourceTR(src: string | null | undefined): string {
  const v = String(src ?? "").trim();
  switch (v) {
    case "EMPLOYEE":
      return "Personel Ataması";
    case "EMPLOYEE_SUBGROUP":
      return "Alt Segment";
    case "EMPLOYEE_GROUP":
      return "Üst Segment";
    case "BRANCH":
      return "Şube";
    case "COMPANY_POLICY":
      return "Şirket Varsayılanı";
    case "DEFAULT":
      return "Şirket Varsayılanı";
    default:
      return v || "—";
  }
}

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
      return v || "—";
  }
}

function hhmmFromTimeStr(v: string | null | undefined): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  // "09:00:00" -> "09:00"
  const m = s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : s;
}

function shiftHoursFromTemplate(st: { startTime?: string; endTime?: string } | null | undefined): string {
  if (!st) return "—";
  const a = hhmmFromTimeStr((st as any).startTime);
  const b = hhmmFromTimeStr((st as any).endTime);
  if (a === "—" || b === "—") return "—";
  return `${a}–${b}`;
}

function hhmmFromMinute(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateTimeLocalForZone(dt: DateTime): string {
  return `${dt.year}-${pad2(dt.month)}-${pad2(dt.day)}T${pad2(dt.hour)}:${pad2(dt.minute)}`;
}

function currentDayKeyForTimezone(timezone: string): string {
  const dt = DateTime.now().setZone(timezone || "Europe/Istanbul");
  if (!dt.isValid) {
    return DateTime.now().setZone("Europe/Istanbul").toFormat("yyyy-MM-dd");
  }
  return dt.toFormat("yyyy-MM-dd");
}

function nowLocalInputValueForPolicyTimezone(policyTimezone: string): string {
  const dt = DateTime.now().setZone(policyTimezone || "Europe/Istanbul");
  if (!dt.isValid) {
    return formatDateTimeLocalForZone(DateTime.now().setZone("Europe/Istanbul"));
  }
  return formatDateTimeLocalForZone(dt);
}

function weekStartFromISODate(isoDayKey: string, timezone: string): string {
  const dt = DateTime.fromISO(isoDayKey, { zone: timezone || "Europe/Istanbul" });
  if (!dt.isValid) return isoDayKey;
  return dt.startOf("week").toFormat("yyyy-MM-dd");
}

function addDaysISO(iso: string, days: number, timezone: string): string {
  const dt = DateTime.fromISO(iso, { zone: timezone || "Europe/Istanbul" });
  if (!dt.isValid) return iso;
  return dt.plus({ days }).toFormat("yyyy-MM-dd");
}

function formatDateTimeInZone(dt: any, timezone: string): string {
  if (!dt) return "";
  const parsed = typeof dt === "string"
    ? DateTime.fromISO(dt, { setZone: true })
    : DateTime.fromJSDate(new Date(dt), { zone: "utc" });

  if (!parsed.isValid) return String(dt);

  const zoned = parsed.setZone(timezone || "Europe/Istanbul");
  if (!zoned.isValid) return String(dt);

  return zoned.toFormat("dd.MM.yyyy HH:mm:ss");
}

function localPolicyDateTimeToUtcIso(local: string, policyTimezone: string): string {
  const dt = DateTime.fromFormat(local, "yyyy-MM-dd'T'HH:mm", {
    zone: policyTimezone || "Europe/Istanbul",
  });
  if (!dt.isValid) {
    throw new Error("INVALID_LOCAL_DATETIME");
  }
  const iso = dt.toUTC().toISO({ suppressMilliseconds: true, includeOffset: true });
  if (!iso) {
    throw new Error("INVALID_LOCAL_DATETIME");
  }
  return iso;
}

function fmtShift(daily: any): string {
  if (!daily) return "—";
  // En okunur: shiftBadge (genelde "09:00–18:00" gibi)
  if (daily.shiftBadge) return String(daily.shiftBadge);
  // Sonra signature
  if (daily.shiftSignature) return String(daily.shiftSignature);
  // Pencere varsa onu formatla
  if (daily.shiftWindowStart && daily.shiftWindowEnd) {
    return `${formatDateTimeInZone(daily.shiftWindowStart, daily?.shiftTimezone || "Europe/Istanbul")} → ${formatDateTimeInZone(daily.shiftWindowEnd, daily?.shiftTimezone || "Europe/Istanbul")}`;
  }
  return "—";
}

function fmtResolvedShift(shift: MasterTodayShift | null | undefined): string {
  if (!shift) return "—";
  if (shift.isOffDay) return "OFF";

  const sig = shift.signature;
  if (!sig) return "—";

  if (sig.signature) return String(sig.signature);
  if (sig.startTime && sig.endTime) return `${sig.startTime}–${sig.endTime}`;
  return "—";
}

function weekPlanSummaryTR(
  weeklyPlan: WeeklyPlanItem | null,
  loadingWeeklyPlan: boolean,
): string {
  if (loadingWeeklyPlan) return "Yükleniyor…";
  return weeklyPlan ? "Bu hafta weekly plan kaydı var" : "Bu hafta weekly plan kaydı yok";
}

function isSameIsoDay(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function sourceTone(
  src: string | null | undefined,
): "neutral" | "info" | "ok" | "warn" | "violet" {
  switch (String(src ?? "").trim()) {
    case "DAY_TEMPLATE":
      return "violet";
    case "WEEK_TEMPLATE":
      return "info";
    case "WORK_SCHEDULE":
      return "ok";
    case "POLICY":
      return "warn";
    case "CUSTOM":
      return "neutral";
    default:
      return "neutral";
  }
}

function policySourceTone(
  src: string | null | undefined,
): "neutral" | "info" | "ok" | "warn" | "violet" {
  switch (String(src ?? "").trim()) {
    case "EMPLOYEE":
      return "violet";
    case "EMPLOYEE_SUBGROUP":
      return "info";
    case "EMPLOYEE_GROUP":
      return "info";
    case "BRANCH":
      return "ok";
    case "COMPANY_POLICY":
    case "DEFAULT":
      return "warn";
    default:
      return "neutral";
  }
}

function ShiftSourceBadge({ source }: { source: string | null | undefined }) {
  return (
    <Badge tone={sourceTone(source)}>
      {trShiftSourceTR(source)}
    </Badge>
  );
}

function PolicySourceBadge({ source }: { source: string | null | undefined }) {
  return (
    <Badge tone={policySourceTone(source)}>
      {trPolicySourceTR(source)}
    </Badge>
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
        "relative overflow-hidden rounded-xl bg-slate-200/80",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

function SkeletonPill({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-full bg-slate-200/80",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

function SkeletonFieldRow() {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl px-3 py-2">
      <div className="grid gap-2">
        <SkeletonLine className="h-3 w-20" />
      </div>
      <div className="grid justify-items-end gap-2">
        <SkeletonLine className="h-4 w-28" />
        <SkeletonLine className="h-3 w-40" />
      </div>
    </div>
  );
}

function SkeletonMetricCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl border px-3 py-3", className)}>
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="mt-3 h-7 w-16" />
    </div>
  );
}

function SkeletonTableRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 px-3 py-3">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-16" />
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function Card({
  title,
  description,
  right,
  children,
  className,
  tone = "slate",
  loading = false,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: "slate" | "indigo" | "sky" | "violet" | "amber" | "emerald" | "rose";
  loading?: boolean;
}) {
  const headerTone =
    tone === "indigo"
      ? "from-indigo-100/90 via-white to-sky-100/80"
      : tone === "sky"
        ? "from-sky-100/90 via-white to-cyan-100/80"
        : tone === "violet"
          ? "from-violet-100/90 via-white to-fuchsia-100/80"
          : tone === "amber"
            ? "from-amber-100/90 via-white to-orange-100/80"
            : tone === "emerald"
              ? "from-emerald-100/90 via-white to-teal-100/80"
              : tone === "rose"
                ? "from-rose-100/90 via-white to-red-100/80"
                : "from-slate-100/90 via-white to-slate-50/80";
  return (
    <section
      className={cx(
        "rounded-3xl border min-w-0 max-w-full overflow-hidden",
        "border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40",
        "shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div
        className={cx(
          "flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 min-w-0 max-w-full backdrop-blur-sm",
          "bg-gradient-to-r",
          headerTone,
        )}
      >
        <div className="min-w-0 max-w-full">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {loading ? (
          <div className="shrink-0">
            <SkeletonPill className="h-8 w-28" />
          </div>
        ) : right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-4 min-w-0 max-w-full">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">{children}</span>;
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold text-slate-900">{children}</span>;
}

function FieldRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-6 rounded-2xl px-3 py-2 transition-colors hover:bg-white/70", className)}>
      <Label>{label}</Label>
      <div className="text-right min-w-0">
        <Value>{value}</Value>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3.5 py-2.5 text-sm font-semibold " +
    "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-[0_10px_24px_rgba(49,46,129,0.28)] hover:translate-y-[-1px] hover:shadow-[0_14px_28px_rgba(49,46,129,0.34)]"
      : variant === "secondary"
        ? "border border-slate-200 bg-gradient-to-b from-white to-slate-100 text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:bg-slate-50"
        : variant === "danger"
          ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.22)] hover:translate-y-[-1px] hover:shadow-[0_14px_28px_rgba(225,29,72,0.28)]"
          : "bg-transparent text-slate-700 hover:bg-white/80";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
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
        "h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]",
        "placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100",
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
        "h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]",
        "focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100",
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
  tone?: "info" | "warn" | "ok" | "neutral" | "violet";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200/80"
      : tone === "neutral"
        ? "bg-slate-100 text-slate-700 ring-slate-200"
        : tone === "violet"
          ? "bg-violet-100 text-violet-800 ring-violet-200/80"
        : tone === "warn"
          ? "bg-amber-100 text-amber-900 ring-amber-200/80"
          : "bg-sky-100 text-sky-800 ring-sky-200/80";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        cls,
      )}
    >
      {children}
    </span>
  );
}

// Types for API data
type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

type OrgRef = { id: string; code: string; name: string } | null;
type MasterEmployeeLite = {
  branch?: OrgRef;
  employeeGroup?: OrgRef;
  employeeSubgroup?: OrgRef;
};

type PolicyRuleSetLite = {
  id: string;
  code: string;
  name: string;
};

type MasterTodayShift = {
  source: "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM" | "WORK_SCHEDULE";
  shiftCode?: string | null;
  shiftTemplateId?: string | null;
  isOffDay?: boolean;
  signature: {
    startTime: string;
    endTime: string;
    spansMidnight: boolean;
    signature: string;
  };
};

type MasterTodayLite = {
  dayKey: string;
  shift: MasterTodayShift | null;
  policyRuleSet?: {
    source?: string | null;
    assignmentId?: string | null;
    ruleSet?: PolicyRuleSetLite | null;
  } | null;
};

type EmploymentPeriod = {
  id: string;
  startDate: string; // ISO
  endDate: string | null; // ISO
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

type AppliedPolicyState = {
  source: string;
  ruleSet: PolicyRuleSetLite | null;
} | null;

type EmployeeAction = {
  id: string;
  type: string;
  effectiveDate: string; // ISO
  note: string | null;
  actorUserId: string | null;
  createdAt: string; // ISO
  details: any; // JSON
};

function trActionType(t: string): string {
  return trEmployeeScopeActionType(t);
}

function maskId(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

type DailyItem =
  | {
      id: string;
      employeeId: string;
      firstIn: string | null;
      lastOut: string | null;
      workedMinutes: number;
      overtimeMinutes: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      status: string;
      anomalies: string[];

      // Context (UX clarity for night shifts)
      dayKey?: string;
      shiftTimezone?: string;
      shiftWindowStart?: string;
      shiftWindowEnd?: string;
      shiftStartMinute?: number;
      shiftEndMinute?: number;
      shiftSpansMidnight?: boolean;

      // UI-only shift source visibility
      shiftSource?: "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM" | "WORK_SCHEDULE";
      shiftSignature?: string;
      shiftBadge?: string;
    }
  | null;

type RawEvent = {
  id: string;
  employeeId: string;
  occurredAt: string;
  direction: string;
  source: string;
  door: { id: string; code: string; name: string } | null;
  device: { id: string; name: string; ip: string | null } | null;
};

type NormalizedEvent = {
  id: string;
  rawEventId: string;
  occurredAt: string;
  direction: string;
  status: string;
  rejectReason: string | null;
};

type Door = {
  id: string;
  code: string;
  name: string;
  defaultDirection: string | null;
};

type ShiftTemplateLite = {
  id: string;
  shiftCode: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
};

type WeeklyPlanItem = {
  employeeId: string;
  weekStart: string; // YYYY-MM-DD
  shiftTemplateId: string | null; // week default
  dayTemplateIds: Array<string | null>; // length 7 (Mon..Sun)
  startMinutes: Array<number | null>; // length 7
  endMinutes: Array<number | null>; // length 7
};

function normalizeAppliedPolicy(input: any): AppliedPolicyState {
  if (!input) return null;
  return {
    source: String(input?.source ?? "DEFAULT"),
    ruleSet: input?.ruleSet
      ? {
          id: String(input.ruleSet.id),
          code: String(input.ruleSet.code),
          name: String(input.ruleSet.name),
        }
      : null,
  };
}

export default function EmployeeRecordsClient({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [orgLite, setOrgLite] = useState<MasterEmployeeLite | null>(null);
  const [policyTimezone, setPolicyTimezone] = useState<string>("Europe/Istanbul");
  const [masterToday, setMasterToday] = useState<MasterTodayLite | null>(null);
  const [employmentPeriods, setEmploymentPeriods] = useState<EmploymentPeriod[]>([]);
  const [actions, setActions] = useState<EmployeeAction[]>([]);
  const [date, setDate] = useState(() => currentDayKeyForTimezone("Europe/Istanbul"));
  const [daily, setDaily] = useState<DailyItem>(null);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [normEvents, setNormEvents] = useState<NormalizedEvent[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [savingAction, setSavingAction] = useState<"TERMINATE" | "REHIRE" | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateEndDate, setTerminateEndDate] = useState(""); // YYYY-MM-DD
  const [terminateReason, setTerminateReason] = useState("");

  const [showRehire, setShowRehire] = useState(false);
  const [rehireStartDate, setRehireStartDate] = useState(""); // YYYY-MM-DD
  const [rehireReason, setRehireReason] = useState("");

  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual event form state
  const [manualDateTime, setManualDateTime] = useState("");
  const [manualDirection, setManualDirection] = useState<"IN" | "OUT">(
    "IN",
  );
  const [manualDoorId, setManualDoorId] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Weekly plan visibility (UI-only)
  const [weekStart, setWeekStart] = useState<string>("");
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanItem | null>(null);
  const [loadingWeeklyPlan, setLoadingWeeklyPlan] = useState(false);
  const [shiftTemplateMap, setShiftTemplateMap] = useState<Record<string, ShiftTemplateLite>>({});
  // "Plan yoksa bile" 7 günün vardiya saatini göstermek için daily fallback
  const [weekResolvedMap, setWeekResolvedMap] = useState<Record<string, any>>({});
  const [loadingWeekResolved, setLoadingWeekResolved] = useState(false);

  const [policyRuleSets, setPolicyRuleSets] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [appliedPolicy, setAppliedPolicy] = useState<AppliedPolicyState>(null);
  const [selectedPolicyRuleSetId, setSelectedPolicyRuleSetId] = useState<string>("DEFAULT");
  const [savingPolicyAssign, setSavingPolicyAssign] = useState(false);
  const [policyAssignments, setPolicyAssignments] = useState<Array<any>>([]);
  const [policyValidFrom, setPolicyValidFrom] = useState<string>("");
  const [policyValidTo, setPolicyValidTo] = useState<string>("");
  const [policyPriority, setPolicyPriority] = useState<number>(100);

  // Manual daily adjustment form state. Empty string means no override.
  const [adjustment, setAdjustment] = useState({
    statusOverride: "",
    workedMinutesOverride: "",
    overtimeMinutesOverride: "",
    overtimeEarlyMinutesOverride: "",
    overtimeLateMinutesOverride: "",
    lateMinutesOverride: "",
    earlyLeaveMinutesOverride: "",
    note: "",
  });
  const [otSplitMode, setOtSplitMode] = useState(false);
  const [loadingAdjustment, setLoadingAdjustment] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const safeId = useMemo(() => {
    return String(id ?? "").trim();
  }, [id]);

  async function loadCompanyPolicyTimezone() {
    try {
      const res = await fetch(`/api/company`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const tz = String(json?.policy?.timezone ?? "").trim();
      if (tz) {
        setPolicyTimezone(tz);
      }
    } catch {
      // ignore; deterministic fallback remains Europe/Istanbul
    }
  }

  function fmt(dt: any, timezone = policyTimezone) {
    return formatDateTimeInZone(dt, timezone);
  }

  // Compute full name for display
  const fullName = useMemo(() => {
    if (!employee) return "";
    return `${employee.firstName} ${employee.lastName}`.trim();
  }, [employee]);
  
  const canTerminate = useMemo(() => {
    // Employment aktifken terminate yapılabilir.
    // employee.isActive burada "employment aktif mi" olarak türetiliyor (period + todayKey mantığı).
    return !!employee?.isActive;
  }, [employee?.isActive]);

  const canRehire = useMemo(() => {
    // Employment kapalıyken rehire yapılabilir.
    return employee ? !employee.isActive : false;
  }, [employee]);

  const isViewingToday = useMemo(() => {
    return isSameIsoDay(date, masterToday?.dayKey);
  }, [date, masterToday?.dayKey]);

  async function loadShiftTemplates() {
    try {
      const res = await fetch(`/api/shift-templates?includeInactive=1`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      const items: ShiftTemplateLite[] = Array.isArray(json?.items) ? json.items : [];
      const map: Record<string, ShiftTemplateLite> = {};
      for (const st of items) {
        if (st?.id) map[st.id] = st;
      }
      setShiftTemplateMap(map);
    } catch {
      // ignore
    }
  }

  async function loadWeeklyPlanForWeek(start: string) {
    if (!safeId || !start) return;
    setLoadingWeeklyPlan(true);
    try {
      const res = await fetch(
        `/api/employees/${safeId}/weekly-plan?weekStart=${encodeURIComponent(start)}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setWeeklyPlan(null);
        return;
      }
      const json = await res.json();
      setWeeklyPlan((json?.item ?? null) as WeeklyPlanItem | null);
    } catch {
      setWeeklyPlan(null);
    } finally {
      setLoadingWeeklyPlan(false);
    }
  }

  async function loadWeekResolvedShifts(start: string) {
    if (!safeId || !start) return;
    setLoadingWeekResolved(true);
    try {
      const res = await fetch(
        `/api/employees/${safeId}/week-resolved-shifts?weekStart=${encodeURIComponent(start)}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setWeekResolvedMap({});
        return;
      }
      const json = await res.json().catch(() => null);
      const days: any[] = Array.isArray(json?.item?.days) ? json.item.days : [];
      const map: Record<string, any> = {};
      for (const d of days) {
        if (d?.dayKey) map[String(d.dayKey).slice(0, 10)] = d;
      }
      setWeekResolvedMap(map);
    } finally {
      setLoadingWeekResolved(false);
    }
  }

  async function loadMasterHeader() {
    if (!safeId) return;
    try {
      const mRes = await fetch(`/api/employees/${safeId}/master`, { credentials: "include" });
      if (!mRes.ok) return;

      const mJson = await mRes.json();
      const emp = (mJson?.item?.employee ?? null) as any;
      const today = (mJson?.item?.today ?? null) as MasterTodayLite | null;

      if (emp) {
        setOrgLite({
          branch: emp.branch ?? null,
          employeeGroup: emp.employeeGroup ?? null,
          employeeSubgroup: emp.employeeSubgroup ?? null,
        });
      } else {
        setOrgLite(null);
      }

      setMasterToday(today);

      const todayShiftTz = String((today as any)?.shift?.signature?.timezone ?? "").trim();
      const resolvedTz = String((mJson?.policy?.timezone ?? todayShiftTz ?? policyTimezone) || "Europe/Istanbul").trim();
      if (resolvedTz) setPolicyTimezone(resolvedTz);

      const normalizedTodayPolicy = normalizeAppliedPolicy(today?.policyRuleSet ?? null);
      if (normalizedTodayPolicy) {
        setAppliedPolicy(normalizedTodayPolicy);
      }

      const todayKey = String(mJson?.item?.today?.dayKey ?? "").slice(0, 10);
      if (todayKey) {
        const ws = weekStartFromISODate(todayKey, resolvedTz || policyTimezone);
        setWeekStart(ws);
        await loadWeeklyPlanForWeek(ws);
      } else {
        const dk = currentDayKeyForTimezone(resolvedTz || policyTimezone);
        const ws = weekStartFromISODate(dk, resolvedTz || policyTimezone);
        setWeekStart(ws);
        await loadWeeklyPlanForWeek(ws);
      }
    } catch {
      // master header errors should not break page
    }
  }

  function syncAppliedPolicyForSelectedDate(selectedDate: string, payload: any) {
    const normalized = normalizeAppliedPolicy(payload);
    // Üst kart "bugün" semantiği taşır; selected date = bugün değilse üst özeti ezmeyiz.
    if (selectedDate !== masterToday?.dayKey) {
      setAppliedPolicy(normalized);
      return;
    }
    if (!masterToday?.policyRuleSet) setAppliedPolicy(normalized);
  }

  function resolvePlanDayLabel(i: number): { label: string; sub: string } {
    // i: 0..6 (Mon..Sun)
    const dayKey = weekStart ? addDaysISO(weekStart, i, policyTimezone) : "";
    const resolvedFallback = dayKey ? weekResolvedMap[dayKey] : null;

    // 1) Weekly plan varsa: günlük/özel/haftalık öncelik
    if (weeklyPlan) {
      const dayTplId = weeklyPlan.dayTemplateIds?.[i] ?? null;
      const sm = weeklyPlan.startMinutes?.[i] ?? null;
      const em = weeklyPlan.endMinutes?.[i] ?? null;
      const weekTplId = weeklyPlan.shiftTemplateId ?? null;

      if (dayTplId && shiftTemplateMap[dayTplId]) {
        const st = shiftTemplateMap[dayTplId];
        return { label: shiftHoursFromTemplate(st), sub: "Günlük" };
      }
      if (typeof sm === "number" && typeof em === "number") {
        return { label: `${hhmmFromMinute(sm)}–${hhmmFromMinute(em)}`, sub: "Özel" };
     }
      if (weekTplId && shiftTemplateMap[weekTplId]) {
        const st = shiftTemplateMap[weekTplId];
        return { label: shiftHoursFromTemplate(st), sub: "Haftalık" };
      }
      // plan var ama boşsa fallback daily ile doldur
    }

    // 2) Plan yoksa (veya boşsa): sistemin ürettiği vardiya (policy/rota/default) saatini göster
    const lbl = resolvedFallback?.shiftBadge ? String(resolvedFallback.shiftBadge) : "—";
    const src = resolvedFallback?.shiftSource ? trShiftSourceTR(resolvedFallback.shiftSource) : "Sistem";
    return { label: lbl, sub: src || "Sistem" };
  }

  // (resolvePlanDayLabel) yukarıda yeniden tanımlandı: plan olsa da olmasa da saat gösterir.

  // Load employee details
  async function loadEmployee() {
    setLoadingEmployee(true);
    setError(null);
    try {
      setMasterToday(null);
      setEmploymentPeriods([]);
      setOrgLite(null);

      const res = await fetch(`/api/employees/${safeId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to load employee");
      }
      const data = await res.json();
      setEmployee(data.item ?? null);
      const eps = Array.isArray(data?.employmentPeriods)
        ? data.employmentPeriods
        : Array.isArray(data?.item?.employmentPeriods)
          ? data.item.employmentPeriods
          : [];
      setEmploymentPeriods(eps);

      const acts = Array.isArray(data?.actions)
        ? data.actions
        : Array.isArray(data?.item?.actions)
          ? data.item.actions
          : [];
      setActions(acts);

      // Org bilgiler (Şube / Üst Grup / Alt Grup) master endpoint'inde var.
      // Üst kart için tek gerçek kaynak master endpoint olsun.
      try {
        await loadMasterHeader();
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message ?? "Employee load failed");
      setEmployee(null);
      setEmploymentPeriods([]);
      setActions([]);
      setAppliedPolicy(null);
      setMasterToday(null);
      setOrgLite(null);
    } finally {
      setLoadingEmployee(false);
    }
  }

  function flash(kind: "success" | "error" | "info", text: string, ms = 2600) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

  function trApiError(code: string): string {
    const v = String(code ?? "").trim();
    return trEmployeeScopeApiError(v);
  }

  async function doTerminate() {
    if (!employee) return;
    setSavingAction("TERMINATE");
    try {
      const res = await fetch(`/api/employees/${employee.id}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endDate: terminateEndDate || undefined,
          reason: terminateReason || undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        flash("error", trApiError(json?.error ?? "server_error"));
        return;
      }

      flash("success", `${employeeCardScopeTerms.terminateSuccessPrefix} (Bitiş: ${json?.endDate ?? "—"})`);
      setShowTerminate(false);
      setTerminateEndDate("");
      setTerminateReason("");
      await loadEmployee();
    } finally {
      setSavingAction(null);
    }
  }

  async function doRehire() {
    if (!employee) return;
    setSavingAction("REHIRE");
    try {
      const res = await fetch(`/api/employees/${employee.id}/rehire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startDate: rehireStartDate || undefined,
          reason: rehireReason || undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        flash("error", trApiError(json?.error ?? "server_error"));
        return;
      }

      flash("success", `${employeeCardScopeTerms.rehireSuccessPrefix} (Başlangıç: ${json?.startDate ?? "—"})`);
      setShowRehire(false);
      setRehireStartDate("");
      setRehireReason("");
      await loadEmployee();
    } finally {
      setSavingAction(null);
    }
  }

  // Load list of doors for manual event
  async function loadDoors() {
    try {
      const res = await fetch(`/api/org/doors`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const arr: Door[] = Array.isArray(data) ? data : data.items ?? [];
      setDoors(arr);
    } catch {
      // ignore door errors
    }
  }

  async function loadPolicyMeta() {
    if (!safeId) return;
    try {
      // rule sets
      const rsRes = await fetch(`/api/policy/rule-sets`, { credentials: "include" });
      if (rsRes.ok) {
        const rsJson = await rsRes.json();
        const items = Array.isArray(rsJson?.items) ? rsJson.items : [];
        setPolicyRuleSets(items);
      }

      // applied
      const apRes = await fetch(`/api/employees/${safeId}/policy?date=${encodeURIComponent(date)}`, { credentials: "include" });
      if (apRes.ok) {
        const apJson = await apRes.json();
        syncAppliedPolicyForSelectedDate(date, apJson);
        // dropdown default
        if (apJson?.ruleSet?.id) setSelectedPolicyRuleSetId(apJson.ruleSet.id);
        else setSelectedPolicyRuleSetId("DEFAULT");
      } else {
        syncAppliedPolicyForSelectedDate(date, null);
        setSelectedPolicyRuleSetId("DEFAULT");
      }
    } catch {
      // ignore policy meta errors (UI-only)
    }
  }

  async function loadPolicyAssignments() {
    if (!safeId) return;
    try {
      const res = await fetch(`/api/employees/${safeId}/policy-assignments`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setPolicyAssignments(Array.isArray(json?.items) ? json.items : []);
    } catch {
      // ignore
    }
  }

  async function savePolicyAssignment() {
    if (!safeId || savingPolicyAssign) return;
    setSavingPolicyAssign(true);
    try {
      if (selectedPolicyRuleSetId === "DEFAULT") {
        const res = await fetch(`/api/policy/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ employeeId: safeId, clear: true }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          flash("error", trApiError(json?.error ?? "server_error"));
          return;
        }
        flash("success", "Policy ataması kaldırıldı. (DEFAULT)");
      } else {
        const res = await fetch(`/api/policy/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            employeeId: safeId,
            ruleSetId: selectedPolicyRuleSetId,
            validFromDayKey: policyValidFrom || null,
            validToDayKey: policyValidTo || null,
            priority: policyPriority,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          flash("error", trApiError(json?.error ?? "server_error"));
          return;
        }
        const rs = policyRuleSets.find((x) => x.id === selectedPolicyRuleSetId);
        flash("success", `Policy atandı: ${rs?.code ?? "—"} (${rs?.name ?? "—"})`);
      }

      // recompute + refresh
      await recompute();
      await loadMasterHeader();
      await loadPolicyMeta();
      await loadPolicyAssignments();
      await loadDailyRawNorm();
    } finally {
      setSavingPolicyAssign(false);
    }
  }

  // Load daily summary, raw events, and normalized events
  async function loadDailyRawNorm() {
    if (!safeId) return;
    setLoadingData(true);
    setError(null);
    try {
      // Daily attendance
      const dRes = await fetch(
        `/api/employees/${safeId}/daily?date=${encodeURIComponent(date)}`,
        { credentials: "include" },
      );
      if (dRes.ok) {
        const dJson = await dRes.json();
        setDaily(dJson.item ?? null);
      } else if (dRes.status === 404) {
        setDaily(null);
      } else {
        const txt = await dRes.text().catch(() => dRes.statusText);
        throw new Error(txt || "Failed to load daily");
      }

      // Raw events
      const rRes = await fetch(
        `/api/events?${new URLSearchParams({
          employeeId: safeId,
          date,
        }).toString()}`,
        { credentials: "include" },
      );
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRawEvents(rJson.items ?? []);
      } else {
        const txt = await rRes.text().catch(() => rRes.statusText);
        throw new Error(txt || "Failed to load events");
      }

      // Normalized events
      const nRes = await fetch(
        `/api/employees/${safeId}/normalized-events?${new URLSearchParams({
          date,
        }).toString()}`,
        { credentials: "include" },
      );
      if (nRes.ok) {
        const nJson = await nRes.json();
        setNormEvents(nJson.items ?? []);
      } else if (nRes.status === 404) {
        setNormEvents([]);
      } else {
        const txt = await nRes.text().catch(() => nRes.statusText);
        throw new Error(txt || "Failed to load normalized events");
      }
    } catch (e: any) {
      setError(e?.message ?? "Data load failed");
    } finally {
      setLoadingData(false);
    }
  }

  // Load existing manual adjustment for the selected employee and date.
  async function loadAdjustment() {
    if (!safeId || !date) return;
    setLoadingAdjustment(true);
    try {
      const res = await fetch(
        `/api/employees/${safeId}/daily-adjustment?date=${encodeURIComponent(date)}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.item ?? null;
        if (item) {
          setAdjustment({
            statusOverride: item.statusOverride ?? "",
            workedMinutesOverride:
              item.workedMinutesOverride != null
                ? String(item.workedMinutesOverride)
                : "",
            overtimeMinutesOverride:
              item.overtimeMinutesOverride != null
                ? String(item.overtimeMinutesOverride)
                : "",
                overtimeEarlyMinutesOverride:
              item.overtimeEarlyMinutesOverride != null
                ? String(item.overtimeEarlyMinutesOverride)
                : "",
            overtimeLateMinutesOverride:
              item.overtimeLateMinutesOverride != null
                ? String(item.overtimeLateMinutesOverride)
                : "",
            lateMinutesOverride:
              item.lateMinutesOverride != null
                ? String(item.lateMinutesOverride)
                : "",
            earlyLeaveMinutesOverride:
              item.earlyLeaveMinutesOverride != null
                ? String(item.earlyLeaveMinutesOverride)
                : "",
            note: item.note ?? "",
          });
          setOtSplitMode(
            item.overtimeEarlyMinutesOverride != null || item.overtimeLateMinutesOverride != null
          );
        } else {
          setAdjustment({
            statusOverride: "",
            workedMinutesOverride: "",
            overtimeMinutesOverride: "",
            overtimeEarlyMinutesOverride: "",
            overtimeLateMinutesOverride: "",
            lateMinutesOverride: "",
            earlyLeaveMinutesOverride: "",
            note: "",
          });
          setOtSplitMode(false);
        }
      }
    } catch {
      // ignore adjustment load errors
    } finally {
      setLoadingAdjustment(false);
    }
  }

  // Save manual adjustment (upsert).
  async function saveAdjustment() {
    if (!safeId || !date || savingAdjustment) return;
    const hasOverride =
      adjustment.statusOverride !== "" ||
      adjustment.workedMinutesOverride !== "" ||
      adjustment.overtimeMinutesOverride !== "" ||
      adjustment.overtimeEarlyMinutesOverride !== "" ||
      adjustment.overtimeLateMinutesOverride !== "" ||
      adjustment.lateMinutesOverride !== "" ||
      adjustment.earlyLeaveMinutesOverride !== "";

      const hasOtSplit = otSplitMode;
    const hasOtTotal = adjustment.overtimeMinutesOverride !== "";
    if (hasOtSplit && hasOtTotal) {
      setError("OT override için ya Total ya da Early/Late girin (ikisi birlikte olmaz).");
      return;
    }

    const noteEmpty = (adjustment.note ?? "").trim() === "";
    if (hasOverride && noteEmpty) {
      setError("Not zorunludur (manuel düzeltme için açıklama girin).");
      return;
    }
    setSavingAdjustment(true);
    setError(null);
    try {
      const body: any = {};
      // Status override: empty string means null override
      if (adjustment.statusOverride !== "") {
        body.statusOverride = adjustment.statusOverride || null;
      } else {
        body.statusOverride = null;
      }
      // Helper to parse numeric overrides. Blank string results in null.
      const parseNum = (v: string) => {
       if (v === "" || v == null) return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };
      body.workedMinutesOverride = parseNum(adjustment.workedMinutesOverride);
      body.overtimeMinutesOverride = parseNum(adjustment.overtimeMinutesOverride);
      body.overtimeEarlyMinutesOverride = otSplitMode
        ? parseNum(adjustment.overtimeEarlyMinutesOverride)
        : null;
      body.overtimeLateMinutesOverride = otSplitMode
        ? parseNum(adjustment.overtimeLateMinutesOverride)
        : null;
      body.lateMinutesOverride = parseNum(adjustment.lateMinutesOverride);
      body.earlyLeaveMinutesOverride = parseNum(adjustment.earlyLeaveMinutesOverride);
      body.note = adjustment.note ?? null;
      const res = await fetch(
        `/api/employees/${safeId}/daily-adjustment?date=${encodeURIComponent(date)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to save adjustment");
      }
      // Reload daily summary and adjustment after saving
      await loadDailyRawNorm();
      await loadMasterHeader();
      await loadAdjustment();
    } catch (e: any) {
      setError(e?.message ?? "Save adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  }

  // Clear manual adjustment for selected date.
  async function clearAdjustment() {
    if (!safeId || !date) return;
    setSavingAdjustment(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/employees/${safeId}/daily-adjustment?date=${encodeURIComponent(date)}`,
        { method: "DELETE", credentials: "include" },
     );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to clear adjustment");
      }
      // Reset form and reload data
      setAdjustment({
        statusOverride: "",
        workedMinutesOverride: "",
        overtimeMinutesOverride: "",
        overtimeEarlyMinutesOverride: "",
        overtimeLateMinutesOverride: "",
        lateMinutesOverride: "",
        earlyLeaveMinutesOverride: "",
        note: "",
      });
      setOtSplitMode(false);
      await loadDailyRawNorm();
      await loadMasterHeader();
      await loadAdjustment();
    } catch (e: any) {
      setError(e?.message ?? "Clear adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  }

  // Toggle employee active status
  async function toggleActive() {
    if (!employee) return;
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: employee.id,
          isActive: !employee.isActive,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to toggle active");
      }
      await loadEmployee();
    } catch (e: any) {
      setError(e?.message ?? "Toggle failed");
    } finally {
      setToggling(false);
    }
  }

  // Recompute daily attendance for selected date (company-wide)
  async function recompute() {
    setRecomputing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attendance/recompute?date=${encodeURIComponent(date)}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to recompute");
      }
      // Reload daily, raw, and normalized after recompute
      await loadDailyRawNorm();
      await loadMasterHeader();
    } catch (e: any) {
      setError(e?.message ?? "Recompute failed");
    } finally {
      setRecomputing(false);
    }
  }

  // Create a manual raw event
  async function createManualEvent() {
    if (!manualDateTime || savingManual) return;
    setSavingManual(true);
    setError(null);
    try {
      const iso = localPolicyDateTimeToUtcIso(manualDateTime, policyTimezone);
      const body: any = {
        employeeId: safeId,
        occurredAt: iso,
        direction: manualDirection,
      };
      if (manualDoorId) body.doorId = manualDoorId;
      const res = await fetch(`/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let errMsg =
          typeof data?.error === "string"
            ? data.error
            : `create_failed_${res.status}`;
        // Map internal error codes to human messages (Turkish as in UI)
        if (errMsg === "auto_direction_needs_door")
          errMsg = "Auto direction seçildiyse bir kapı seçmelisiniz.";
        else if (errMsg === "no_default_direction")
          errMsg = "Seçili kapı için default direction tanımlı değil.";
        else if (errMsg === "employee_not_found")
          errMsg = "Personel bulunamadı.";
        else if (errMsg === "door_not_found")
          errMsg = "Kapı bulunamadı.";
        else if (errMsg === "device_not_found")
          errMsg = "Cihaz bulunamadı.";
        setError(errMsg);
        return;
      }
      // Reset manual input fields
      setManualDateTime(nowLocalInputValueForPolicyTimezone(policyTimezone));
      setManualDoorId("");
      // Recompute and reload data after adding manual event
      await recompute();
      await loadMasterHeader();
    } catch (e: any) {
      if (e?.message === "INVALID_LOCAL_DATETIME") {
        setError(`Geçersiz tarih/saat. Saat bilgisi ${policyTimezone} zaman dilimine göre yorumlanır.`);
      } else {
        setError(e?.message ?? "Manual event failed");
      }
    } finally {
      setSavingManual(false);
    }
  }

  // Load employee and doors once
  useEffect(() => {
    if (!safeId) return;
    loadCompanyPolicyTimezone();
    loadEmployee();
    loadDoors();
    loadShiftTemplates();
  }, [safeId]);

  useEffect(() => {
    setWeekStart((prev) => {
      const base = prev || currentDayKeyForTimezone(policyTimezone);
      return weekStartFromISODate(base, policyTimezone);
    });
    setManualDateTime((prev) => prev || nowLocalInputValueForPolicyTimezone(policyTimezone));
  }, [policyTimezone]);

  // Week strip: weekStart hazır olunca 7 günün daily fallback'ını da çek
  useEffect(() => {
    if (!safeId || !weekStart) return;
    loadWeekResolvedShifts(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeId, weekStart]);

  // Reload daily/raw/normalized when date or id changes
  useEffect(() => {
    if (safeId) {
      loadDailyRawNorm();
      loadPolicyMeta();
      loadPolicyAssignments();
    }
  }, [safeId, date]);

  // Reload manual adjustment whenever employee or date changes
  useEffect(() => {
    if (safeId) {
      loadAdjustment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeId, date]);

  return (
    <div className="grid gap-6 max-w-full min-w-0">
      <EmployeeDetailSubnav id={id} current="records" />

      {notice ? (
        <div
          className={
            "rounded-3xl border px-4 py-3.5 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.06)] " +
            (notice.kind === "error"
              ? "border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-red-800"
              : notice.kind === "success"
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800"
                : "border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-900")
          }
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      {/* Display error if exists */}
      {error && (
        <div className="rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-sm text-red-900 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">İşlem sırasında hata</div>
              <div className="mt-1 break-words text-red-800/90">{error}</div>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => setError(null)}>
              Kapat
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-start max-w-full min-w-0">
        <div className="grid gap-5 min-w-0">
          <Card
            title="Gün Seçimi ve İşlemler"
            description="Seçili gün için hesap ve görünümü yönetin"
            tone="slate"
            className="self-start"
          >
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={loadDailyRawNorm} disabled={loadingData} variant="secondary">
                  {loadingData ? "Yükleniyor…" : "Yenile"}
                </Button>
                <Button onClick={recompute} disabled={recomputing}>
                  {recomputing ? "Hesaplanıyor…" : "Günü Yeniden Hesapla"}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Günlük Sonuç Düzeltmesi"
            description="Seçilen günün hesap sonucuna kontrollü düzeltme uygulayın"
            tone="violet"
            className="self-start"
            right={
              (adjustment.statusOverride ||
                adjustment.workedMinutesOverride ||
                adjustment.overtimeMinutesOverride ||
                adjustment.lateMinutesOverride ||
                adjustment.earlyLeaveMinutesOverride ||
                adjustment.note) ? (
                <Badge tone="info">Override var</Badge>
              ) : null
            }
          >
            {loadingAdjustment ? (
              <div className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-1.5">
                    <SkeletonLine className="h-3 w-28" />
                    <SkeletonLine className="h-11 w-full rounded-xl" />
                  </div>
                  <div className="grid gap-1.5">
                    <SkeletonLine className="h-3 w-36" />
                    <SkeletonLine className="h-11 w-full rounded-xl" />
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SkeletonPill className="h-5 w-5 rounded-md" />
                    <SkeletonLine className="h-4 w-40" />
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <SkeletonLine className="h-11 w-full rounded-xl" />
                    <SkeletonLine className="h-11 w-full rounded-xl" />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <SkeletonLine className="h-11 w-full rounded-xl" />
                  <SkeletonLine className="h-11 w-full rounded-xl" />
                  <SkeletonLine className="h-11 w-full rounded-xl" />
                </div>
                <SkeletonLine className="h-11 w-full rounded-xl" />
                <div className="flex gap-2">
                  <SkeletonLine className="h-10 w-28 rounded-xl" />
                  <SkeletonLine className="h-10 w-28 rounded-xl" />
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-1.5">
                    <Label>Status Override</Label>
                    <Select
                      value={adjustment.statusOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          statusOverride: e.target.value,
                        }))
                      }
                    >
                      <option value="">— None —</option>
                      <option value="PRESENT">PRESENT</option>
                      <option value="ABSENT">ABSENT</option>
                      <option value="OFF">OFF</option>
                      <option value="LEAVE">LEAVE</option>
                    </Select>
                  </label>

                  <label className="grid gap-1.5">
                    <Label>Worked Minutes Override</Label>
                    <Input
                      type="number"
                      value={adjustment.workedMinutesOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          workedMinutesOverride: e.target.value,
                        }))
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={otSplitMode}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setOtSplitMode(v);
                        if (v) {
                          setAdjustment((a) => ({ ...a, overtimeMinutesOverride: "" }));
                        } else {
                          setAdjustment((a) => ({
                            ...a,
                            overtimeEarlyMinutesOverride: "",
                            overtimeLateMinutesOverride: "",
                          }));
                        }
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                    />
                    <span className="font-medium">OT Early/Late Override</span>
                  </label>
                  {otSplitMode && (
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <label className="grid gap-1.5">
                        <Label>OT Early Override</Label>
                        <Input type="number" value={adjustment.overtimeEarlyMinutesOverride} onChange={(e) => setAdjustment((a) => ({ ...a, overtimeEarlyMinutesOverride: e.target.value }))} placeholder="Leave blank for none" />
                      </label>
                      <label className="grid gap-1.5">
                        <Label>OT Late Override</Label>
                        <Input type="number" value={adjustment.overtimeLateMinutesOverride} onChange={(e) => setAdjustment((a) => ({ ...a, overtimeLateMinutesOverride: e.target.value }))} placeholder="Leave blank for none" />
                      </label>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <label className="grid gap-1.5"><Label>Overtime Minutes Override</Label><Input type="number" value={adjustment.overtimeMinutesOverride} onChange={(e) => setAdjustment((a) => ({ ...a, overtimeMinutesOverride: e.target.value }))} placeholder="Leave blank for none" /></label>
                  <label className="grid gap-1.5"><Label>Late Minutes Override</Label><Input type="number" value={adjustment.lateMinutesOverride} onChange={(e) => setAdjustment((a) => ({ ...a, lateMinutesOverride: e.target.value }))} placeholder="Leave blank for none" /></label>
                  <label className="grid gap-1.5"><Label>Early Leave Minutes Override</Label><Input type="number" value={adjustment.earlyLeaveMinutesOverride} onChange={(e) => setAdjustment((a) => ({ ...a, earlyLeaveMinutesOverride: e.target.value }))} placeholder="Leave blank for none" /></label>
                </div>
                <label className="grid gap-1.5"><Label>Note</Label><Input type="text" value={adjustment.note} onChange={(e) => setAdjustment((a) => ({ ...a, note: e.target.value }))} placeholder="Optional note" /></label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={saveAdjustment} disabled={savingAdjustment}>{savingAdjustment ? "Kaydediliyor…" : "Kaydet"}</Button>
                  <Button onClick={clearAdjustment} disabled={savingAdjustment} variant="secondary">{savingAdjustment ? "Temizleniyor…" : "Temizle"}</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0">

          <Card
            title="Seçili Gün Özeti"
            description="Seçilen günün zaman değerlendirme çıktısı"
            tone="amber"
            loading={loadingData}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-3 py-2.5">
              <Badge tone="warn">
                Seçili Gün
              </Badge>
              <div className="text-xs text-zinc-600">
                Bu kart <span className="font-medium text-zinc-800">{date}</span> tarihinin evaluation sonucunu gösterir.
                {isViewingToday ? " Seçili gün bugün ile aynı." : " Seçili gün bugün ile aynı değildir."}
              </div>
            </div>
            {loadingData ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SkeletonPill className="h-7 w-24" />
                  <SkeletonPill className="h-7 w-20" />
                  <SkeletonLine className="h-4 w-24" />
                </div>

                <div className="grid gap-2 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50 px-4 py-3">
                  <SkeletonFieldRow />
                  <SkeletonFieldRow />
                  <SkeletonLine className="h-3 w-48" />
                  <SkeletonLine className="h-3 w-72 max-w-full" />
                </div>

                <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                  <SkeletonFieldRow />
                  <SkeletonFieldRow />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SkeletonMetricCard className="border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50" />
                  <SkeletonMetricCard className="border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50" />
                  <SkeletonMetricCard className="border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50" />
                  <SkeletonMetricCard className="border-rose-200/80 bg-gradient-to-br from-rose-50 to-pink-50" />
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <SkeletonLine className="h-4 w-48" />
                </div>
              </div>
            ) : daily ? (
              <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {daily.shiftSource ? (
                      <ShiftSourceBadge source={daily.shiftSource} />
                    ) : null}
                    {daily.dayKey && masterToday?.dayKey && !isSameIsoDay(daily.dayKey, masterToday.dayKey) ? (
                      <Badge tone="warn">
                        Bugün değil
                      </Badge>
                    ) : null}
                    {daily.dayKey && masterToday?.dayKey && isSameIsoDay(daily.dayKey, masterToday.dayKey) ? (
                      <Badge tone="ok">
                        Bugün
                      </Badge>
                    ) : null}
                    <span className="text-xs text-zinc-500">
                      {daily.shiftBadge
                        ? daily.shiftBadge
                        : daily.shiftSignature
                          ? daily.shiftSignature
                          : "—"}
                    </span>
                  </div>
                  
                  {/* Night-shift clarity: canonical work day vs real timestamps */}
                  <div className="grid gap-2 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50 px-4 py-3">
                    <FieldRow label="İş Günü" value={daily.dayKey || date || "—"} />
                    <FieldRow
                      label="Vardiya Penceresi"
                      value={
                        daily.shiftWindowStart && daily.shiftWindowEnd
                          ? `${fmt(daily.shiftWindowStart, daily.shiftTimezone || policyTimezone)} → ${fmt(daily.shiftWindowEnd, daily.shiftTimezone || policyTimezone)}`
                          : daily.shiftStartMinute != null && daily.shiftEndMinute != null
                            ? `${hhmmFromMinute(daily.shiftStartMinute)}–${hhmmFromMinute(daily.shiftEndMinute)}${
                                daily.shiftSpansMidnight ? " (+1)" : ""
                              }`
                          : daily.shiftSignature
                            ? daily.shiftSignature
                            : "—"
                      }
                    />
                   {daily.shiftTimezone ? (
                      <div className="text-xs text-zinc-500">Saat Dilimi: {daily.shiftTimezone}</div>
                    ) : null}
                    <div className="text-xs text-zinc-500">
                      Not: “İlk Giriş / Son Çıkış” alanları gerçek olay zamanıdır (occurredAt).
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                    <FieldRow label="İlk Giriş" value={fmt(daily.firstIn, daily.shiftTimezone || policyTimezone) || "—"} />
                    <FieldRow label="Son Çıkış" value={fmt(daily.lastOut, daily.shiftTimezone || policyTimezone) || "—"} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50 px-3 py-3">
                      <Label>Çalışma (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.workedMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50 px-3 py-3">
                      <Label>Fazla Mesai (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.overtimeMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-3">
                      <Label>Geç Kalma (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.lateMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-pink-50 px-3 py-3">
                      <Label>Erken Çıkış (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.earlyLeaveMinutes ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-700">Anomali:</span>{" "}
                    {Array.isArray(daily.anomalies) && daily.anomalies.length > 0
                      ? daily.anomalies.map(anomalyLabelTR).join(", ")
                      : "Yok"}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                  Bu tarih için kayıt yok.
                </div>
              )}
          </Card>
        </div>

        </div>
      
      {/* Terminate Modal (return'un en altına taşındı) */}
      {showTerminate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-gradient-to-br from-white via-red-50 to-rose-50 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">{employeeCardScopeTerms.terminateModalTitle}</div>
                <div className="text-sm text-zinc-600">
                  Bitiş tarihi verildiğinde aktif zaman kapsamı kapatılır ve sistemsel temizlik kuralları uygulanır.
                </div>
              </div>
              <Button
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setShowTerminate(false)}
                disabled={savingAction === "TERMINATE"}
              >
                Kapat
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">{employeeCardScopeTerms.terminateDateLabel} (opsiyonel)</span>
                <Input
                  type="date"
                  value={terminateEndDate}
                  onChange={(e) => setTerminateEndDate(e.target.value)}
                />
                <span className="text-xs text-zinc-500">Boş bırakılırsa bugün uygulanır.</span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">İşlem Notu (opsiyonel)</span>
                <Input
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  placeholder={employeeCardScopeTerms.terminatePlaceholder}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowTerminate(false)}
                disabled={savingAction === "TERMINATE"}
              >
                Vazgeç
              </Button>
              <Button
                variant="danger"
                onClick={doTerminate}
                disabled={savingAction === "TERMINATE" || !canTerminate}
              >
                {savingAction === "TERMINATE" ? "Kaydediliyor…" : employeeCardScopeTerms.terminateModalApplyLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rehire Modal (return'un en altına taşındı) */}
      {showRehire ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-teal-50 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">{employeeCardScopeTerms.rehireModalTitle}</div>
                <div className="text-sm text-zinc-600">
                  Başlangıç tarihi ile yeni bir aktif zaman kapsamı açılır (çakışma kontrolü vardır).
                </div>
              </div>
              <Button
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setShowRehire(false)}
                disabled={savingAction === "REHIRE"}
              >
                Kapat
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">{employeeCardScopeTerms.rehireDateLabel} (opsiyonel)</span>
                <Input
                  type="date"
                  value={rehireStartDate}
                  onChange={(e) => setRehireStartDate(e.target.value)}
                />
                <span className="text-xs text-zinc-500">Boş bırakılırsa bugün uygulanır.</span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">İşlem Notu (opsiyonel)</span>
                <Input
                  value={rehireReason}
                  onChange={(e) => setRehireReason(e.target.value)}
                  placeholder={employeeCardScopeTerms.rehirePlaceholder}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowRehire(false)}
                disabled={savingAction === "REHIRE"}
              >
                Vazgeç
              </Button>
              <Button
                variant="primary"
                onClick={doRehire}
                disabled={savingAction === "REHIRE" || !canRehire}
              >
                {savingAction === "REHIRE" ? "Kaydediliyor…" : employeeCardScopeTerms.rehireModalApplyLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-12 max-w-full min-w-0">
        <div className="lg:col-span-6 min-w-0">
          <Card
            title="Kapsam Dönemleri"
            description="Zaman kapsamı dönem kayıtları"
            tone="emerald"
            loading={loadingEmployee && !employee}
          >
            {loadingEmployee && !employee ? (
              <div className="grid gap-2">
                <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-white to-emerald-50/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <SkeletonLine className="h-4 w-40" />
                    <SkeletonPill className="h-7 w-24" />
                  </div>
                  <div className="mt-3 grid gap-2">
                    <SkeletonLine className="h-4 w-32" />
                    <SkeletonLine className="h-3 w-44" />
                  </div>
                </div>
              </div>
            ) : employmentPeriods.length === 0 ? (
              <div className="text-sm text-slate-500">Kayıt yok.</div>
            ) : (
              <div className="grid gap-2">
                {employmentPeriods.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-white to-emerald-50/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900">
                        {String(p.startDate).slice(0, 10)} → {p.endDate ? String(p.endDate).slice(0, 10) : "Açık"}
                      </div>
                      <Badge tone={p.endDate ? "warn" : "ok"}>
                        {p.endDate ? "Kapalı dönem" : "Aktif dönem"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-zinc-700">
                      <div>
                        <span className="text-xs font-medium text-zinc-500">Sebep: </span>
                        {p.reason ?? "—"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        created: {fmt(p.createdAt, policyTimezone)} • updated: {fmt(p.updatedAt, policyTimezone)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-6 min-w-0">
          <Card
            title="Kapsam İşlem Geçmişi"
            description="Kapsam açma / kapama işlemleri ve sistem etkileri"
            tone="sky"
            loading={loadingEmployee && !employee}
          >
            {loadingEmployee && !employee ? (
              <div className="grid gap-2">
                <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-white to-sky-50/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="grid gap-2">
                      <SkeletonLine className="h-4 w-40" />
                      <SkeletonLine className="h-3 w-52" />
                    </div>
                    <SkeletonPill className="h-7 w-24" />
                  </div>
                </div>
              </div>
            ) : actions.length === 0 ? (
              <div className="text-sm text-slate-500">Kayıt yok.</div>
            ) : (
              <div className="grid gap-2">
                {actions.map((a) => {
                  const cleanup = a?.details?.cleanup ?? null;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-white to-sky-50/60 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900">
                            {trActionType(a.type)} • {String(a.effectiveDate).slice(0, 10)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            oluşturma: {fmt(a.createdAt, policyTimezone)}
                            {a.actorUserId ? ` • yapan: ${maskId(a.actorUserId)}` : ""}
                          </div>
                        </div>
                        <Badge tone={a.type === "TERMINATE" ? "warn" : "info"}>{trActionType(a.type)}</Badge>
                      </div>

                      {a.note ? (
                        <div className="mt-2 text-sm text-zinc-700">
                          <span className="text-xs font-medium text-zinc-500">Not: </span>
                          {a.note}
                        </div>
                      ) : null}

                      {cleanup ? (
                        <div className="mt-2 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 text-sm text-zinc-800">
                          <div className="text-xs font-semibold text-zinc-700">
                             Kapsam Sonrası Temizlik Özeti
                          </div>
                          <div className="mt-1 grid gap-1">
                            <div>Silinen izin: {cleanup.leavesDeleted ?? 0}</div>
                            <div>Kırpılan izin: {cleanup.leavesTrimmed ?? 0}</div>
                            <div>Silinen haftalık plan: {cleanup.weeklyPlansDeleted ?? 0}</div>
                            <div>Silinen düzeltme: {cleanup.adjustmentsDeleted ?? 0}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>   

      {/* Events tables */}
      <div className="grid gap-5 lg:grid-cols-2 max-w-full min-w-0">
        <Card
          title="Ham Olaylar"
          description="Ham geçiş kayıtları"
          tone="slate"
          loading={loadingData}
        >
          {loadingData ? (
            <SkeletonTableRows rows={5} />
          ) : rawEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
              Kayıt yok.
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full min-w-0">
              <table className="min-w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2">When</th>
                  <th className="whitespace-nowrap px-3 py-2">Dir</th>
                  <th className="whitespace-nowrap px-3 py-2">Source</th>
                  <th className="whitespace-nowrap px-3 py-2">Door</th>
                  <th className="whitespace-nowrap px-3 py-2">Device</th>
                </tr>
              </thead>
              <tbody>
                {rawEvents.map((ev) => (
                  <tr key={ev.id} className="text-sm text-slate-900">
                    <td className="whitespace-nowrap rounded-l-xl bg-slate-50 px-3 py-2.5 text-slate-800">
                      {fmt(ev.occurredAt, policyTimezone)}
                    </td>
                    <td className="whitespace-nowrap bg-slate-50 px-3 py-2.5">
                      <Badge tone="info">{ev.direction}</Badge>
                    </td>
                    <td className="whitespace-nowrap bg-slate-50 px-3 py-2.5 text-slate-700">
                      {ev.source}
                    </td>
                    <td className="bg-slate-50 px-3 py-2.5 text-slate-700">
                      {ev.door ? `${ev.door.code} - ${ev.door.name}` : "—"}
                    </td>
                    <td className="rounded-r-xl bg-slate-50 px-3 py-2.5 text-slate-700">
                      {ev.device ? ev.device.name : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <Card
          title="Normalize Olaylar"
          description="Normalize edilmiş kayıtlar"
          tone="sky"
          loading={loadingData}
        >
          {loadingData ? (
            <SkeletonTableRows rows={5} />
          ) : normEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
              Kayıt yok.
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full min-w-0">
              <table className="min-w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2">When</th>
                  <th className="whitespace-nowrap px-3 py-2">Dir</th>
                  <th className="whitespace-nowrap px-3 py-2">Status</th>
                  <th className="whitespace-nowrap px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {normEvents.map((ev) => (
                  <tr key={ev.id} className="text-sm text-slate-900">
                    <td className="whitespace-nowrap rounded-l-xl bg-slate-50 px-3 py-2.5 text-slate-800">
                      {fmt(ev.occurredAt, policyTimezone)}
                    </td>
                    <td className="whitespace-nowrap bg-slate-50 px-3 py-2.5">
                      <Badge tone="info">{ev.direction}</Badge>
                    </td>
                    <td className="whitespace-nowrap bg-slate-50 px-3 py-2.5 text-slate-700">
                      {ev.status}
                    </td>
                    <td className="rounded-r-xl bg-slate-50 px-3 py-2.5 text-slate-700">
                      {ev.rejectReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>

      {/* Manual event form */}
      <Card
        title="Manuel Olay Ekle"
        description="Eksik kayıtlar için manuel IN / OUT olayı ekleyin"
        tone="rose"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 via-white to-pink-50 px-3 py-2.5">
          <Badge tone="info">Policy TZ</Badge>
          <div className="text-xs text-zinc-600">
            Girilen tarih/saat <span className="font-medium text-zinc-800">{policyTimezone}</span> zaman dilimine göre yorumlanır.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <label className="grid gap-1.5 lg:col-span-5">
            <Label>Occurred At</Label>
            <Input
              type="datetime-local"
              value={manualDateTime}
              onChange={(e) => setManualDateTime(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <Label>Direction</Label>
            <Select
              value={manualDirection}
              onChange={(e) => setManualDirection(e.target.value as any)}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
          </label>
          <label className="grid gap-1.5 lg:col-span-4">
            <Label>Door (optional)</Label>
            <Select
              value={manualDoorId}
              onChange={(e) => setManualDoorId(e.target.value)}
            >
              <option value="">— None —</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="lg:col-span-12">
            <Button
              disabled={savingManual || !manualDateTime}
              onClick={createManualEvent}
              className="w-full sm:w-auto"
              variant="primary"
            >
              {savingManual ? "Kaydediliyor…" : "Olay Oluştur"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
