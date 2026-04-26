"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ReactNode } from "react";
import type { EmployeeCreateFormResolvedConfiguration } from "@/src/features/employees/employeeCreateFormConfiguration";
import { notifyEmployeesListChanged } from "@/src/features/employees/employeeListSync";
import {
  createInitialEmployeeCreateForm,
  createResetEmployeeCreateForm,
  resolveEmployeeCodeInputModeForPrefill,
  type EmployeeCodeInputMode,
} from "@/src/features/employees/employeeCreateFormState";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChipLink({
  href,
  title,
  children,
  className,
}: {
  href: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-blue-400/40",
        className
      )}
    >
      {children}
    </a>
  );
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
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

function RequiredMark() {
  return (
    <span className="ml-1 font-semibold text-rose-600" aria-hidden="true">
      *
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
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/65 pb-4">
          <div className="min-w-0 flex-1">
            {title ? <div className="text-lg font-bold text-slate-950 leading-tight tracking-tight">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-slate-600 font-medium leading-relaxed">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0 self-start">{right}</div> : null}
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
    secondary: "border border-slate-200/80 bg-white/85 text-slate-700 backdrop-blur-sm hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-slate-950",
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
  // Source-of-truth for "today" derived from employment periods on server
  derivedIsActive: boolean;
  employment: { startDate: string | null; endDate: string | null };
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
};

type Notice = { kind: "success" | "error" | "info"; text: string };
type CreateExitIntent = "RETURN_LIST" | "CLOSE_TAB";

type CreatedEmployeePreview = {
  fullName: string;
  employeeCode: string;
  nationalId: string;
  gender: string;
  email: string;
  phone: string;
  cardNo: string;
  deviceUserId: string;
  branch: string;
  workSchedule: string;
  employeeGroup: string;
  employeeSubgroup: string;
  employmentStartDate: string;
  note: string;
};

const defaultCreateFormFieldVisibility: EmployeeCreateFormResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
  cardNo: { isVisible: true },
  deviceUserId: { isVisible: true },
};

function parseApiErrorText(t: string): string | null {
  // API bazen {"error":"CODE"} döndürüyor; bazen düz text.
  const s = (t ?? "").trim();
  if (!s) return null;
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const j = JSON.parse(s);
      if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      // ignore
    }
  }
  return s;
}

function humanizeError(codeOrText: string): string {
  const v = (codeOrText ?? "").trim();
  // Bilinen kodları Türkçeleştir
  const map: Record<string, string> = {
    EMPLOYEE_CODE_REQUIRED: "Çalışan kodu zorunludur.",
    EMPLOYEE_CODE_NUMERIC_ONLY: "Çalışan kodu yalnızca rakamlardan oluşmalıdır.",
    EMPLOYEE_CODE_TOO_LONG: "Çalışan kodu en fazla 8 haneli olabilir.",
    FIRST_NAME_REQUIRED: "Ad zorunludur.",
    LAST_NAME_REQUIRED: "Soyad zorunludur.",
    NATIONAL_ID_REQUIRED: "TC Kimlik zorunludur.",
    INVALID_NATIONAL_ID: "TC Kimlik 11 haneli olmalıdır.",
    INVALID_PHONE: "Telefon 10 haneli olmalıdır.",
    BRANCH_REQUIRED: "Lokasyon zorunludur.",
    INVALID_BRANCH_ID: "Seçilen lokasyon geçersiz veya pasif durumda.",
    WORK_SCHEDULE_REQUIRED: "Çalışma planı zorunludur.",
    INVALID_WORK_SCHEDULE_PATTERN_ID: "Seçilen çalışma planı geçersiz veya pasif durumda.",
    EMPLOYEE_GROUP_REQUIRED: "Grup zorunludur.",
      EMPLOYEE_SUBGROUP_REQUIRED: "Alt grup zorunludur.",
      INVALID_EMPLOYEE_GROUP_ID: "Seçilen grup geçersiz.",
      INVALID_EMPLOYEE_SUBGROUP_ID: "Seçilen alt grup geçersiz.",
      EMPLOYEE_SUBGROUP_GROUP_MISMATCH: "Seçilen alt grup, seçilen gruba bağlı değil.",
    PHONE_TOO_LONG: "Telefon en fazla 30 karakter olabilir.",
    INVALID_GENDER: "Cinsiyet değeri geçersiz.",
    CARD_NO_TAKEN: "Bu Kart ID başka bir çalışana atanmış.",
    DEVICE_USER_ID_TAKEN: "Bu cihaz kullanıcı numarası başka bir çalışana atanmış.",
    EMPLOYEE_CODE_TAKEN: "Bu çalışan kodu zaten kullanılıyor.",
    EMPLOYEE_CODE_ALREADY_EXISTS: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_DUPLICATE: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_UNIQUE: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_SEQUENCE_EXHAUSTED: "Yeni sicil numarası üretilemedi. 8 haneli sıra sınırına ulaşıldı.",
    EMPLOYEE_CODE_PREFILL_FAILED: "Sıradaki sicil otomatik getirilemedi. Gerekirse manuel giriş yapın.",
    INVALID_EMPLOYEE_CODE_MODE: "Sicil atama modu geçersiz.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
    INVALID_START_DATE: "Zaman kapsam başlangıcı geçersiz.",
    INVALID_END_DATE: "Çıkış tarihi geçersiz.",
    END_BEFORE_START: "Çıkış tarihi, işe giriş tarihinden önce olamaz.",
    CARD_NO_TOO_LONG: "Kart ID en fazla 100 karakter olabilir.",
    DEVICE_USER_ID_TOO_LONG: "Cihaz kullanıcı numarası en fazla 100 karakter olabilir.",
    NO_OPEN_EMPLOYMENT: "Açık istihdam kaydı bulunamadı (zaten pasif olabilir).",
    EMPLOYEE_NOT_FOUND: "Çalışan bulunamadı.",
    EMPLOYMENT_HISTORY_REQUIRED: "İşe geri alım için önce kapanmış bir istihdam geçmişi olmalıdır.",
    EMPLOYMENT_HISTORY_EXISTS: "Bu çalışan için zaten istihdam geçmişi var; ilk kayıt dışında HIRE yerine REHIRE kullanılmalıdır.",
      EMPLOYMENT_OVERLAP: "Bu tarihte çalışan zaten aktif görünüyor (çakışan kayıt var).",
    USE_TERMINATE_REHIRE: "Aktif/Pasif güncellemesi için kapsam dönemi işlemlerini kullanın.",
  };
  if (map[v]) return map[v];
  // Prisma/DB unique benzeri durumları yakala (backend özel kod dönmüyorsa)
  const upper = v.toUpperCase();
  if (
    upper.includes("P2002") ||
    upper.includes("UNIQUE CONSTRAINT") ||
    upper.includes("UNIQUE") ||
    upper.includes("DUPLICATE") ||
    upper.includes("ALREADY EXISTS")
  ) {
    return "Bu çalışan kodu zaten kayıtlı. Farklı bir kod deneyin.";
  }
  // Düz text gelirse olduğu gibi ama aşırı teknikse yumuşat
  if (v.startsWith("Prisma") || v.includes("ECONN")) return "Sunucu hatası oluştu. Lütfen tekrar deneyin.";
  return v;
}

function isLikelyEmail(v: string) {
  const s = v.trim();
  if (!s) return true; // optional
  // Basit ve yeterli bir kontrol
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isLikelyNationalId(v: string) {
  const s = v.trim();
  if (!s) return true; // optional
  return /^\d{11}$/.test(s);
}

function normalizeCreatePhoneInput(v: string) {
  const digits = String(v ?? "").replace(/\D+/g, "");
  if (!digits) return "";

  let local = digits;
  if (local.startsWith("90") && local.length >= 12) {
    local = local.slice(2);
  }
  if (local.startsWith("0") && local.length >= 11) {
    local = local.slice(1);
  }
  return local.slice(0, 10);
}

function formatCreatePhoneInput(v: string) {
  const digits = normalizeCreatePhoneInput(v);
  if (!digits) return "";

  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean);

  return parts.join(" ");
}

function isLikelyCreatePhone(v: string) {
  const digits = normalizeCreatePhoneInput(v);
  return !digits || digits.length === 10;
}

function normalizeCreateEmployeeCodeInput(v: string) {
  return String(v ?? "")
    .replace(/\D+/g, "")
    .slice(0, 8);
}

function normalizeCreateCardNoInput(v: string) {
  return String(v ?? "")
    .replace(/\D+/g, "")
    .slice(0, 8);
}

function formatCreateEmployeeCode(v: string) {
  const digits = normalizeCreateEmployeeCodeInput(v);
  if (!digits) return "";
  return digits.padStart(8, "0");
}

function formatCreateCardNo(v: string) {
  const digits = normalizeCreateCardNoInput(v);
  if (!digits) return "";
  return digits.padStart(8, "0");
}

function isISODate(v: string): boolean {
  // yyyy-MM-dd
  return /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());
}

function normSort(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function cmpStr(a: string, b: string): number {
  // Türkçe locale ile düzgün sıralama (İ/ı vs.)
  return a.localeCompare(b, "tr-TR", { sensitivity: "base", numeric: true });
}

function fullNameKey(e: { firstName: string; lastName: string }) {
  return `${normSort(e.firstName)} ${normSort(e.lastName)}`.trim();
}

function formatCreatePreviewDate(value: string | null | undefined) {
  const v = String(value ?? "").trim();
  if (!v) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return v;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatCreatePreviewGender(value: string | null | undefined) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return "—";
  if (v === "MALE") return "Erkek";
  if (v === "FEMALE") return "Kadın";
  if (v === "OTHER") return "Diğer";
  if (v === "UNSPECIFIED") return "Belirtilmedi";
  return value ?? "—";
}

function formatCreatePreviewPhone(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("90") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `(0${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return raw;
}

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 break-words">{value || "—"}</div>
    </div>
  );
}

export default function EmployeesClient(props: {
  canWrite: boolean;
  canAccessImportWorkspace: boolean;
  createFormConfiguration: EmployeeCreateFormResolvedConfiguration;
  initialEmployeeCode: string;
}) {
  const router = useRouter();
  const allowCreateExitRef = useRef(false);
  const pendingCreateExitActionRef = useRef<null | (() => void)>(null);
  const { canWrite, canAccessImportWorkspace, createFormConfiguration } = props;
  const initialAutoEmployeeCode = formatCreateEmployeeCode(props.initialEmployeeCode);
  const [autoEmployeeCodeBaseline, setAutoEmployeeCodeBaseline] = useState(initialAutoEmployeeCode);
  const [employeeCodeInputMode, setEmployeeCodeInputMode] = useState<EmployeeCodeInputMode>(
    resolveEmployeeCodeInputModeForPrefill(initialAutoEmployeeCode),
  );
  const visibleCreateFields =
    createFormConfiguration?.fields ?? defaultCreateFormFieldVisibility;
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [q, setQ] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<"success" | "danger" | null>(null);
  const [sortBy, setSortBy] = useState<"CODE" | "NAME" | "STATUS">("CODE");
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [todayDayKey, setTodayDayKey] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [branches, setBranches] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);
  const [workSchedules, setWorkSchedules] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);
  const [employeeGroups, setEmployeeGroups] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [employeeSubgroups, setEmployeeSubgroups] = useState<
    Array<{ id: string; code: string; name: string; groupId: string; group?: { code: string; name: string } | null }>
  >([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBranchId, setBulkBranchId] = useState<string>(""); // "" => no selection, "CLEAR" => clear
  const [bulkBusy, setBulkBusy] = useState(false);

  const [branchFilter, setBranchFilter] = useState<string>(""); // "" all, "__NULL__" unassigned
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [applyMode, setApplyMode] = useState<"SELECTED" | "FILTERED">("FILTERED");
  const [branchStats, setBranchStats] = useState<
    Array<{
      branchId: string | null;
      branch: { id: string; code: string; name: string } | null;
      count: number;
    }>
  >([]);

  const [form, setForm] = useState(() =>
    createInitialEmployeeCreateForm({
      employeeCode: initialAutoEmployeeCode,
    }),
  );

  const [employmentAction, setEmploymentAction] = useState<null | { mode: "TERMINATE" | "REHIRE"; employee: Employee }>(null);
  const [employmentActionDate, setEmploymentActionDate] = useState<string>("");
  const [employmentActionReason, setEmploymentActionReason] = useState<string>("");
  const [createdPreview, setCreatedPreview] = useState<CreatedEmployeePreview | null>(null);
  const [pendingCreateExitIntent, setPendingCreateExitIntent] = useState<CreateExitIntent | null>(null);
  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  function flash(kind: Notice["kind"], text: string, ms = 2500) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

  const normalized = useMemo(() => {
    return {
      employeeCode: formatCreateEmployeeCode(form.employeeCode),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      nationalId: form.nationalId.trim(),
      gender: form.gender.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      cardNo: normalizeCreateCardNoInput(form.cardNo),
      deviceUserId: form.deviceUserId.trim(),
      branchId: form.branchId.trim(),
      workSchedulePatternId: form.workSchedulePatternId.trim(),
      employeeGroupId: form.employeeGroupId.trim(),
      employeeSubgroupId: form.employeeSubgroupId.trim(),
      employmentStartDate: (form.employmentStartDate || "").trim(),
      employmentReason: (form.employmentReason || "").trim(),
    };
  }, [
    form.employeeCode,
    form.firstName,
    form.lastName,
    form.nationalId,
    form.gender,
    form.email,
    form.phone,
    form.cardNo,
    form.deviceUserId,
    form.branchId,
    form.workSchedulePatternId,
    form.employeeGroupId,
    form.employeeSubgroupId,
    form.employmentStartDate,
    form.employmentReason,
  ]);

  const locationOptions = useMemo(() => {
    return [...branches]
      .filter((b) => b.isActive)
      .sort((a, b) => {
        const byCode = cmpStr(normSort(a.code), normSort(b.code));
        if (byCode !== 0) return byCode;
        return cmpStr(normSort(a.name), normSort(b.name));
      });
  }, [branches]);

  const workScheduleOptions = useMemo(() => {
    return [...workSchedules]
      .filter((p) => p.isActive)
      .sort((a, b) => {
        const byCode = cmpStr(normSort(a.code), normSort(b.code));
        if (byCode !== 0) return byCode;
        return cmpStr(normSort(a.name), normSort(b.name));
      });
  }, [workSchedules]);

  const employeeGroupOptions = useMemo(() => {
    return [...employeeGroups].sort((a, b) => {
      const byCode = cmpStr(normSort(a.code), normSort(b.code));
      if (byCode !== 0) return byCode;
      return cmpStr(normSort(a.name), normSort(b.name));
    });
  }, [employeeGroups]);

  const employeeSubgroupOptions = useMemo(() => {
    const groupId = normalized.employeeGroupId;
    if (!groupId) return [];
    return [...employeeSubgroups]
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => {
        const byCode = cmpStr(normSort(a.code), normSort(b.code));
        if (byCode !== 0) return byCode;
        return cmpStr(normSort(a.name), normSort(b.name));
      });
  }, [employeeSubgroups, normalized.employeeGroupId]);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!normalized.employeeCode) e.employeeCode = "Çalışan kodu zorunludur.";
    if (!normalized.firstName) e.firstName = "Ad zorunludur.";
    if (!normalized.lastName) e.lastName = "Soyad zorunludur.";
    if (!normalized.nationalId) e.nationalId = "TC Kimlik zorunludur.";
    else if (!isLikelyNationalId(normalized.nationalId)) e.nationalId = "TC Kimlik 11 haneli olmalıdır.";
    if (!normalized.branchId) e.branchId = "Lokasyon zorunludur.";
    if (!isLikelyEmail(normalized.email)) e.email = "E-posta formatı geçersiz.";
    if (!isLikelyCreatePhone(normalized.phone)) e.phone = "Telefon 10 haneli olmalıdır.";
    if (!normalized.workSchedulePatternId) e.workSchedulePatternId = "Çalışma planı zorunludur.";
    if (!normalized.employeeGroupId) e.employeeGroupId = "Grup zorunludur.";
    if (!normalized.employeeSubgroupId) e.employeeSubgroupId = "Alt grup zorunludur.";
    if (normalized.cardNo && !/^\d{1,8}$/.test(normalized.cardNo)) e.cardNo = "Kart ID yalnızca rakam olmalı ve en fazla 8 haneli olabilir.";
    if (normalized.employmentStartDate && !isISODate(normalized.employmentStartDate)) {
      e.employmentStartDate = "İşe başlama tarihi geçersiz (yyyy-AA-gg).";
    }
    if (normalized.deviceUserId.length > 100) e.deviceUserId = "Cihaz kullanıcı numarası en fazla 100 karakter olabilir.";
    return e;
  }, [normalized]);

  const canCreate = useMemo(() => {
    return canWrite && Object.keys(fieldErrors).length === 0 && !loading;
  }, [canWrite, fieldErrors, loading]);

  const hasUnsavedCreateDraft = useMemo(() => {
    return Boolean(
      (form.employeeCode.trim() && form.employeeCode.trim() !== autoEmployeeCodeBaseline) ||
      form.firstName.trim() ||
      form.lastName.trim() ||
      form.nationalId.trim() ||
      form.gender.trim() ||
      form.email.trim() ||
      form.phone.trim() ||
      form.cardNo.trim() ||
      form.deviceUserId.trim() ||
      form.branchId.trim() ||
      form.workSchedulePatternId.trim() ||
      form.employeeGroupId.trim() ||
      form.employeeSubgroupId.trim() ||
      form.employmentReason.trim() ||
      (form.employmentStartDate.trim() && form.employmentStartDate.trim() !== todayDayKey)
    );
  }, [
    form.branchId,
    form.cardNo,
    form.deviceUserId,
    form.email,
    form.employeeCode,
    form.employeeGroupId,
    form.employeeSubgroupId,
    form.employmentReason,
    form.employmentStartDate,
    form.firstName,
    form.gender,
    autoEmployeeCodeBaseline,
    form.lastName,
    form.nationalId,
    form.phone,
    form.workSchedulePatternId,
    todayDayKey,
  ]);

  function requestCreateDraftExit(intent: CreateExitIntent, action: () => void) {
    if (!hasUnsavedCreateDraft) {
      action();
      return;
    }
    pendingCreateExitActionRef.current = action;
    setPendingCreateExitIntent(intent);
  }

  function closeCreateDraftExitModal() {
    pendingCreateExitActionRef.current = null;
    setPendingCreateExitIntent(null);
  }

  function confirmCreateDraftExitModal() {
    const action = pendingCreateExitActionRef.current;
    pendingCreateExitActionRef.current = null;
    setPendingCreateExitIntent(null);
    action?.();
  }

  async function fetchNextEmployeeCodeFromServer(): Promise<string> {
    const res = await fetch("/api/employees/next-code", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new Error(parseApiErrorText(raw) ?? "EMPLOYEE_CODE_PREFILL_FAILED");
    }

    const json = await res.json().catch(() => null);
    return formatCreateEmployeeCode(String(json?.employeeCode ?? ""));
  }

  async function resolveNextEmployeeCodePrefill(options?: {
    silent?: boolean;
  }): Promise<string> {
    try {
      return await fetchNextEmployeeCodeFromServer();
    } catch (error) {
      if (!options?.silent) {
        const codeOrText =
          error instanceof Error ? error.message : "EMPLOYEE_CODE_PREFILL_FAILED";
        flash("info", humanizeError(codeOrText));
      }
      return "";
    }
  }

  function applyCreateFormAutoFill(nextEmployeeCode: string) {
    const normalizedNextEmployeeCode = formatCreateEmployeeCode(nextEmployeeCode);
    setAutoEmployeeCodeBaseline(normalizedNextEmployeeCode);
    setEmployeeCodeInputMode(
      resolveEmployeeCodeInputModeForPrefill(normalizedNextEmployeeCode),
    );
    setForm(
      createResetEmployeeCreateForm({
        employeeCode: normalizedNextEmployeeCode,
        todayDayKey,
      }),
    );
    setTouched({});
    setNotice(null);
  }

  async function resetCreateForm() {
    const nextEmployeeCode = await resolveNextEmployeeCodePrefill();
    applyCreateFormAutoFill(nextEmployeeCode);
  }

  function updateEmployeeCodeFromUserInput(rawValue: string) {
    setEmployeeCodeInputMode("MANUAL");
    setForm((prev) => ({
      ...prev,
      employeeCode: normalizeCreateEmployeeCodeInput(rawValue),
    }));
  }

  function cancelCreateAndCloseTab() {
    requestCreateDraftExit("CLOSE_TAB", () => {
      allowCreateExitRef.current = true;
      window.close();
      window.setTimeout(() => {
        router.replace("/employees");
      }, 120);
    });
  }

  function returnToEmployeeList() {
    requestCreateDraftExit("RETURN_LIST", () => {
      router.push("/employees");
    });
  }

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowCreateExitRef.current) return;
      if (!hasUnsavedCreateDraft) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedCreateDraft]);

  async function refresh() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("status", statusFilter);
      if (branchFilter) sp.set("branchId", branchFilter);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));

      const res = await fetch(`/api/employees?${sp.toString()}`, { credentials: "include" });
      const json = await res.json();
      setItems(json.items ?? []);
      setNotice(null);

      setTotal(Number(json?.meta?.total ?? 0) || 0);
      setTotalPages(Number(json?.meta?.totalPages ?? 1) || 1);

      // Branch stats (summary panel)
      try {
        const sRes = await fetch("/api/employees/branch/stats", { credentials: "include" });
        const sJson = await sRes.json().catch(() => null);
        setBranchStats(Array.isArray(sJson?.items) ? sJson.items : []);
      } catch {
        setBranchStats([]);
      }

      // 4.2) Load branches (Org/Branches)
      // Branch listesi olmadan dropdown çalışmaz. Buradan tek noktadan çekiyoruz.
      try {
        const bRes = await fetch("/api/org/branches", { credentials: "include" });
        const bJson = await bRes.json().catch(() => null);
        // Bazı endpoint'ler {items:[]} döndürebilir; bazıları direkt [] döndürebilir.
        const arr = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.items) ? bJson.items : [];
        setBranches(arr);
      } catch {
        // UI-only; branch listesi yüklenmezse sadece branch seçimi çalışmaz.
        setBranches([]);
      }
      try {
        await fetch("/api/policy/work-schedules/ensure-defaults", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // no-op; list call below still tries to load whatever exists
      }
      try {
        const wsRes = await fetch("/api/policy/work-schedules", { credentials: "include" });
        const wsJson = await wsRes.json().catch(() => null);
        const arr = Array.isArray(wsJson) ? wsJson : Array.isArray(wsJson?.items) ? wsJson.items : [];
        setWorkSchedules(arr);
      } catch {
        setWorkSchedules([]);
      }
      try {
        const [gRes, sgRes] = await Promise.all([
          fetch("/api/workforce/groups", { credentials: "include" }),
          fetch("/api/workforce/subgroups", { credentials: "include" }),
        ]);
        const gJson = await gRes.json().catch(() => null);
        const sgJson = await sgRes.json().catch(() => null);
        const groupsArr = Array.isArray(gJson) ? gJson : Array.isArray(gJson?.items) ? gJson.items : [];
        const subgroupsArr = Array.isArray(sgJson) ? sgJson : Array.isArray(sgJson?.items) ? sgJson.items : [];
        setEmployeeGroups(groupsArr);
        setEmployeeSubgroups(subgroupsArr);
      } catch {
        setEmployeeGroups([]);
        setEmployeeSubgroups([]);
      }
      const dk = String(json?.meta?.todayDayKey ?? "").trim();
      if (dk && isISODate(dk)) {
        setTodayDayKey(dk);
        setForm((s) => ({ ...s, employmentStartDate: s.employmentStartDate || dk }));
      } else {
        // fallback: keep local today
        setForm((s) => ({ ...s, employmentStartDate: s.employmentStartDate || todayDayKey }));
      }
    } finally {
      setLoading(false);
    }
  }

  // 4.3) Satır bazında branch değiştir handler
  async function setEmployeeBranch(employeeId: string, branchId: string | null) {
    if (!canWrite) {
      return; // RBAC: avoid forbidden POST + toast/flicker
    }
    try {
      const res = await fetch(`/api/employees/${employeeId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Branch güncellenemedi.";
        flash("error", humanizeError(codeOrText));
        return;
      }
      await refresh();
     flash("success", "Branch güncellendi.");
    } catch {
      flash("error", "Branch güncellenemedi.");
    }
  }

  // 4.3) Bulk branch apply (selected[] -> branchId / clear)
  async function applyBulkBranch() {
    if (!canWrite) {
      return; // RBAC: avoid forbidden POST + toast/flicker
    }
    const ids = applyMode === "SELECTED" ? Object.keys(selected).filter((k) => selected[k]) : [];
    if (applyMode === "SELECTED" && ids.length === 0) {
      flash("info", "Toplu işlem için önce çalışan seç (veya Mod: Filtrelenmişler seç).");
      return;
    }
    if (!bulkBranchId) {
      flash("info", "Toplu işlem için Branch seç.");
      return;
    }

    setBulkBusy(true);
    try {
      const branchId = bulkBranchId === "CLEAR" ? null : bulkBranchId;
      // FILTERED modunda server'a filtreleri de gönderiyoruz (ids göndermiyoruz)
      const payload =
        applyMode === "SELECTED"
          ? { employeeIds: ids, branchId }
          : {
              employeeIds: [], // ignored by server in FILTERED mode (faz-5.1.1)
              branchId,
              filter: { q: q.trim(), status: statusFilter, branchId: branchFilter || null },
            };

      const res = await fetch("/api/employees/branch/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        flash("error", humanizeError(j?.error ?? "Toplu işlem başarısız."));
        return;
      }

      setSelected({});
      setBulkBranchId("");
      await refresh();
      flash("success", `Toplu güncellendi: ${j?.updatedCount ?? ids.length} kişi`);
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, branchFilter, page, pageSize]);

  // filtre değişince sayfayı 1'e çek (q/status/branchFilter)
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, branchFilter, pageSize]);

  async function createEmployee() {
    if (!canWrite) {
      return; // RBAC: avoid forbidden POST + toast/flicker
    }
    // Client-side validation
    setTouched({
      employeeCode: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      gender: true,
      email: true,
      phone: true,
      cardNo: true,
      deviceUserId: true,
      workSchedulePatternId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      branchId: true,
      employmentStartDate: true,
    });
    if (Object.keys(fieldErrors).length > 0) {
      flash("error", "Lütfen zorunlu alanları doldurun.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeCodeMode: employeeCodeInputMode,
          employeeCode: normalized.employeeCode,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          nationalId: normalized.nationalId || null,
          gender: normalized.gender || null,
          email: normalized.email || null,
          phone: normalized.phone || null,
          cardNo: normalized.cardNo || null,
          deviceUserId: normalized.deviceUserId || null,
          branchId: normalized.branchId || null,
          workSchedulePatternId: normalized.workSchedulePatternId,
          employeeGroupId: normalized.employeeGroupId,
          employeeSubgroupId: normalized.employeeSubgroupId,
          employmentStartDate: normalized.employmentStartDate || todayDayKey,
          employmentReason: normalized.employmentReason || null,
        }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Çalışan oluşturulamadı.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      const createdPayload = await res.json().catch(() => null);
      const createdItem = createdPayload?.item ?? null;
      const selectedBranch = branches.find((branch) => branch.id === normalized.branchId) ?? null;
      const selectedWorkSchedule = workSchedules.find((pattern) => pattern.id === normalized.workSchedulePatternId) ?? null;
      const selectedEmployeeGroup = employeeGroups.find((group) => group.id === normalized.employeeGroupId) ?? null;
      const selectedEmployeeSubgroup = employeeSubgroups.find((subgroup) => subgroup.id === normalized.employeeSubgroupId) ?? null;

      const preview: CreatedEmployeePreview = {
        fullName: `${createdItem?.firstName ?? normalized.firstName} ${createdItem?.lastName ?? normalized.lastName}`.trim() || "—",
        employeeCode: String(createdItem?.employeeCode ?? normalized.employeeCode ?? "").trim() || "—",
        nationalId: String(createdItem?.nationalId ?? normalized.nationalId ?? "").trim() || "—",
        gender: formatCreatePreviewGender(createdItem?.gender ?? normalized.gender ?? null),
        email: String(createdItem?.email ?? normalized.email ?? "").trim() || "—",
        phone: formatCreatePreviewPhone(createdItem?.phone ?? normalized.phone ?? null),
        cardNo: String(createdItem?.cardNo ?? normalized.cardNo ?? "").trim() || "—",
        deviceUserId: String(createdItem?.deviceUserId ?? normalized.deviceUserId ?? "").trim() || "—",
        branch: selectedBranch ? `${selectedBranch.code} — ${selectedBranch.name}` : "—",
        workSchedule: selectedWorkSchedule ? `${selectedWorkSchedule.code} — ${selectedWorkSchedule.name}` : "—",
        employeeGroup: selectedEmployeeGroup ? `${selectedEmployeeGroup.code} — ${selectedEmployeeGroup.name}` : "—",
        employeeSubgroup: selectedEmployeeSubgroup ? `${selectedEmployeeSubgroup.code} — ${selectedEmployeeSubgroup.name}` : "—",
        employmentStartDate: formatCreatePreviewDate(normalized.employmentStartDate || todayDayKey),
        note: String(normalized.employmentReason ?? "").trim() || "—",
      };

      setFlashKind("success");
      notifyEmployeesListChanged();
      await refresh();
      const nextEmployeeCode = await resolveNextEmployeeCodePrefill({ silent: true });
      applyCreateFormAutoFill(nextEmployeeCode);
      // yeni eklenen satırı vurgula
      setFlashRowId(String(createdItem?.employeeCode ?? normalized.employeeCode ?? "").trim());
      setTimeout(() => setFlashRowId(null), 1500);
      setTimeout(() => setFlashKind(null), 1500);
      setCreatedPreview(preview);
      flash("success", "Çalışan oluşturuldu.");
    } finally {
      setLoading(false);
    }
  }

  function openTerminate(e: Employee) {
    if (!canWrite) return; // RBAC
    setEmploymentAction({ mode: "TERMINATE", employee: e });
    setEmploymentActionDate(todayDayKey);
    setEmploymentActionReason("");
  }

  function openRehire(e: Employee) {
    if (!canWrite) return; // RBAC
    setEmploymentAction({ mode: "REHIRE", employee: e });
    setEmploymentActionDate(todayDayKey);
    setEmploymentActionReason("");
  }

  function closeEmploymentModal() {
    setEmploymentAction(null);
    setEmploymentActionDate("");
    setEmploymentActionReason("");
  }

  async function submitEmploymentAction() {
    if (!employmentAction) return;
    if (!canWrite) {
      return; // RBAC: avoid forbidden POST + toast/flicker
    }

    const date = (employmentActionDate || "").trim();
    if (!isISODate(date)) {
      flash("error", "Tarih geçersiz (yyyy-AA-gg).");
      return;
    }

    setLoading(true);
    try {
      const employeeId = employmentAction.employee.id;
      const endpoint =
        employmentAction.mode === "TERMINATE"
          ? `/api/employees/${employeeId}/terminate`
          : `/api/employees/${employeeId}/rehire`;

      const body =
        employmentAction.mode === "TERMINATE"
          ? { endDate: date, reason: employmentActionReason?.trim() || null }
          : { startDate: date, reason: employmentActionReason?.trim() || null };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "İşlem başarısız.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      closeEmploymentModal();
      await refresh();
      setFlashRowId(employeeId);
      setFlashKind(employmentAction.mode === "TERMINATE" ? "danger" : "success");
      setTimeout(() => setFlashRowId(null), 1200);
      setTimeout(() => setFlashKind(null), 1200);

      flash(
        "success",
        employmentAction.mode === "TERMINATE"
          ? `Çıkış işlemi uygulandı. (${date})`
          : `İşe alım işlemi uygulandı. (${date})`,
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => {
      if (sortBy === "CODE") {
        return cmpStr(normSort(a.employeeCode), normSort(b.employeeCode));
      }
      if (sortBy === "NAME") {
        return cmpStr(fullNameKey(a), fullNameKey(b));
      }
      // STATUS: Aktifler üstte, eşitse koda göre
      const sa = a.derivedIsActive ? 0 : 1;
      const sb = b.derivedIsActive ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return cmpStr(normSort(a.employeeCode), normSort(b.employeeCode));
    });
    return arr;
  }, [items, sortBy]);

  return (
    <div className="grid w-full max-w-full animate-in gap-4 overflow-x-hidden px-1 pb-2 pt-1 fade-in duration-500 md:px-2 md:pb-4 md:pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.86))] px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Çalışan Çalışma Alanı
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            Yeni çalışan kaydı
          </div>
        </div>

        <button
          type="button"
          onClick={returnToEmployeeList}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:border-indigo-300 hover:bg-indigo-50/60"
          title="Çalışan listesine dön"
        >
          <IconChevronLeft className="h-4 w-4" />
          <span>Çalışan listesine dön</span>
        </button>
      </div>
      {!canWrite ? (
        <div className="rounded-2xl border border-amber-300/55 bg-[linear-gradient(135deg,rgba(254,243,199,0.9),rgba(255,251,235,0.92))] p-4 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-900">Read-only</div>
              <div className="mt-1 text-sm text-amber-800">
               Bu ekranda çalışan kayıt/şube/durum işlemleri için yetkin yok. Listeyi görüntüleyebilir ve filtreleyebilirsin.
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
              Yetki: OPS_WRITE gerekli
            </span>
          </div>
        </div>
      ) : null}

      <Card
        className="rounded-[24px] border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,255,0.94))] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-6"
        tone="violet"
        title={loading ? <Badge tone="info">Yükleniyor…</Badge> : undefined}
      >
        {notice && (
          <div
            className={
              "mt-3 rounded-xl border px-3 py-2 text-sm " +
              (notice.kind === "error"
                ? "border-rose-200 bg-rose-50/90 text-rose-800"
                : notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                  : "border-indigo-200 bg-indigo-50/80 text-indigo-950")
            }
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Çalışan Kodu
              <RequiredMark />
            </span>
            <input
            inputMode="numeric"
              maxLength={8}
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.employeeCode && fieldErrors.employeeCode
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200/80 bg-white/88")
              }
              value={form.employeeCode}
              disabled={!canWrite || loading}
              onBlur={() => {
                setTouched((s) => ({ ...s, employeeCode: true }));
                setForm((prev) => ({
                  ...prev,
                  employeeCode: formatCreateEmployeeCode(prev.employeeCode),
                }));
              }}
              onChange={(ev) => updateEmployeeCodeFromUserInput(ev.target.value)}
              placeholder="00000001"
            />
            {touched.employeeCode && fieldErrors.employeeCode && (
              <span className="text-xs text-red-700">{fieldErrors.employeeCode}</span>
            )}
          </label>

          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Ad
              <RequiredMark />
            </span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.firstName && fieldErrors.firstName ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.firstName}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, firstName: true }))}
              onChange={(ev) => setForm({ ...form, firstName: ev.target.value })}
              placeholder="Çalışan adı"
            />
            {touched.firstName && fieldErrors.firstName && (
              <span className="text-xs text-red-700">{fieldErrors.firstName}</span>
            )}
          </label>

          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Soyad
              <RequiredMark />
            </span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.lastName && fieldErrors.lastName ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.lastName}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, lastName: true }))}
              onChange={(ev) => setForm({ ...form, lastName: ev.target.value })}
              placeholder="Çalışan soyadı"
            />
            {touched.lastName && fieldErrors.lastName && (
              <span className="text-xs text-red-700">{fieldErrors.lastName}</span>
            )}
          </label>
          
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              TC Kimlik
              <RequiredMark />
            </span>
            <input
              inputMode="numeric"
              maxLength={11}
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.nationalId && fieldErrors.nationalId ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.nationalId}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, nationalId: true }))}
              onChange={(ev) =>
                setForm({
                  ...form,
                  nationalId: ev.target.value.replace(/\D+/g, "").slice(0, 11),
                })
              }
              placeholder="11 haneli TC Kimlik"
            />
            {touched.nationalId && fieldErrors.nationalId && (
              <span className="text-xs text-red-700">{fieldErrors.nationalId}</span>
            )}
          </label>

          {visibleCreateFields.gender.isVisible ? (
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">Cinsiyet</span>
            <select
              className="rounded-xl border border-slate-200/80 bg-white/88 px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
              value={form.gender}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, gender: true }))}
              onChange={(ev) => setForm({ ...form, gender: ev.target.value })}
            >
              <option value="">Seçilmedi</option>
              <option value="MALE">Erkek</option>
              <option value="FEMALE">Kadın</option>
              <option value="OTHER">Diğer</option>
              <option value="UNSPECIFIED">Belirtilmedi</option>
            </select>
          </label>
          ) : null}

          {visibleCreateFields.email.isVisible ? (
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">E-posta</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.email && fieldErrors.email ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.email}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              placeholder="ornek@firma.com"
            />
            {touched.email && fieldErrors.email && (
              <span className="text-xs text-red-700">{fieldErrors.email}</span>
            )}
          </label>
          ) : null}
          
          {visibleCreateFields.phone.isVisible ? (
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">Telefon</span>
            <div
              className={
                "flex items-center rounded-xl border px-3 py-2 text-sm shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-300 " +
                (touched.phone && fieldErrors.phone ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
            >
              <span className="shrink-0 text-sm font-semibold text-slate-500">(0)</span>
              <input
                inputMode="numeric"
                className="min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                value={formatCreatePhoneInput(form.phone)}
                disabled={!canWrite || loading}
                onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
                onChange={(ev) =>
                  setForm({
                    ...form,
                    phone: normalizeCreatePhoneInput(ev.target.value),
                  })
                }
                placeholder="5xx xxx xx xx"
              />
            </div>
            {touched.phone && fieldErrors.phone && (
              <span className="text-xs text-red-700">{fieldErrors.phone}</span>
            )}
          </label>
          ) : null}

          {visibleCreateFields.cardNo.isVisible ? (
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">Kart ID</span>
            <input
              inputMode="numeric"
              maxLength={8}
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.cardNo && fieldErrors.cardNo ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.cardNo}
              disabled={!canWrite || loading}
              onBlur={() => {
                setTouched((s) => ({ ...s, cardNo: true }));
                setForm((prev) => ({
                  ...prev,
                  cardNo: formatCreateCardNo(prev.cardNo),
                }));
              }}
              onChange={(ev) => setForm({ ...form, cardNo: normalizeCreateCardNoInput(ev.target.value) })}
              placeholder="8 haneli kart no"
            />
            {touched.cardNo && fieldErrors.cardNo && <span className="text-xs text-red-700">{fieldErrors.cardNo}</span>}
          </label>
          ) : null}

          {visibleCreateFields.deviceUserId.isVisible ? (
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">Cihaz Kullanıcı No</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.deviceUserId && fieldErrors.deviceUserId ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.deviceUserId}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, deviceUserId: true }))}
              onChange={(ev) => setForm({ ...form, deviceUserId: ev.target.value })}
              placeholder="Cihaz iç kullanıcı numarası"
            />
            {touched.deviceUserId && fieldErrors.deviceUserId && <span className="text-xs text-red-700">{fieldErrors.deviceUserId}</span>}
          </label>
          ) : null}
          
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Lokasyon
              <RequiredMark />
            </span>
            <select
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.branchId && fieldErrors.branchId ? "border-red-300 bg-red-50" : "border-slate-200/80 bg-white/88")
              }
              value={form.branchId}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, branchId: true }))}
              onChange={(ev) => setForm({ ...form, branchId: ev.target.value })}
            >
              <option value="">Lokasyon seçin</option>
              {locationOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} — {branch.name}
                </option>
              ))}
            </select>
            {touched.branchId && fieldErrors.branchId && (
              <span className="text-xs text-red-700">{fieldErrors.branchId}</span>
            )}
          </label>
          
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Çalışma Planı
              <RequiredMark />
            </span>
            <select
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.workSchedulePatternId && fieldErrors.workSchedulePatternId
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200/80 bg-white/88")
              }
              value={form.workSchedulePatternId}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, workSchedulePatternId: true }))}
              onChange={(ev) => setForm({ ...form, workSchedulePatternId: ev.target.value })}
            >
              <option value="">Çalışma planı seçin</option>
              {workScheduleOptions.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.code} — {pattern.name}
                </option>
              ))}
            </select>
            {touched.workSchedulePatternId && fieldErrors.workSchedulePatternId && (
              <span className="text-xs text-red-700">{fieldErrors.workSchedulePatternId}</span>
            )}
          </label>
          
          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Çalışan Grup
              <RequiredMark />
            </span>
            <select
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.employeeGroupId && fieldErrors.employeeGroupId
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200/80 bg-white/88")
              }
              value={form.employeeGroupId}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, employeeGroupId: true }))}
              onChange={(ev) => {
                const nextGroupId = ev.target.value;
                const subgroupStillValid = employeeSubgroups.some(
                  (sg) => sg.id === form.employeeSubgroupId && sg.groupId === nextGroupId,
                );
                setForm({
                  ...form,
                  employeeGroupId: nextGroupId,
                  employeeSubgroupId: subgroupStillValid ? form.employeeSubgroupId : "",
                });
              }}
            >
              <option value="">Grup seçin</option>
              {employeeGroupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} — {group.name}
                </option>
              ))}
            </select>
            {touched.employeeGroupId && fieldErrors.employeeGroupId && (
              <span className="text-xs text-red-700">{fieldErrors.employeeGroupId}</span>
            )}
          </label>

          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">
              Çalışan Alt Grup
              <RequiredMark />
            </span>
            <select
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.employeeSubgroupId && fieldErrors.employeeSubgroupId
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200/80 bg-white/88")
              }
              value={form.employeeSubgroupId}
              disabled={!canWrite || loading || !form.employeeGroupId}
              onBlur={() => setTouched((s) => ({ ...s, employeeSubgroupId: true }))}
              onChange={(ev) => setForm({ ...form, employeeSubgroupId: ev.target.value })}
            >
              <option value="">{form.employeeGroupId ? "Alt grup seçin" : "Önce grup seçin"}</option>
              {employeeSubgroupOptions.map((subgroup) => (
                <option key={subgroup.id} value={subgroup.id}>
                  {subgroup.code} — {subgroup.name}
                </option>
              ))}
            </select>
            {touched.employeeSubgroupId && fieldErrors.employeeSubgroupId && (
              <span className="text-xs text-red-700">{fieldErrors.employeeSubgroupId}</span>
            )}
          </label>

          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-slate-800">Başlangıç Tarihi</span>
            <input
              type="date"
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 " +
                (touched.employmentStartDate && fieldErrors.employmentStartDate
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200/80 bg-white/88")
              }
              value={form.employmentStartDate}
              disabled={!canWrite || loading}
              onBlur={() => setTouched((s) => ({ ...s, employmentStartDate: true }))}
              onChange={(ev) => setForm({ ...form, employmentStartDate: ev.target.value })}
            />
            {touched.employmentStartDate && fieldErrors.employmentStartDate && (
              <span className="text-xs text-red-700">{fieldErrors.employmentStartDate}</span>
            )}
          </label>

          <label className="grid gap-1 md:col-span-2 xl:col-span-4">
            <span className="text-sm font-medium text-zinc-800">Kayıt Notu</span>
            <input
              className={inputClass}
              value={form.employmentReason}
              disabled={!canWrite || loading}
              onChange={(ev) => setForm({ ...form, employmentReason: ev.target.value })}
              placeholder="Örn: ilk zaman kapsamı kaydı"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-600">
            {fullName ? (
              <>
                Oluşturulacak kayıt: <span className="font-bold text-indigo-700">{fullName}</span>
              </>
            ) : (
              "Lütfen bilgileri girin."
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={cancelCreateAndCloseTab}
              disabled={loading}
              title="Bu sekmeyi kapat ve çalışan listesine dön"
              className="min-w-[110px]"
            >
              İptal
            </Button>

            <Button
              variant="secondary"
              onClick={resetCreateForm}
              disabled={loading}
              title="Formu temizle"
              className="min-w-[110px]"
            >
              Temizle
            </Button>

            <Button
              variant="primary"
              className="min-w-[220px] px-8 py-2.5 shadow-indigo-200"
              disabled={!canCreate}
              onClick={createEmployee}
              title={!canWrite ? "Read-only: çalışan oluşturma yetkin yok" : "Çalışan kaydını oluştur"}
            >
              {loading ? "Oluşturuluyor..." : "Çalışan Kaydını Oluştur"}
            </Button>
          </div>
        </div>
      </Card>
      
      {pendingCreateExitIntent ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-exit-modal-title"
            aria-describedby="create-exit-modal-description"
            className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/80">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div id="create-exit-modal-title" className="text-base font-bold text-slate-950">
                  {pendingCreateExitIntent === "CLOSE_TAB" ? "Bu sekme kapatılsın mı?" : "Sayfadan çıkılsın mı?"}
                </div>
                <div id="create-exit-modal-description" className="mt-1 text-sm leading-6 text-slate-600">
                  Kaydedilmemiş çalışan kayıt bilgileri silinecek.{" "}
                  {pendingCreateExitIntent === "CLOSE_TAB"
                    ? "Bu sekmeyi kapatmak istiyor musunuz?"
                    : "Çalışan listesine dönmek istiyor musunuz?"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={closeCreateDraftExitModal}
                className="min-w-[110px]"
              >
                Vazgeç
              </Button>

              <Button
                variant="primary"
                type="button"
                onClick={confirmCreateDraftExitModal}
                className="min-w-[150px]"
              >
                {pendingCreateExitIntent === "CLOSE_TAB" ? "Sekmeyi Kapat" : "Sayfadan Çık"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {createdPreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-employee-preview-title"
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.30)]"
          >
            <div className="border-b border-slate-200 pb-4">
              <div id="created-employee-preview-title" className="text-lg font-bold text-slate-950">
                Çalışan kaydı oluşturuldu
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Bilgi amaçlı önizleme
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PreviewField label="Çalışan Kodu" value={createdPreview.employeeCode} />
              <PreviewField label="Ad Soyad" value={createdPreview.fullName} />
              <PreviewField label="TC Kimlik" value={createdPreview.nationalId} />
              <PreviewField label="Cinsiyet" value={createdPreview.gender} />
              <PreviewField label="Telefon" value={createdPreview.phone} />
              <PreviewField label="E-posta" value={createdPreview.email} />
              <PreviewField label="Kart ID" value={createdPreview.cardNo} />
              <PreviewField label="Cihaz Kullanıcı No" value={createdPreview.deviceUserId} />
              <PreviewField label="Lokasyon" value={createdPreview.branch} />
              <PreviewField label="Çalışma Planı" value={createdPreview.workSchedule} />
              <PreviewField label="Grup" value={createdPreview.employeeGroup} />
              <PreviewField label="Alt Grup" value={createdPreview.employeeSubgroup} />
              <PreviewField label="Başlangıç Tarihi" value={createdPreview.employmentStartDate} />
              <div className="sm:col-span-2 xl:col-span-2">
                <PreviewField label="Kayıt Notu" value={createdPreview.note} />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setCreatedPreview(null)}>
                Yeni Çalışan Ekle
              </Button>
              <Link
                href="/employees"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Çalışan Listesine Dön
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
