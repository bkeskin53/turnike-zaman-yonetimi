/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";

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

function weekStartFromISODate(isoDayKey: string): string {
  // isoDayKey: YYYY-MM-DD (local date)
  const [y, m, d] = isoDayKey.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1); // local midnight
  const jsDay = dt.getDay(); // Sun=0..Sat=6
  const mondayIndex = (jsDay + 6) % 7; // Mon=0..Sun=6
  dt.setDate(dt.getDate() - mondayIndex);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtShift(daily: any): string {
  if (!daily) return "—";
  // En okunur: shiftBadge (genelde "09:00–18:00" gibi)
  if (daily.shiftBadge) return String(daily.shiftBadge);
  // Sonra signature
  if (daily.shiftSignature) return String(daily.shiftSignature);
  // Pencere varsa onu formatla
  if (daily.shiftWindowStart && daily.shiftWindowEnd) {
    return `${fmt(daily.shiftWindowStart)} → ${fmt(daily.shiftWindowEnd)}`;
  }
  return "—";
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
        "ring-1 ring-black/0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-3 min-w-0 max-w-full">
        <div className="min-w-0 max-w-full">
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-3 min-w-0 max-w-full">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-zinc-500">{children}</span>;
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-zinc-900">{children}</span>;
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
    <div className={cx("flex items-start justify-between gap-6", className)}>
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
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium " +
    "transition focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "secondary"
        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "bg-transparent text-zinc-900 hover:bg-zinc-100";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(base, styles, "shadow-sm", className)}
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
  tone?: "info" | "warn" | "ok";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-sky-50 text-sky-900 ring-sky-200";
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

// Convert a datetime-local string to ISO string with current timezone offset
function toIsoWithLocalOffset(local: string) {
  // Input format: YYYY-MM-DDTHH:mm
  const offMin = -new Date().getTimezoneOffset(); // minutes east of UTC
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}:00${sign}${hh}:${mm}`;
}

// Format a date/time into a human-readable string (Turkish locale)
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

type EmploymentPeriod = {
  id: string;
  startDate: string; // ISO
  endDate: string | null; // ISO
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  switch (t) {
    case "HIRE":
      return "İşe Alındı";
    case "REHIRE":
      return "Yeniden İşe Alındı";
    case "TERMINATE":
      return "İşten Çıkış";
    case "UPDATE":
      return "Güncellendi";
    default:
      return t;
  }
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
      shiftSource?: "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM";
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

export default function Employee360Client({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [orgLite, setOrgLite] = useState<MasterEmployeeLite | null>(null);
  const [employmentPeriods, setEmploymentPeriods] = useState<EmploymentPeriod[]>([]);
  const [actions, setActions] = useState<EmployeeAction[]>([]);
  const [date, setDate] = useState(() => {
    // Default to today's date in local timezone, format YYYY-MM-DD
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
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
  const [appliedPolicy, setAppliedPolicy] = useState<{ source: string; ruleSet: { id: string; code: string; name: string } | null } | null>(null);
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
    if (!id || !start) return;
    setLoadingWeeklyPlan(true);
    try {
      const res = await fetch(
        `/api/employees/${id}/weekly-plan?weekStart=${encodeURIComponent(start)}`,
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
    if (!id || !start) return;
    setLoadingWeekResolved(true);
    try {
      const res = await fetch(
        `/api/employees/${id}/week-resolved-shifts?weekStart=${encodeURIComponent(start)}`,
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

  function resolvePlanDayLabel(i: number): { label: string; sub: string } {
    // i: 0..6 (Mon..Sun)
    const dayKey = weekStart ? addDaysISO(weekStart, i) : "";
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
      setOrgLite(null);

      const res = await fetch(`/api/employees/${id}`, {
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
      // UI için hafifçe çekiyoruz; hata olursa sessizce geçiyoruz.
      try {
        const mRes = await fetch(`/api/employees/${id}/master`, { credentials: "include" });
        if (mRes.ok) {
          const mJson = await mRes.json();
          const emp = (mJson?.item?.employee ?? mJson?.item?.employee ?? null) as any;
          if (emp) {
            setOrgLite({
              branch: emp.branch ?? null,
              employeeGroup: emp.employeeGroup ?? null,
              employeeSubgroup: emp.employeeSubgroup ?? null,
            });
          }
          // "Bu hafta" için weekly plan strip (master.today.dayKey üzerinden)
          const todayKey = String(mJson?.item?.today?.dayKey ?? "").slice(0, 10);
          if (todayKey) {
            const ws = weekStartFromISODate(todayKey);
            setWeekStart(ws);
            // sadece UI: plan var/yok + mini strip
            loadWeeklyPlanForWeek(ws);
          } else {
            // fallback: local today
            const now = new Date();
            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            const dk = local.toISOString().slice(0, 10);
            const ws = weekStartFromISODate(dk);
            setWeekStart(ws);
            loadWeeklyPlanForWeek(ws);
          }
        }
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message ?? "Employee load failed");
      setEmployee(null);
      setEmploymentPeriods([]);
      setActions([]);
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
    const map: Record<string, string> = {
      INVALID_END_DATE: "Çıkış tarihi geçersiz. (YYYY-AA-GG)",
      INVALID_START_DATE: "İşe dönüş tarihi geçersiz. (YYYY-AA-GG)",
      NO_OPEN_EMPLOYMENT: "Açık istihdam dönemi bulunamadı (zaten kapalı olabilir).",
      END_BEFORE_START: "Çıkış tarihi, işe giriş tarihinden önce olamaz.",
      EMPLOYMENT_OVERLAP: "Bu tarihte çakışan bir istihdam dönemi var. Başka tarih deneyin.",
      server_error: "Sunucu hatası oluştu. Tekrar deneyin.",
      UNAUTHORIZED: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      FORBIDDEN: "Bu işlem için yetkiniz yok.",
    };
    return map[v] ?? v;
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

      flash("success", `İşten çıkış işlendi. (Çıkış: ${json?.endDate ?? "—"})`);
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

      flash("success", `Yeniden işe alındı. (Başlangıç: ${json?.startDate ?? "—"})`);
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
    try {
      // rule sets
      const rsRes = await fetch(`/api/policy/rule-sets`, { credentials: "include" });
      if (rsRes.ok) {
        const rsJson = await rsRes.json();
        const items = Array.isArray(rsJson?.items) ? rsJson.items : [];
        setPolicyRuleSets(items);
      }

      // applied
      const apRes = await fetch(`/api/employees/${id}/policy?date=${encodeURIComponent(date)}`, { credentials: "include" });
      if (apRes.ok) {
        const apJson = await apRes.json();
        setAppliedPolicy(apJson);
        // dropdown default
        if (apJson?.ruleSet?.id) setSelectedPolicyRuleSetId(apJson.ruleSet.id);
        else setSelectedPolicyRuleSetId("DEFAULT");
      } else {
        setAppliedPolicy(null);
        setSelectedPolicyRuleSetId("DEFAULT");
      }
    } catch {
      // ignore policy meta errors (UI-only)
    }
  }

  async function loadPolicyAssignments() {
    try {
      const res = await fetch(`/api/employees/${id}/policy-assignments`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setPolicyAssignments(Array.isArray(json?.items) ? json.items : []);
    } catch {
      // ignore
    }
  }

  async function savePolicyAssignment() {
    if (!id || savingPolicyAssign) return;
    setSavingPolicyAssign(true);
    try {
      if (selectedPolicyRuleSetId === "DEFAULT") {
        const res = await fetch(`/api/policy/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ employeeId: id, clear: true }),
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
            employeeId: id,
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
      await loadPolicyMeta();
      await loadPolicyAssignments();
      await loadDailyRawNorm();
    } finally {
      setSavingPolicyAssign(false);
    }
  }

  // Load daily summary, raw events, and normalized events
  async function loadDailyRawNorm() {
    setLoadingData(true);
    setError(null);
    try {
      // Daily attendance
      const dRes = await fetch(
        `/api/employees/${id}/daily?date=${encodeURIComponent(date)}`,
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
          employeeId: id,
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
        `/api/employees/${id}/normalized-events?${new URLSearchParams({
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
    if (!id || !date) return;
    setLoadingAdjustment(true);
    try {
      const res = await fetch(
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
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
    if (!id || !date || savingAdjustment) return;
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
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
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
      await loadAdjustment();
    } catch (e: any) {
      setError(e?.message ?? "Save adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  }

  // Clear manual adjustment for selected date.
  async function clearAdjustment() {
    if (!id || !date) return;
    setSavingAdjustment(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
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
      const iso = toIsoWithLocalOffset(manualDateTime);
      const body: any = {
        employeeId: id,
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
      setManualDateTime("");
      setManualDoorId("");
      // Recompute and reload data after adding manual event
      await recompute();
    } catch (e: any) {
      setError(e?.message ?? "Manual event failed");
    } finally {
      setSavingManual(false);
    }
  }

  // Load employee and doors once
  useEffect(() => {
    loadEmployee();
    loadDoors();
    loadShiftTemplates();
  }, [id]);

  // Week strip: weekStart hazır olunca 7 günün daily fallback'ını da çek
  useEffect(() => {
    if (!id || !weekStart) return;
    loadWeekResolvedShifts(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, weekStart]);

  // Reload daily/raw/normalized when date or id changes
  useEffect(() => {
    if (id) {
      loadDailyRawNorm();
      loadPolicyMeta();
      loadPolicyAssignments();
    }
  }, [id, date]);

  // Reload manual adjustment whenever employee or date changes
  useEffect(() => {
    if (id) {
      loadAdjustment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date]);

  return (
    <div className="grid gap-5 max-w-full min-w-0">
      {notice ? (
        <div
          className={
            "rounded-2xl border px-4 py-3 text-sm " +
            (notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : notice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-900")
          }
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      {/* Display error if exists */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
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

      {/* Üst düzen: Personel tam genişlik, altında Tarih/Özet yan yana */}
      <div className="grid gap-5 max-w-full min-w-0">
        <div className="min-w-0">
          <Card
            title="Personel"
            description="Çalışan bilgileri ve hızlı linkler"
            right={
              employee ? (
                <div className="flex items-center gap-2">
                  <Badge tone={employee.isActive ? "ok" : "warn"}>
                    {employee.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                  <Button
                    variant="danger"
                    className="h-8 px-3"
                    onClick={() => {
                      if (!canTerminate) return;
                      setShowTerminate(true);
                    }}
                    disabled={savingAction !== null || !canTerminate}
                    type="button"
                    title={canTerminate ? "İşten çıkar" : "Personel zaten kapalı. Yeniden işe al ile dönem açın."}
                  >
                    İşten Çıkar
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-8 px-3"
                    onClick={() => {
                      if (!canRehire) return;
                      setShowRehire(true);
                    }}
                    disabled={savingAction !== null || !canRehire}
                    type="button"
                    title={canRehire ? "Yeniden işe al" : "Personel zaten aktif. Önce işten çıkarın."}
                  >
                    Yeniden İşe Al
                  </Button>
                </div>
              ) : null
            }
          >
            {loadingEmployee && !employee ? (
              <div className="text-sm text-zinc-500">Yükleniyor…</div>
            ) : employee ? (
              <div className="grid gap-3">
                <div className="grid gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/60">
                  <FieldRow label="Kod" value={employee.employeeCode} />
                  <FieldRow label="Ad Soyad" value={fullName || "—"} />
                  <FieldRow label="E-posta" value={employee.email ?? "—"} />
                  <FieldRow
                    label="Bugünkü Vardiya"
                    value={
                      loadingData ? (
                        <span className="text-sm text-zinc-500">Yükleniyor…</span>
                      ) : (
                        <div className="grid justify-items-end gap-0.5">
                          <div className="text-sm font-medium text-zinc-900">
                            {fmtShift(daily)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Vardiya Kaynağı: {trShiftSourceTR((daily as any)?.shiftSource)}
                            {(daily as any)?.dayKey ? ` • İş Günü: ${(daily as any).dayKey}` : ""}
                            {(daily as any)?.shiftTimezone ? ` • TZ: ${(daily as any).shiftTimezone}` : ""}
                          </div>
                        </div>
                      )
                    }
                  />
                  <FieldRow
                    label="Plan Kaynağı"
                    value={
                      <div className="grid justify-items-end gap-0.5">
                        <div className="text-sm font-medium text-zinc-900">
                          {loadingWeeklyPlan ? "Yükleniyor…" : weeklyPlan ? "Haftalık Plan (Bu hafta)" : "Haftalık Plan yok"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {weekStart ? `Hafta: ${weekStart} → ${addDaysISO(weekStart, 6)}` : "—"}
                        </div>
                      </div>
                    }
                  />
                  <FieldRow
                    label="Kural Seti (Policy)"
                    value={
                      appliedPolicy?.ruleSet ? (
                        <div className="grid justify-items-end gap-0.5">
                          <div className="text-sm font-medium text-zinc-900">
                            {appliedPolicy.ruleSet.code}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Kaynak: {trPolicySourceTR(appliedPolicy.source)}
                          </div>
                        </div>
                      ) : (
                        <div className="grid justify-items-end gap-0.5">
                          <div className="text-sm font-medium text-zinc-900">DEFAULT</div>
                          <div className="text-xs text-zinc-500">Kaynak: Şirket Varsayılanı</div>
                        </div>
                      )
                    }
                  />
                </div>
                
                <div className="grid gap-2 rounded-xl border border-zinc-200/60 bg-white px-4 py-3">
                  <div className="text-sm font-medium text-zinc-900">Organizasyon</div>
                  <div className="grid gap-2">
                    <FieldRow
                      label="Şube"
                      value={
                        orgLite?.branch
                          ? `${orgLite.branch.code} — ${orgLite.branch.name}`
                          : "—"
                      }
                    />
                    <FieldRow
                      label="Üst Grup"
                      value={
                        orgLite?.employeeGroup
                          ? `${orgLite.employeeGroup.code} — ${orgLite.employeeGroup.name}`
                          : "—"
                      }
                    />
                    <FieldRow
                      label="Alt Grup"
                      value={
                        orgLite?.employeeSubgroup
                          ? `${orgLite.employeeSubgroup.code} — ${orgLite.employeeSubgroup.name}`
                          : "—"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2 rounded-xl border border-zinc-200/60 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-900">Policy Ataması</div>
                    <div className="text-xs text-zinc-500">Tarih: {date}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-8">
                      <Select
                        value={selectedPolicyRuleSetId}
                        onChange={(e) => setSelectedPolicyRuleSetId(e.target.value)}
                      >
                        <option value="DEFAULT">DEFAULT (Company Policy)</option>
                        {policyRuleSets.map((rs) => (
                          <option key={rs.id} value={rs.id}>
                            {rs.code} — {rs.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:col-span-4 flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={savePolicyAssignment}
                        disabled={savingPolicyAssign}
                        title="Seçilen policy set'i bu personele ata"
                      >
                        {savingPolicyAssign ? "Kaydediliyor…" : "Kaydet"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Valid From (YYYY-MM-DD)</div>
                      <input
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={policyValidFrom}
                        onChange={(e) => setPolicyValidFrom(e.target.value)}
                        placeholder="örn. 2026-02-01"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Valid To (YYYY-MM-DD)</div>
                      <input
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={policyValidTo}
                        onChange={(e) => setPolicyValidTo(e.target.value)}
                        placeholder="boş = sınırsız"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-xs text-zinc-600 mb-1">Priority</div>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={policyPriority}
                        onChange={(e) => setPolicyPriority(Number(e.target.value || 100))}
                        min={0}
                        max={1000}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Not: Atama yoksa sistem otomatik DEFAULT ile devam eder. (Motor değişmez)
                  </div>
                </div>

                {policyAssignments.length > 0 ? (
                  <div className="grid gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/60">
                    <div className="text-sm font-medium text-zinc-900">Policy Atama Geçmişi</div>
                    <div className="grid gap-2">
                      {policyAssignments.map((a: any) => (
                        <div key={a.id} className="text-xs text-zinc-700 flex flex-wrap gap-2">
                          <span className="font-medium">{a?.ruleSet?.code ?? "—"}</span>
                          <span>({a?.ruleSet?.name ?? "—"})</span>
                          <span>prio:{a?.priority ?? 100}</span>
                          <span>from:{a?.validFrom ? String(a.validFrom).slice(0, 10) : "—"}</span>
                          <span>to:{a?.validTo ? String(a.validTo).slice(0, 10) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                          
                <div className="flex flex-wrap items-center gap-2">
                  {/* Not: isActive toggle UI-side artık kullanılmıyor (kurumsal akış terminate/rehire). */}
                  <Badge tone={employee.isActive ? "ok" : "warn"}>
                    {employee.isActive ? "Employment: Aktif" : "Employment: Kapalı"}
                  </Badge>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/employees/${id}/weekly-plan`}
                      className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                    >
                      Haftalık Plan
                    </a>
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                        weeklyPlan ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200",
                      )}
                      title={weeklyPlan ? "Bu hafta için weekly plan var" : "Bu hafta için weekly plan yok"}
                    >
                      Plan: {weeklyPlan ? "Var" : "Yok"}
                    </span>
                  </div>
                  <a
                    href={`/employees/${id}/leaves`}
                    className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    İzinler
                  </a>
                  <a
                    href={`/employees/${id}/master`}
                    className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                  >
                    Personel Kimlik
                  </a>
                </div>

                {/* Bonus: Bu haftanın mini plan strip'i (Pzt..Paz) - sadece gösterim */}
                <div className="rounded-xl border border-zinc-200/60 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-900">Bu Hafta (Pzt–Paz)</div>
                    <div className="text-xs text-zinc-500">
                      {weekStart ? `${weekStart} → ${addDaysISO(weekStart, 6)}` : "—"}
                    </div>
                  </div>
                  {loadingWeeklyPlan || loadingWeekResolved ? (
                    <div className="mt-3 text-sm text-zinc-500">Yükleniyor…</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-7 gap-2">
                      {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((dname, i) => {
                        const r = resolvePlanDayLabel(i);
                        const dayKey = weekStart ? addDaysISO(weekStart, i) : "";
                        const isWeekend = i >= 5; // Cmt/Paz
                        return (
                          <div
                            key={dname}
                            className={cx(
                              "rounded-lg border px-2 py-2 text-center",
                              isWeekend
                                ? "border-amber-200/80 bg-amber-50"
                                : weeklyPlan
                                  ? "border-zinc-200/70 bg-zinc-50"
                                  : "border-zinc-200/60 bg-white",
                            )}
                            title={dayKey ? `${dname} • ${dayKey} • ${r.sub} • ${r.label}` : `${dname} • ${r.sub} • ${r.label}`}
                          >
                            <div className="text-[11px] font-medium text-zinc-600">{dname}</div>
                            <div className="mt-1 text-xs font-semibold text-zinc-900 truncate">{r.label}</div>
                            <div className="mt-0.5 text-[10px] text-zinc-500">{r.sub}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!weeklyPlan ? (
                    <div className="mt-2 text-xs text-zinc-500">
                      Not: Bu hafta için haftalık plan yoksa sistem Policy/rota/override ile devam eder (motor değişmez).
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Personel bulunamadı.</div>
            )}
          </Card>
        </div>

      <div className="grid gap-5 lg:grid-cols-2 max-w-full min-w-0">
          <Card title="Tarih & İşlemler" description="Günü seç ve veriyi yenile">
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
                  {recomputing ? "Hesaplanıyor…" : "Recompute Daily"}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Gün Özeti" description="Seçilen günün puantaj çıktısı">
            {loadingData ? (
              <div className="text-sm text-zinc-500">Yükleniyor…</div>
            ) : daily ? (
              <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{daily.status}</Badge>
                    <span className="text-xs text-zinc-500">
                      {daily.shiftBadge
                        ? daily.shiftBadge
                        : daily.shiftSignature
                          ? daily.shiftSignature
                          : "—"}
                    </span>
                  </div>
                  
                  {/* Night-shift clarity: canonical work day vs real timestamps */}
                  <div className="grid gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200/70">
                    <FieldRow label="İş Günü" value={daily.dayKey || date || "—"} />
                    <FieldRow
                      label="Vardiya Penceresi"
                      value={
                        daily.shiftWindowStart && daily.shiftWindowEnd
                          ? `${fmt(daily.shiftWindowStart)} → ${fmt(daily.shiftWindowEnd)}`
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

                  <div className="grid gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/60">
                    <FieldRow label="İlk Giriş" value={fmt(daily.firstIn) || "—"} />
                    <FieldRow label="Son Çıkış" value={fmt(daily.lastOut) || "—"} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200/70 px-3 py-2">
                      <Label>Çalışma (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.workedMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200/70 px-3 py-2">
                      <Label>Fazla Mesai (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.overtimeMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200/70 px-3 py-2">
                      <Label>Geç Kalma (dk)</Label>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {daily.lateMinutes ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200/70 px-3 py-2">
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
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                  Bu tarih için kayıt yok.
                </div>
              )}
          </Card>
        </div>
      </div>
      
      {/* Terminate Modal (return'un en altına taşındı) */}
      {showTerminate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">İşten Çıkar</div>
                <div className="text-sm text-zinc-600">
                  Çıkış tarihi verildiğinde istihdam dönemi kapanır ve kurumsal temizlik kuralları uygulanır.
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
                <span className="text-sm text-zinc-700">Çıkış Tarihi (opsiyonel)</span>
                <Input
                  type="date"
                  value={terminateEndDate}
                  onChange={(e) => setTerminateEndDate(e.target.value)}
                />
                <span className="text-xs text-zinc-500">Boş bırakılırsa bugün uygulanır.</span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">Sebep (opsiyonel)</span>
                <Input
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  placeholder="İstifa / İşten çıkarma / vb."
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
                {savingAction === "TERMINATE" ? "Kaydediliyor…" : "Onayla ve Çıkar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rehire Modal (return'un en altına taşındı) */}
      {showRehire ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">Yeniden İşe Al</div>
                <div className="text-sm text-zinc-600">
                  Başlangıç tarihi ile yeni bir istihdam dönemi açılır (çakışma kontrolü vardır).
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
                <span className="text-sm text-zinc-700">İşe Başlangıç Tarihi (opsiyonel)</span>
                <Input
                  type="date"
                  value={rehireStartDate}
                  onChange={(e) => setRehireStartDate(e.target.value)}
                />
                <span className="text-xs text-zinc-500">Boş bırakılırsa bugün uygulanır.</span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">Sebep (opsiyonel)</span>
                <Input
                  value={rehireReason}
                  onChange={(e) => setRehireReason(e.target.value)}
                  placeholder="Yeni sözleşme / tekrar işe giriş / vb."
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
                {savingAction === "REHIRE" ? "Kaydediliyor…" : "Onayla ve İşe Al"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Eksik-4: Employment History + HR Actions (Audit Log) */}
      <div className="grid gap-5 lg:grid-cols-12 max-w-full min-w-0">
        <div className="lg:col-span-6 min-w-0">
          <Card
            title="İstihdam Geçmişi"
            description="EmploymentPeriod kayıtları (validity aralıkları)"
          >
            {employmentPeriods.length === 0 ? (
              <div className="text-sm text-zinc-500">Kayıt yok.</div>
            ) : (
              <div className="grid gap-2">
                {employmentPeriods.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-zinc-200/70 bg-white px-4 py-3"
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
                        created: {fmt(p.createdAt)} • updated: {fmt(p.updatedAt)}
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
            title="HR Aksiyonları (Audit Log)"
            description="EmployeeAction kayıtları ve terminate cleanup özeti"
          >
            {actions.length === 0 ? (
              <div className="text-sm text-zinc-500">Kayıt yok.</div>
            ) : (
              <div className="grid gap-2">
                {actions.map((a) => {
                  const cleanup = a?.details?.cleanup ?? null;
                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border border-zinc-200/70 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900">
                            {trActionType(a.type)} • {String(a.effectiveDate).slice(0, 10)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            oluşturma: {fmt(a.createdAt)}
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
                        <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200/60">
                          <div className="text-xs font-semibold text-zinc-700">
                             Çıkış Sonrası Temizlik Özeti
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

      {/* Manual Adjustment */}
      <Card
        title="Manuel Düzeltme"
        description="Seçilen gün için alanları düzenleyin"
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
          <div className="text-sm text-zinc-500">Yükleniyor…</div>
        ) : (
          <div className="grid gap-4">
            {/* Show a badge if any override values are provided */}
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

            <div className="rounded-xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200/60">
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                 checked={otSplitMode}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setOtSplitMode(v);
                    if (v) {
                     // Split mode: clear total override (mutually exclusive)
                      setAdjustment((a) => ({ ...a, overtimeMinutesOverride: "" }));
                    } else {
                      // Total mode: clear split overrides
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
                    <Input
                      type="number"
                      value={adjustment.overtimeEarlyMinutesOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          overtimeEarlyMinutesOverride: e.target.value,
                        }))
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>OT Late Override</Label>
                    <Input
                      type="number"
                      value={adjustment.overtimeLateMinutesOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          overtimeLateMinutesOverride: e.target.value,
                        }))
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="grid gap-1.5">
                <Label>Overtime Minutes Override</Label>
                <Input
                type="number"
                value={adjustment.overtimeMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    overtimeMinutesOverride: e.target.value,
                  }))
                }
                placeholder="Leave blank for none"
              />
            </label>
              <label className="grid gap-1.5">
                <Label>Late Minutes Override</Label>
                <Input
                type="number"
                value={adjustment.lateMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    lateMinutesOverride: e.target.value,
                  }))
                }
                placeholder="Leave blank for none"
              />
            </label>
              <label className="grid gap-1.5">
                <Label>Early Leave Minutes Override</Label>
                <Input
                type="number"
                value={adjustment.earlyLeaveMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    earlyLeaveMinutesOverride: e.target.value,
                  }))
               }
                placeholder="Leave blank for none"
              />
            </label>
            </div>

            <label className="grid gap-1.5">
              <Label>Note</Label>
              <Input
                type="text"
                value={adjustment.note}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    note: e.target.value,
                  }))
                }
                placeholder="Optional note"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={saveAdjustment} disabled={savingAdjustment}>
                {savingAdjustment ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button
                onClick={clearAdjustment}
                disabled={savingAdjustment}
                variant="secondary"
              >
                {savingAdjustment ? "Temizleniyor…" : "Temizle"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Events tables */}
      <div className="grid gap-5 lg:grid-cols-2 max-w-full min-w-0">
        <Card title="Raw Events" description="Ham geçiş kayıtları">
          {loadingData ? (
            <div className="text-sm text-zinc-500">Yükleniyor…</div>
          ) : rawEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
              Kayıt yok.
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full min-w-0">
              <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500">
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">When</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Dir</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Source</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Door</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2">Device</th>
                </tr>
              </thead>
              <tbody>
                {rawEvents.map((ev) => (
                  <tr key={ev.id} className="text-sm text-zinc-900">
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-800">
                      {fmt(ev.occurredAt)}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4">
                      <Badge tone="info">{ev.direction}</Badge>
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-700">
                      {ev.source}
                    </td>
                    <td className="border-b border-zinc-100 py-2 pr-4 text-zinc-700">
                      {ev.door ? `${ev.door.code} - ${ev.door.name}` : "—"}
                    </td>
                    <td className="border-b border-zinc-100 py-2 text-zinc-700">
                      {ev.device ? ev.device.name : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <Card title="Normalized Events" description="Normalize edilmiş kayıtlar">
          {loadingData ? (
            <div className="text-sm text-zinc-500">Yükleniyor…</div>
          ) : normEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
              Kayıt yok.
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full min-w-0">
              <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500">
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">When</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Dir</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Status</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {normEvents.map((ev) => (
                  <tr key={ev.id} className="text-sm text-zinc-900">
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-800">
                      {fmt(ev.occurredAt)}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4">
                      <Badge tone="info">{ev.direction}</Badge>
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-700">
                      {ev.status}
                    </td>
                    <td className="border-b border-zinc-100 py-2 text-zinc-700">
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
        title="Manuel Geçiş Ekle"
        description="Eksik kayıt için manuel giriş/çıkış ekleyin"
      >
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
              {savingManual ? "Kaydediliyor…" : "Create Event"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
