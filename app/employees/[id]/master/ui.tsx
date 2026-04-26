"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EmployeeDetailSubnav from "../_components/EmployeeDetailSubnav";
import EmployeeAsOfDateControl from "../_components/EmployeeAsOfDateControl";
import EmployeeHistoryDialog from "../_components/EmployeeHistoryDialog";
import VersionedEditModalShell from "../_components/VersionedEditModalShell";
import { employeeCardScopeTerms } from "@/src/features/employees/cardScopeTerminology";
import type { EmployeeMasterDisplayResolvedConfiguration } from "@/src/features/employees/employeeMasterDisplayConfiguration";
import type { EmployeeMasterHistoryDisplayResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import type { EmployeeMasterHistoryFormResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryFormConfiguration";
import type { EmployeeMasterHistoryListResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryListConfiguration";
import type { EmployeeMasterFormResolvedConfiguration } from "@/src/features/employees/employeeMasterFormConfiguration";
import {
  EmployeeMasterProfileEditDraft,
  buildEmployeeMasterProfileEditDraft,
  humanizeEmployeeMasterProfileEditValidation,
  normalizeEmployeeMasterProfileEditDraft,
  toEmployeeMasterProfileEditPayload,
  validateEmployeeMasterProfileEditDraft,
} from "@/src/features/employees/masterProfileEditForm";

type MasterResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      cardNo: string | null;
      email: string | null;
      nationalId: string | null;
      phone: string | null;
      gender: string | null;
      isActive: boolean;
      hiredAt: string | null;
      terminatedAt: string | null;
    };
    history: {
      dayKey: string;
      todayDayKey: string;
      isHistorical: boolean;
      canEdit: boolean;
      mode: "AS_OF" | "CURRENT";
      profileSource: string;
      orgSource: string;
    };
    today: {
      dayKey: string;
      shift: unknown;
      policyRuleSet: unknown | null;
      lastEvent: unknown | null;
    };
    last7Days: {
      from: string;
      to: string;
      presentDays: number;
      offDays: number;
      leaveDays: number;
      absentDays: number;
      anomalyDays: number;
      anomalyCounts: Record<string, number>;
      totals: {
        lateMinutes: number;
        earlyLeaveMinutes: number;
        workedMinutes: number;
        overtimeMinutes: number;
      };
      days: Array<unknown>;
    };
  };
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <div className="grid gap-0.5">
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          {props.subtitle ? <div className="text-xs text-zinc-500">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="p-3.5">{props.children}</div>
    </div>
  );
}

function Badge(props: { tone?: "ok" | "warn" | "info" | "muted"; children: React.ReactNode }) {
  const tone = props.tone ?? "muted";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-zinc-50 text-zinc-700 ring-zinc-200";

  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", cls)}>{props.children}</span>;
}

function EditIconButton(props: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25"
      title={props.label}
      aria-label={props.label}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
        <path
          d="M5 18.8h3.3L18.6 8.5a1.9 1.9 0 1 0-2.7-2.7L5.6 16.1 5 18.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m14.3 7.4 2.3 2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function KV(props: { k: string; v?: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.k}</div>
      <div className="text-sm text-zinc-900">{props.v ?? <span className="text-zinc-400">—</span>}</div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function formatGender(value: string | null | undefined) {
  if (!value) return "—";
  if (value === "MALE") return "Erkek";
  if (value === "FEMALE") return "Kadın";
  if (value === "OTHER") return "Diğer";
  if (value === "UNSPECIFIED") return "Belirtilmedi";
  return value;
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/25";

function normalizeEightDigitIdentifierInput(value: string) {
  return value.replace(/\D+/g, "").slice(0, 8);
}

function formatEightDigitIdentifier(value: string) {
  const digits = normalizeEightDigitIdentifierInput(value);
  return digits ? digits.padStart(8, "0") : "";
}

function normalizeNationalIdInput(value: string) {
  return value.replace(/\D+/g, "").slice(0, 11);
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D+/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 4) return digits;

  const area = digits.slice(0, 4);
  const first = digits.slice(4, 7);
  const second = digits.slice(7, 9);
  const third = digits.slice(9, 11);

  let formatted = `(${area})`;
  if (first) formatted += ` ${first}`;
  if (second) formatted += ` ${second}`;
  if (third) formatted += ` ${third}`;
  return formatted;
}

function normalizeEmailInput(value: string) {
  return value.trim();
}

type MasterEditFieldName =
  | "scopeStartDate"
  | "employeeCode"
  | "cardNo"
  | "firstName"
  | "lastName"
  | "nationalId"
  | "email"
  | "phone";

type MasterEditFieldErrors = Partial<Record<MasterEditFieldName, string>>;

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function buildMasterEditFieldErrors(args: {
  draft: EmployeeMasterProfileEditDraft;
  visibleFields: EmployeeMasterFormResolvedConfiguration["fields"];
}): MasterEditFieldErrors {
  const errors: MasterEditFieldErrors = {};
  const scopeStartDate = String(args.draft.scopeStartDate ?? "").trim();
  const employeeCode = String(args.draft.employeeCode ?? "").trim();
  const cardNo = String(args.draft.cardNo ?? "").trim();
  const firstName = String(args.draft.firstName ?? "").trim();
  const lastName = String(args.draft.lastName ?? "").trim();
  const nationalId = String(args.draft.nationalId ?? "").trim();
  const email = String(args.draft.email ?? "").trim();
  const phoneDigits = String(args.draft.phone ?? "").replace(/\D+/g, "");

  if (!scopeStartDate) {
    errors.scopeStartDate = "Bu alan zorunludur.";
  } else if (!isValidIsoDate(scopeStartDate)) {
    errors.scopeStartDate = "Geçerli bir tarih seçin.";
  }

  if (!employeeCode) {
    errors.employeeCode = "Bu alan zorunludur.";
  } else if (!/^\d{8}$/.test(employeeCode)) {
    errors.employeeCode = "Sicil No 8 haneli rakam olmalıdır.";
  }

  if (cardNo && !/^\d{8}$/.test(cardNo)) {
    errors.cardNo = "Kart ID 8 haneli rakam olmalıdır.";
  }

  if (!firstName) errors.firstName = "Bu alan zorunludur.";
  if (!lastName) errors.lastName = "Bu alan zorunludur.";

  if (nationalId && !/^\d{11}$/.test(nationalId)) {
    errors.nationalId = "TC Kimlik 11 haneli olmalıdır.";
  }

  if (args.visibleFields.email.isVisible && email && !isValidEmail(email)) {
    errors.email = "E-posta formatı geçersiz.";
  }

  if (args.visibleFields.phone.isVisible && phoneDigits && phoneDigits.length !== 11) {
    errors.phone = "Telefon numarası geçersiz.";
  }

  return errors;
}

const defaultMasterFormFieldVisibility: EmployeeMasterFormResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
};

const defaultMasterDisplayFieldVisibility: EmployeeMasterDisplayResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
};

const defaultMasterHistoryDisplayFieldVisibility: EmployeeMasterHistoryDisplayResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
};

function parseApiErrorText(text: string): string | null {
  const s = String(text ?? "").trim();
  if (!s) return null;
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    } catch {
      return s;
    }
  }
  return s;
}

function humanizeMasterEditError(value: string) {
  const fallback = "Bilgiler kaydedilemedi. Lütfen alanları kontrol edin.";
  const known = humanizeEmployeeMasterProfileEditValidation(value);
  if (known !== fallback) return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    EMPLOYEE_CODE_TAKEN: "Bu sicil no başka bir çalışanda kullanılıyor.",
    CARD_NO_TAKEN: "Bu Kart ID başka bir çalışanda kullanılıyor.",
    UNIQUE_CONSTRAINT: "Sicil no veya Kart ID başka bir kayıtta kullanılıyor.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

function MasterProfileField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onBlur?: () => void;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search" | "email" | "url" | "none";
  maxLength?: number;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-slate-800">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        className={cx(
          inputClass,
          props.error ? "border-rose-300 bg-rose-50/70 focus:border-rose-300 focus:ring-rose-500/20" : undefined
        )}
        type={props.type ?? "text"}
        value={props.value}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
      />
      {props.error ? <span className="text-xs font-medium text-rose-600">{props.error}</span> : null}
    </label>
  );
}

export default function EmployeeMasterClient(props: {
  id: string;
  masterDisplayConfiguration: EmployeeMasterDisplayResolvedConfiguration;
  masterFormConfiguration: EmployeeMasterFormResolvedConfiguration;
  masterHistoryDisplayConfiguration: EmployeeMasterHistoryDisplayResolvedConfiguration;
  masterHistoryFormConfiguration: EmployeeMasterHistoryFormResolvedConfiguration;
  masterHistoryListConfiguration: EmployeeMasterHistoryListResolvedConfiguration;
}) {
  const {
    id,
    masterDisplayConfiguration,
    masterFormConfiguration,
    masterHistoryDisplayConfiguration,
    masterHistoryFormConfiguration,
    masterHistoryListConfiguration,
  } = props;
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<MasterResponse["item"] | null>(null);
  const [editSourceItem, setEditSourceItem] = useState<MasterResponse["item"] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EmployeeMasterProfileEditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<MasterEditFieldErrors>({});

  async function fetchMasterItem(targetAsOf = "") {
    const qs = targetAsOf ? `?asOf=${encodeURIComponent(targetAsOf)}` : "";
    const res = await fetch(`/api/employees/${id}/master${qs}`, { credentials: "include" });
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      throw new Error(txt || "Failed to load");
    }
    const json = (await res.json()) as MasterResponse;
    return json.item;
  }

  async function load(targetAsOf: string = asOf) {
    setLoading(true);
    setErr(null);
    try {
      const latestPromise = targetAsOf
        ? fetchMasterItem("").catch(() => null)
        : Promise.resolve<MasterResponse["item"] | null>(null);
      const [viewItem, latestItem] = await Promise.all([fetchMasterItem(targetAsOf), latestPromise]);
      setData(viewItem);
      setEditSourceItem(latestItem ?? viewItem);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
      setEditSourceItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, asOf]);

  const fullName = useMemo(() => {
    if (!data?.employee) return "";
    return `${data.employee.firstName} ${data.employee.lastName}`.trim();
  }, [data]);

  const visibleMasterFields =
    data?.history.mode === "CURRENT"
      ? (masterFormConfiguration?.fields ?? defaultMasterFormFieldVisibility)
      : defaultMasterFormFieldVisibility;

  const visibleMasterDisplayFields =
    data?.history.mode === "CURRENT"
      ? (masterDisplayConfiguration?.fields ?? defaultMasterDisplayFieldVisibility)
      : defaultMasterDisplayFieldVisibility;

  const visibleMasterHistoryConfiguration =
    data?.history.mode === "CURRENT"
      ? masterHistoryDisplayConfiguration
      : {
          screenKey: "employees.master.history" as const,
          fields: defaultMasterHistoryDisplayFieldVisibility,
        };

  function openMasterEditModal() {
    const sourceItem = asOf ? editSourceItem : data;
    if (!sourceItem?.employee) return;
    setEditDraft(
      buildEmployeeMasterProfileEditDraft({
        source: sourceItem.employee,
        scopeStartDate: sourceItem.history.todayDayKey,
      }),
    );
    setEditNotice(null);
    setEditFieldErrors({});
    setEditOpen(true);
  }

  async function saveMasterEditModal() {
    if (!editDraft) return;
    const normalized = normalizeEmployeeMasterProfileEditDraft(editDraft);
    const nextFieldErrors = buildMasterEditFieldErrors({
      draft: normalized,
      visibleFields: visibleMasterFields,
    });
    if (Object.keys(nextFieldErrors).length > 0) {
      setEditDraft(normalized);
      setEditFieldErrors(nextFieldErrors);
      setEditNotice(null);
      return;
    }

    const validationCode = validateEmployeeMasterProfileEditDraft(normalized);
    if (validationCode) {
      setEditDraft(normalized);
      setEditFieldErrors({});
      setEditNotice({ kind: "error", text: humanizeEmployeeMasterProfileEditValidation(validationCode) });
      return;
    }

    setEditSaving(true);
    setEditFieldErrors({});
    setEditNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/master`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toEmployeeMasterProfileEditPayload(normalized)),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(text) ?? res.statusText);
      setEditOpen(false);
      setEditDraft(null);
      setEditFieldErrors({});
      await load("");
      if (asOf) {
        router.replace(pathname, { scroll: false });
      }
    } catch (error) {
      setEditNotice({
        kind: "error",
        text: humanizeMasterEditError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Yüklenemedi</div>
        <div className="mt-1 break-words">{err}</div>
        <button
          className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-50"
          onClick={() => {
            void load();
          }}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-sm text-zinc-500">Veri yok.</div>;

  const e = data.employee;

  return (
    <div className="-mt-3 md:-mt-4 grid gap-2.5">
      <EmployeeDetailSubnav id={id} current="master" hideHistoryTrigger />

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xl font-semibold text-zinc-900">{fullName || "—"}</div>
              <Badge tone={e.isActive ? "ok" : "warn"}>{e.isActive ? "Aktif" : "Pasif"}</Badge>
              <div className="ml-1 flex items-center gap-2">
                <EmployeeHistoryDialog
                  employeeId={id}
                  current="master"
                  variant="icon"
                  canEdit={data.history.canEdit}
                  source={data.employee}
                  masterHistoryDisplayConfiguration={
                    visibleMasterHistoryConfiguration
                  }
                  masterHistoryFormConfiguration={masterHistoryFormConfiguration}
                  masterHistoryListConfiguration={masterHistoryListConfiguration}
                  onChanged={() => {
                    void load();
                  }}
                />
                <EditIconButton onClick={openMasterEditModal} label="Kimlik bilgilerini düzenle" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span>{employeeCardScopeTerms.masterPageSubtitle}</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <EmployeeAsOfDateControl history={data.history} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Kimlik ve İletişim Bilgileri" subtitle="Personelin temel kimlik ve iletişim bilgileri">
            <div className="grid gap-3 sm:grid-cols-2">
              <KV k="Sicil No" v={e.employeeCode || "—"} />
              <KV k="Kart ID" v={e.cardNo || "—"} />
              <KV k="Ad" v={e.firstName || "—"} />
              <KV k="Soyad" v={e.lastName || "—"} />
              <KV k="TC Kimlik" v={e.nationalId || "—"} />
              {visibleMasterDisplayFields.gender.isVisible ? (
                <KV k="Cinsiyet" v={formatGender(e.gender)} />
              ) : null}
              {visibleMasterDisplayFields.email.isVisible ? (
                <KV k="E-posta" v={e.email || "—"} />
              ) : null}
              {visibleMasterDisplayFields.phone.isVisible ? (
                <KV k="Telefon" v={e.phone || "—"} />
              ) : null}
            </div>
          </Card>
        </div>

        <Card
          title={employeeCardScopeTerms.masterSectionTitle}
          subtitle={employeeCardScopeTerms.masterSectionSubtitle}
        >
          <div className="grid gap-3">
            <KV k={employeeCardScopeTerms.startDateLabel} v={formatDate(e.hiredAt)} />
            <KV k={employeeCardScopeTerms.endDateLabel} v={formatDate(e.terminatedAt)} />
            <KV
              k="Kayıt Durumu"
              v={
                e.isActive ? (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone="ok">Aktif</Badge>
                    <span className="text-zinc-600">Aktif çalışan kaydı</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone="warn">Pasif</Badge>
                    <span className="text-zinc-600">Pasif Çalışan Kaydı</span>
                  </span>
                )
              }
            />
            <KV
              k={employeeCardScopeTerms.summaryLabel}
              v={
                e.terminatedAt ? (
                  <span className="text-zinc-700">{employeeCardScopeTerms.summaryEnded}</span>
                ) : e.hiredAt ? (
                  <span className="text-zinc-700">{employeeCardScopeTerms.summaryStarted}</span>
                ) : (
                  <span className="text-zinc-500">{employeeCardScopeTerms.summaryEmpty}</span>
                )
              }
            />
          </div>
        </Card>

      </div>

      <VersionedEditModalShell
        open={editOpen && Boolean(editDraft)}
        title="Kimlik ve iletişim bilgilerini düzenle"
        subtitle="Bu işlem mevcut kaydı ezmez; seçtiğiniz tarihten başlayan yeni bir sürüm oluşturur."
        saving={editSaving}
        onClose={() => {
          if (editSaving) return;
          setEditOpen(false);
          setEditDraft(null);
          setEditFieldErrors({});
          setEditNotice(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                setEditOpen(false);
                setEditDraft(null);
                setEditFieldErrors({});
                setEditNotice(null);
              }}
              disabled={editSaving}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={saveMasterEditModal}
              disabled={editSaving || !editDraft}
            >
              {editSaving ? "Kaydediliyor..." : "Yeni sürüm olarak kaydet"}
            </button>
          </>
        }
      >
        {editDraft ? (
          <div className="grid gap-5">

            {editNotice ? (
              <div
                className={cx(
                  "rounded-2xl border px-4 py-3 text-sm",
                  editNotice.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800",
                )}
              >
                {editNotice.text}
              </div>
            ) : null}

            <div className="grid gap-4 md:w-1/2">
              <MasterProfileField
                label="Geçerlilik başlangıcı"
                type="date"
                required
                value={editDraft.scopeStartDate}
                onChange={(value) => setEditDraft((prev) => (prev ? { ...prev, scopeStartDate: value } : prev))}
                error={editFieldErrors.scopeStartDate}
              />
              </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MasterProfileField
                label="Sicil No"
                required
                value={editDraft.employeeCode}
                placeholder="Sicil no"
                inputMode="numeric"
                maxLength={8}
                onChange={(value) =>
                  setEditDraft((prev) => (prev ? { ...prev, employeeCode: normalizeEightDigitIdentifierInput(value) } : prev))
                }
                onBlur={() =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, employeeCode: formatEightDigitIdentifier(prev.employeeCode) } : prev
                  )
                }
                error={editFieldErrors.employeeCode}
              />
              <MasterProfileField
                label="Kart ID"
                value={editDraft.cardNo}
                placeholder="Kart kimliği"
                inputMode="numeric"
                maxLength={8}
                onChange={(value) =>
                  setEditDraft((prev) => (prev ? { ...prev, cardNo: normalizeEightDigitIdentifierInput(value) } : prev))
                }
                onBlur={() =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, cardNo: formatEightDigitIdentifier(prev.cardNo) } : prev
                  )
                }
                error={editFieldErrors.cardNo}
              />
              <MasterProfileField
                label="Ad"
                required
                value={editDraft.firstName}
                placeholder="Çalışan adı"
                onChange={(value) => setEditDraft((prev) => (prev ? { ...prev, firstName: value } : prev))}
                error={editFieldErrors.firstName}
              />
              <MasterProfileField
                label="Soyad"
                required
                value={editDraft.lastName}
                placeholder="Çalışan soyadı"
                onChange={(value) => setEditDraft((prev) => (prev ? { ...prev, lastName: value } : prev))}
                error={editFieldErrors.lastName}
              />
              <MasterProfileField
                label="TC Kimlik"
                value={editDraft.nationalId}
                placeholder="11 haneli TC Kimlik"
                inputMode="numeric"
                maxLength={11}
                onChange={(value) =>
                  setEditDraft((prev) => (prev ? { ...prev, nationalId: normalizeNationalIdInput(value) } : prev))
                }
                error={editFieldErrors.nationalId}
              />
              {visibleMasterFields.gender.isVisible ? (
                <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Cinsiyet</span>
                <select
                  className={inputClass}
                  value={editDraft.gender}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, gender: event.target.value } : prev))}
                >
                  <option value="">Seçilmedi</option>
                  <option value="MALE">Erkek</option>
                  <option value="FEMALE">Kadın</option>
                  <option value="OTHER">Diğer</option>
                  <option value="UNSPECIFIED">Belirtilmedi</option>
                </select>
                </label>
              ) : null}
              {visibleMasterFields.email.isVisible ? (
                <MasterProfileField
                label="E-posta"
                type="email"
                value={editDraft.email}
                placeholder="ornek@firma.com"
                onChange={(value) => setEditDraft((prev) => (prev ? { ...prev, email: value } : prev))}
                onBlur={() =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, email: normalizeEmailInput(prev.email) } : prev
                  )
                }
                error={editFieldErrors.email}
              />
              ) : null}
              {visibleMasterFields.phone.isVisible ? (
                <MasterProfileField
                label="Telefon"
                type="tel"
                value={editDraft.phone}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                maxLength={16}
                onChange={(value) =>
                  setEditDraft((prev) => (prev ? { ...prev, phone: formatPhoneInput(value) } : prev))
                }
                onBlur={() =>
                  setEditDraft((prev) => (prev ? { ...prev, phone: formatPhoneInput(prev.phone) } : prev))
                }
                error={editFieldErrors.phone}
              />
              ) : null}
            </div>
          </div>
        ) : null}
      </VersionedEditModalShell>
    </div>
  );
}
