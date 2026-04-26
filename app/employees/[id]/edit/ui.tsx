"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type DetailResponse = {
  item: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string | null;
    nationalId?: string | null;
    phone?: string | null;
    gender?: string | null;
    cardNo?: string | null;
    deviceUserId?: string | null;
    branchId?: string | null;
    branch?: { id: string; code: string; name: string } | null;
    employeeGroupId?: string | null;
    employeeGroup?: { id: string; code: string; name: string } | null;
    employeeSubgroupId?: string | null;
    employeeSubgroup?: { id: string; code: string; name: string; groupId: string } | null;
    isActive: boolean;
    hiredAt?: string | null;
    terminatedAt?: string | null;
    employmentPeriods: Array<{
      id: string;
      startDate: string | null;
      endDate: string | null;
      reason: string | null;
      createdAt: string;
    }>;
    actions: Array<{
      id: string;
      type: string;
      effectiveDate: string | null;
      note: string | null;
      actorUserId: string | null;
      createdAt: string;
      details: any;
    }>;
  };
};

type MasterResponse = {
  item: {
    today?: {
      shiftProfile?: {
        workSchedule?: {
          patternId: string;
          code: string;
          name: string;
          label: string;
        } | null;
      } | null;
    } | null;
  };
};

type Notice = { kind: "success" | "error" | "info"; text: string };

type WarningLevel = "W0" | "W1" | "W2" | "W3";

type ScopePreviewResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      fullName: string;
    };
    targetScope: {
      periodId: string;
      oldStartDate: string | null;
      oldEndDate: string | null;
      newStartDate: string | null;
      newEndDate: string | null;
      changedStartDate: boolean;
      changedEndDate: boolean;
    };
    impact: {
      startDate: string | null;
      endDate: string | null;
      dayCount: number;
      rawEventCount: number;
      firstRawEventAt: string | null;
      lastRawEventAt: string | null;
      dailyAttendanceCount: number;
      touchedClosedPeriods: Array<{ month: string; status: string }>;
    };
    warning: {
      level: WarningLevel;
      title: string;
      messages: string[];
      requiresConfirmation: boolean;
    };
    recomputeSuggestion: {
      suggested: boolean;
      rangeStart: string | null;
      rangeEnd: string | null;
    };
  };
};

type HardDeletePreviewResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string | null;
      isActive: boolean;
      activeToday: boolean;
      cardNo: string | null;
      deviceUserId: string | null;
      branch: { id: string; code: string; name: string } | null;
      employeeGroup: { id: string; code: string; name: string } | null;
      employeeSubgroup: { id: string; code: string; name: string } | null;
      recentEmploymentPeriods: Array<{
        id: string;
        startDate: string | null;
        endDate: string | null;
        reason: string | null;
      }>;
    };
    policy: {
      mode: "OPERATIONAL_HARD_DELETE";
      preservesHistoricalLedger: boolean;
      previewGeneratedAt: string;
      timezone: string;
      todayDayKey: string;
    };
    counts: {
      operationalDelete: {
        employmentPeriods: number;
        employeeActions: number;
        rawEvents: number;
        normalizedEvents: number;
        dailyAttendances: number;
        attendanceOwnershipAudits: number;
        dailyAdjustments: number;
        employeeLeaves: number;
        weeklyShiftPlans: number;
        integrationEmployeeLinks: number;
        integrationLeaveLinks: number;
        integrationWeeklyShiftPlanLinks: number;
        policyAssignments: number;
        shiftPolicyAssignments: number;
        workScheduleAssignments: number;
      };
      detachOnly: {
        resolvedDeviceInboxRefs: number;
      };
      preserveHistoricalLedger: {
        payrollSnapshotEmployeeRows: number;
        payrollSnapshotCodeRows: number;
        payrollAuditEvents: number;
      };
    };
    ranges: {
      rawEvents:
        | {
            fromOccurredAt: string | null;
            toOccurredAt: string | null;
          }
        | null;
      dailyAttendance:
        | {
            fromWorkDate: string | null;
            toWorkDate: string | null;
          }
        | null;
    };
    payrollImpact: {
      touchedPeriods: Array<{ month: string; status: string }>;
      touchedPeriodCount: number;
      auditMonths: string[];
    };
    operationalImpact: {
      touchedMonths: string[];
      touchedPeriodCount: number;
      touchedOpenPeriods: Array<{ month: string; status: string }>;
      touchedPreClosedPeriods: Array<{ month: string; status: string }>;
      requiresExplicitOverride: boolean;
      title: string;
      message: string;
    };
    recommendation: {
      shouldSuggestTerminateFirst: boolean;
      severity: "NONE" | "ADVISORY";
      title: string | null;
      message: string | null;
      actions: {
        terminateFirst: string | null;
      };
    };
    warning: {
      level: WarningLevel;
      title: string;
      messages: string[];
    };
  };
};

type FormState = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  gender: string;
  email: string;
  phone: string;
  cardNo: string;
  deviceUserId: string;
  branchId: string;
  workSchedulePatternId: string;
  employeeGroupId: string;
  employeeSubgroupId: string;
  scopeStartDate: string;
  scopeEndDate: string;
  scopeNote: string;
};

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300";

function Card(props: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="grid gap-1">
          <div className="text-lg font-semibold text-slate-950">{props.title}</div>
          {props.subtitle ? <div className="text-sm text-slate-600">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_16px_30px_rgba(79,70,229,0.22)] hover:brightness-105"
      : variant === "danger"
        ? "bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_16px_30px_rgba(225,29,72,0.24)] hover:brightness-105"
      : variant === "ghost"
        ? "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100"
        : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/60";
  return <button className={cx(base, styles, className)} {...props} />;
}

function Badge(props: { tone?: "ok" | "warn" | "danger" | "muted"; children: React.ReactNode }) {
  const tone = props.tone ?? "muted";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "danger"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-50 text-slate-700 ring-slate-200";
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", cls)}>{props.children}</span>;
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-700">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        className={inputClass}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <textarea
        className={cx(inputClass, "min-h-[100px] resize-y")}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 4}
      />
    </label>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function trActionType(value: string) {
  switch (String(value ?? "").trim()) {
    case "HIRE":
      return "Kapsama Alındı";
    case "REHIRE":
      return "Yeni Kapsam Açıldı";
    case "TERMINATE":
      return "Kapsam Sonlandırıldı";
    case "UPDATE":
      return "Güncellendi";
    default:
      return value;
  }
}

function parseApiErrorText(t: string): string | null {
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

function levelTone(level: WarningLevel) {
  switch (level) {
    case "W3":
      return "danger";
    case "W2":
      return "warn";
    case "W1":
      return "warn";
    default:
      return "ok";
  }
}

function levelBoxClass(level: WarningLevel) {
  switch (levelTone(level)) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-900";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
}

function normalizeDateOrNull(v: string) {
  const s = v.trim();
  return s || null;
}

function humanizeError(codeOrText: string): string {
  const v = (codeOrText ?? "").trim();
  const map: Record<string, string> = {
    ID_REQUIRED: "Çalışan kaydı bulunamadı.",
    EMPLOYEE_CODE_REQUIRED: "Çalışan kodu zorunludur.",
    FIRST_NAME_REQUIRED: "Ad zorunludur.",
    LAST_NAME_REQUIRED: "Soyad zorunludur.",
    INVALID_NATIONAL_ID: "TC Kimlik 11 haneli olmalıdır.",
    PHONE_TOO_LONG: "Telefon en fazla 30 karakter olabilir.",
    INVALID_GENDER: "Cinsiyet değeri geçersiz.",
    INVALID_BRANCH_ID: "Seçilen lokasyon geçersiz veya pasif durumda.",
    WORK_SCHEDULE_REQUIRED: "Çalışma planı zorunludur.",
    INVALID_WORK_SCHEDULE_PATTERN_ID: "Seçilen çalışma planı geçersiz veya pasif durumda.",
    EMPLOYEE_CODE_TAKEN: "Bu çalışan kodu zaten kullanılıyor.",
    CARD_NO_TAKEN: "Bu kart numarası başka bir çalışana ait.",
    DEVICE_USER_ID_TAKEN: "Bu cihaz kullanıcı numarası başka bir çalışana ait.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
    INVALID_START_DATE: "Kart aktivasyon tarihi geçersiz.",
    INVALID_END_DATE: "Kart iptal tarihi geçersiz.",
    START_DATE_REQUIRED: "Kart aktivasyon tarihi zorunludur.",
    END_BEFORE_START: "Kart iptal tarihi, aktivasyon tarihinden önce olamaz.",
    EMPLOYMENT_OVERLAP: "Seçilen tarih aralığı başka bir kapsam dönemi ile çakışıyor.",
    UNAUTHORIZED: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    EMPLOYEE_CODE_CONFIRM_REQUIRED: "Kalıcı silme için çalışan kodunu tekrar yazmanız gerekir.",
    EMPLOYEE_CODE_CONFIRM_MISMATCH: "Yazdığınız çalışan kodu uyuşmuyor.",
    HARD_DELETE_CONFIRMATION_REQUIRED: "Kalıcı silme ifadesi zorunludur.",
    HARD_DELETE_CONFIRMATION_MISMATCH: "Kalıcı silme onay ifadesi hatalı.",
    ACTIVE_SCOPE_DELETE_REQUIRES_OVERRIDE: "Çalışan bugün aktif kapsamda görünüyor. Hard delete için ayrıca aktif kapsam override onayı gerekir.",
    OPEN_PERIOD_IMPACT_REQUIRES_OVERRIDE: "Bu silme işlemi açık veya ön kapanış dönemlerini etkiliyor. Devam etmek için canlı dönem etkisi onayı gerekir.",
    PRESERVE_HISTORICAL_LEDGER_REQUIRED: "Bu işlem historical ledger korunarak çalışır. Bu güvenlik seçeneği kapatılamaz.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  if (map[v]) return map[v];
  if (v.toUpperCase().includes("P2002") || v.toUpperCase().includes("UNIQUE")) {
    return "Girilen değerlerden biri başka bir kayıtta zaten kullanılıyor.";
  }
  return v || "Kaydetme sırasında hata oluştu.";
}

function isLikelyEmail(v: string) {
  const s = v.trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isLikelyNationalId(v: string) {
  const s = v.trim();
  if (!s) return true;
  return /^\d{11}$/.test(s);
}

function ScopeWarningModal(props: {
  open: boolean;
  scopePreview: ScopePreviewResponse["item"] | null;
  scopeConfirmChecked: boolean;
  setScopeConfirmChecked: React.Dispatch<React.SetStateAction<boolean>>;
  savingScope: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { open, scopePreview, scopeConfirmChecked, setScopeConfirmChecked, savingScope, onClose, onConfirm } = props;

  if (!open || !scopePreview) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-xl">
      <div
        className={cx(
          "relative w-full max-w-2xl overflow-hidden rounded-[28px] border p-5 shadow-[0_28px_80px_rgba(15,23,42,0.45)]",
          scopePreview.warning.level === "W3"
            ? "border-red-300/70 bg-[linear-gradient(135deg,rgba(255,245,245,0.98)_0%,rgba(252,165,165,0.92)_55%,rgba(239,68,68,0.92)_100%)] text-red-950 ring-1 ring-white/55"
            : scopePreview.warning.level === "W2" || scopePreview.warning.level === "W1"
              ? "border-amber-300/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(254,240,138,0.92)_55%,rgba(245,158,11,0.92)_100%)] text-amber-950 ring-1 ring-white/55"
              : "border-emerald-300/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(209,250,229,0.92)_55%,rgba(110,231,183,0.88)_100%)] text-emerald-950 ring-1 ring-white/65"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 right-0 h-24 w-40 translate-y-8 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="pointer-events-none absolute right-4 top-4 h-16 w-16 rounded-2xl border border-white/20 bg-white/10 opacity-40 blur-[1px]" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge tone={scopePreview.warning.level === "W3" ? "warn" : scopePreview.warning.level === "W2" || scopePreview.warning.level === "W1" ? "warn" : "muted"}>
              Uyarı Seviyesi {scopePreview.warning.level}
            </Badge>
            <div className="text-xl font-semibold tracking-tight text-slate-950">{scopePreview.warning.title}</div>
            <div className={cx("rounded-2xl border px-4 py-3 text-sm", levelBoxClass(scopePreview.warning.level))}>
              {scopePreview.warning.messages.length > 0 ? (
                <ul className="grid gap-1.5">
                  {scopePreview.warning.messages.map((line, idx) => (
                    <li key={idx}>• {line}</li>
                  ))}
                </ul>
              ) : (
                <div>Bu değişiklik için etki oluşturan veri bulunmadı.</div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              setScopeConfirmChecked(false);
            }}
          >
            Kapat
          </Button>
        </div>

        <div className="relative mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm text-slate-700 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Eski Kapsam</div>
            <div className="mt-1 font-medium text-slate-900">
              {formatDate(scopePreview.targetScope.oldStartDate)} → {formatDate(scopePreview.targetScope.oldEndDate)}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Yeni Kapsam</div>
            <div className="mt-1 font-medium">
              {formatDate(scopePreview.targetScope.newStartDate)} → {formatDate(scopePreview.targetScope.newEndDate)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/40 bg-white/72 px-4 py-3 text-sm text-slate-700 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ham Zaman Verisi</div>
            <div className="mt-1 font-medium text-slate-900">{scopePreview.impact.rawEventCount} kayıt</div>
          </div>
          <div className="rounded-2xl border border-white/40 bg-white/72 px-4 py-3 text-sm text-slate-700 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">DailyAttendance Etkisi</div>
            <div className="mt-1 font-medium text-slate-900">{scopePreview.impact.dailyAttendanceCount} gün</div>
          </div>
        </div>

        {scopePreview.recomputeSuggestion.suggested ? (
          <div className="relative mt-4 rounded-2xl border border-white/45 bg-white/58 px-4 py-3 text-sm text-slate-800 backdrop-blur-sm">
            Önerilen recompute aralığı:{" "}
            <span className="font-semibold">
              {formatDate(scopePreview.recomputeSuggestion.rangeStart)} → {formatDate(scopePreview.recomputeSuggestion.rangeEnd)}
            </span>
          </div>
        ) : null}

        <label className="relative mt-5 flex items-start gap-3 rounded-2xl border border-white/45 bg-white/62 px-4 py-3 text-sm text-slate-800 backdrop-blur-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={scopeConfirmChecked}
            onChange={(e) => setScopeConfirmChecked(e.target.checked)}
          />
          <span>
            Bu değişikliğin geçmiş zaman verilerini etkileyebileceğini anladım. Gerekirse manuel olay girişi ve recompute işlemlerini ayrıca yürüteceğim.
          </span>
        </label>

        <div className="relative mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              setScopeConfirmChecked(false);
            }}
          >
            Vazgeç
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={!scopeConfirmChecked || savingScope}>
            {savingScope ? "Uygulanıyor…" : "Uyarıya Rağmen Uygula"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function sumOperationalDeleteCounts(
  counts: HardDeletePreviewResponse["item"]["counts"]["operationalDelete"],
) {
  return Object.values(counts).reduce((acc, v) => acc + Number(v || 0), 0);
}

function formatHardDeleteCountLabel(key: string) {
  const map: Record<string, string> = {
    employmentPeriods: "Kapsam Dönemleri",
    employeeActions: "Personel Aksiyonları",
    rawEvents: "Ham Zaman Olayları",
    normalizedEvents: "Normalize Edilmiş Olaylar",
    dailyAttendances: "Günlük Devam Sonuçları",
    attendanceOwnershipAudits: "Event Sahiplik Denetimleri",
    dailyAdjustments: "Günlük Düzeltmeler",
    employeeLeaves: "İzin Kayıtları",
    weeklyShiftPlans: "Haftalık Vardiya Planları",
    integrationEmployeeLinks: "Entegrasyon Personel Bağlantıları",
    integrationLeaveLinks: "Entegrasyon İzin Bağlantıları",
    integrationWeeklyShiftPlanLinks: "Entegrasyon Haftalık Plan Bağlantıları",
    policyAssignments: "Politika Atamaları",
    shiftPolicyAssignments: "Vardiya Politikası Atamaları",
    workScheduleAssignments: "Çalışma Takvimi Atamaları",
    resolvedDeviceInboxRefs: "Çözümlenmiş Cihaz Gelen Kutusu Referansları",
    payrollSnapshotEmployeeRows: "Payroll Snapshot Personel Satırları",
    payrollSnapshotCodeRows: "Payroll Snapshot Kod Satırları",
    payrollAuditEvents: "Payroll Denetim Olayları",
  };

  return map[key] ?? key;
}

function HardDeletePreviewModal(props: {
  open: boolean;
  preview: HardDeletePreviewResponse["item"] | null;
  loading: boolean;
  confirmEmployeeCode: string;
  setConfirmEmployeeCode: React.Dispatch<React.SetStateAction<string>>;
  confirmationText: string;
  setConfirmationText: React.Dispatch<React.SetStateAction<string>>;
  acknowledgeChecked: boolean;
  setAcknowledgeChecked: React.Dispatch<React.SetStateAction<boolean>>;
  allowActiveScopeDelete: boolean;
  setAllowActiveScopeDelete: React.Dispatch<React.SetStateAction<boolean>>;
  allowOperationalPeriodImpactDelete: boolean;
  setAllowOperationalPeriodImpactDelete: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const {
    open,
    preview,
    loading,
    confirmEmployeeCode,
    setConfirmEmployeeCode,
    confirmationText,
    setConfirmationText,
    acknowledgeChecked,
    setAcknowledgeChecked,
    allowActiveScopeDelete,
    setAllowActiveScopeDelete,
    allowOperationalPeriodImpactDelete,
    setAllowOperationalPeriodImpactDelete,
    onClose,
    onConfirm,
  } = props;

  if (!open || !preview) return null;

  const totalOperationalRows = sumOperationalDeleteCounts(preview.counts.operationalDelete);
  const needsActiveOverride = !!preview.recommendation?.shouldSuggestTerminateFirst;
  const needsOperationalImpactOverride = !!preview.operationalImpact?.requiresExplicitOverride;
  const confirmReady =
    acknowledgeChecked &&
    confirmEmployeeCode.trim() === preview.employee.employeeCode &&
    confirmationText.trim().toUpperCase() === "HARD DELETE" &&
    (!needsActiveOverride || allowActiveScopeDelete) &&
    (!needsOperationalImpactOverride || allowOperationalPeriodImpactDelete);

  const modal = (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-xl">
      <div className="flex min-h-full items-start justify-center py-4">
        <div className="relative w-full max-w-5xl overflow-y-auto rounded-[30px] border border-rose-300/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,241,242,0.96)_48%,rgba(254,205,211,0.92)_100%)] p-5 shadow-[0_30px_90px_rgba(15,23,42,0.42)] max-h-[calc(100vh-2rem)]">
        <div className="pointer-events-none absolute inset-0 opacity-75">
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute right-0 top-0 h-44 w-56 rounded-full bg-rose-200/45 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-36 w-44 rounded-full bg-amber-200/35 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="danger">Kalıcı Silme Önizlemesi</Badge>
              <Badge tone={preview.warning.level === "W3" ? "danger" : preview.warning.level === "W2" || preview.warning.level === "W1" ? "warn" : "ok"}>
                Uyarı Seviyesi {preview.warning.level}
              </Badge>
              {preview.employee.activeToday ? <Badge tone="warn">Bugün Aktif Kapsamda</Badge> : null}
              {preview.policy.preservesHistoricalLedger ? <Badge tone="muted">Tarihsel Bordro İzleri Korunur</Badge> : null}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-slate-950">{preview.warning.title}</div>
            <div className="text-sm text-slate-700">
              Bu işlem personel ana kaydını ve ilişkili operasyonel zaman verilerini fiziksel olarak siler. Bordro snapshot kayıtları ve bordro denetim izleri korunur.
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Kapat
          </Button>
        </div>

        {preview.recommendation?.shouldSuggestTerminateFirst ? (
          <div className="relative mt-5 rounded-[26px] border border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(254,243,199,0.92),rgba(253,230,138,0.88))] px-5 py-4 text-amber-950 shadow-[0_18px_40px_rgba(245,158,11,0.12)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1.5">
                <div className="text-sm font-semibold uppercase tracking-wide text-amber-700">Önerilen Ön Adım</div>
                <div className="text-lg font-semibold">{preview.recommendation.title}</div>
                <div className="text-sm leading-6">{preview.recommendation.message}</div>
                <div className="text-xs text-amber-800/85">
                  İstersen önce bu ekrandaki <span className="font-semibold">Kart Kapsamı</span> bölümünden kapsamı sonlandırıp sonra tekrar hard delete çalıştırabilirsin.
                </div>
              </div>
              <Badge tone="warn">Hard delete yine mümkün</Badge>
            </div>
          </div>
        ) : null}

        {preview.operationalImpact?.requiresExplicitOverride ? (
          <div className="relative mt-5 rounded-[26px] border border-rose-300 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(254,205,211,0.92),rgba(255,228,230,0.90))] px-5 py-4 text-rose-950 shadow-[0_18px_40px_rgba(225,29,72,0.10)]">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">Canlı Dönem Etkisi</Badge>
                {preview.operationalImpact.touchedOpenPeriods.length > 0 ? <Badge tone="warn">OPEN</Badge> : null}
                {preview.operationalImpact.touchedPreClosedPeriods.length > 0 ? <Badge tone="warn">PRE_CLOSED</Badge> : null}
              </div>
              <div className="text-lg font-semibold">{preview.operationalImpact.title}</div>
              <div className="text-sm leading-6">{preview.operationalImpact.message}</div>
              <div className="text-xs text-rose-900/85">
                Etkilenen aylar: {preview.operationalImpact.touchedMonths.length > 0 ? preview.operationalImpact.touchedMonths.join(", ") : "—"}
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="grid gap-4">
            <div className={cx("rounded-[26px] border px-5 py-4 text-sm shadow-sm", levelBoxClass(preview.warning.level))}>
              {preview.warning.messages.length > 0 ? (
                <ul className="grid gap-1.5">
                  {preview.warning.messages.map((line, idx) => (
                    <li key={idx}>• {line}</li>
                  ))}
                </ul>
              ) : (
                <div>Silme önizlemesinde ek uyarı bulunmadı.</div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-rose-200 bg-white/85 px-4 py-4 text-sm text-slate-700 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Çalışan</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{preview.employee.fullName}</div>
                <div className="mt-2 text-sm text-slate-600">Sicil: <span className="font-semibold text-slate-900">{preview.employee.employeeCode}</span></div>
                <div className="mt-1 text-sm text-slate-600">Durum: <span className="font-semibold text-slate-900">{preview.employee.isActive ? "Aktif" : "Pasif"}</span></div>
                <div className="mt-1 text-sm text-slate-600">Bugün Kapsam: <span className="font-semibold text-slate-900">{preview.employee.activeToday ? "Açık" : "Kapalı"}</span></div>
              </div>

              <div className="rounded-[24px] border border-rose-200 bg-white/85 px-4 py-4 text-sm text-slate-700 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Silinecek Operasyonel Veri Özeti</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{totalOperationalRows} kayıt etkisi</div>
                <div className="mt-2 grid gap-1 text-sm">
                  <div>Ham Zaman Olayı: <span className="font-semibold text-slate-900">{preview.counts.operationalDelete.rawEvents}</span></div>
                  <div>Günlük Devam Sonucu: <span className="font-semibold text-slate-900">{preview.counts.operationalDelete.dailyAttendances}</span></div>
                  <div>İzin Kaydı: <span className="font-semibold text-slate-900">{preview.counts.operationalDelete.employeeLeaves}</span></div>
                  <div>Haftalık Plan: <span className="font-semibold text-slate-900">{preview.counts.operationalDelete.weeklyShiftPlans}</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-white/82 px-4 py-4 text-sm shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Silinecek Operasyonel Kayıtlar</div>
                <div className="mt-3 grid gap-1.5 text-slate-700">
                  <div>{formatHardDeleteCountLabel("employmentPeriods")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.employmentPeriods}</span></div>
                  <div>{formatHardDeleteCountLabel("employeeActions")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.employeeActions}</span></div>
                  <div>{formatHardDeleteCountLabel("rawEvents")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.rawEvents}</span></div>
                  <div>{formatHardDeleteCountLabel("normalizedEvents")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.normalizedEvents}</span></div>
                  <div>{formatHardDeleteCountLabel("dailyAttendances")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.dailyAttendances}</span></div>
                  <div>{formatHardDeleteCountLabel("attendanceOwnershipAudits")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.attendanceOwnershipAudits}</span></div>
                  <div>{formatHardDeleteCountLabel("dailyAdjustments")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.dailyAdjustments}</span></div>
                  <div>{formatHardDeleteCountLabel("employeeLeaves")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.employeeLeaves}</span></div>
                  <div>{formatHardDeleteCountLabel("weeklyShiftPlans")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.weeklyShiftPlans}</span></div>
                  <div>{formatHardDeleteCountLabel("policyAssignments")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.policyAssignments}</span></div>
                  <div>{formatHardDeleteCountLabel("shiftPolicyAssignments")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.shiftPolicyAssignments}</span></div>
                  <div>{formatHardDeleteCountLabel("workScheduleAssignments")}: <span className="font-semibold text-slate-950">{preview.counts.operationalDelete.workScheduleAssignments}</span></div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white/82 px-4 py-4 text-sm shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Korunacak / Bağlantısı Ayrılacak İzler</div>
                <div className="mt-3 grid gap-1.5 text-slate-700">
                  <div>{formatHardDeleteCountLabel("resolvedDeviceInboxRefs")}: <span className="font-semibold text-slate-950">{preview.counts.detachOnly.resolvedDeviceInboxRefs}</span></div>
                  <div>{formatHardDeleteCountLabel("payrollSnapshotEmployeeRows")}: <span className="font-semibold text-slate-950">{preview.counts.preserveHistoricalLedger.payrollSnapshotEmployeeRows}</span></div>
                  <div>{formatHardDeleteCountLabel("payrollSnapshotCodeRows")}: <span className="font-semibold text-slate-950">{preview.counts.preserveHistoricalLedger.payrollSnapshotCodeRows}</span></div>
                  <div>{formatHardDeleteCountLabel("payrollAuditEvents")}: <span className="font-semibold text-slate-950">{preview.counts.preserveHistoricalLedger.payrollAuditEvents}</span></div>
                </div>

                {preview.payrollImpact.touchedPeriods.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                    <div className="font-semibold uppercase tracking-wide text-amber-700">Etkilenen Tarihsel Bordro Dönemleri</div>
                    <div className="mt-1 leading-6">
                      {preview.payrollImpact.touchedPeriods.map((x) => `${x.month} (${x.status})`).join(", ")}
                    </div>
                  </div>
                ) : null}

                {preview.operationalImpact.touchedOpenPeriods.length > 0 || preview.operationalImpact.touchedPreClosedPeriods.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-900">
                    <div className="font-semibold uppercase tracking-wide text-rose-700">Canlı Operasyon Dönemleri</div>
                    <div className="mt-1 leading-6">
                      {[
                        ...preview.operationalImpact.touchedOpenPeriods.map((x) => `${x.month} (${x.status})`),
                        ...preview.operationalImpact.touchedPreClosedPeriods.map((x) => `${x.month} (${x.status})`),
                      ].join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white/82 px-4 py-4 text-sm shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Silinecek Zaman Aralığı Özeti</div>
                <div className="mt-3 grid gap-1.5 text-slate-700">
                  <div>
                    Ham Zaman Olayı Aralığı:
                    <div className="mt-1 font-semibold text-slate-950">
                      {preview.ranges.rawEvents
                        ? `${formatDate(preview.ranges.rawEvents.fromOccurredAt)} → ${formatDate(preview.ranges.rawEvents.toOccurredAt)}`
                        : "—"}
                    </div>
                  </div>
                  <div className="mt-2">
                    Günlük Devam Sonucu Aralığı:
                    <div className="mt-1 font-semibold text-slate-950">
                      {preview.ranges.dailyAttendance
                        ? `${formatDate(preview.ranges.dailyAttendance.fromWorkDate)} → ${formatDate(preview.ranges.dailyAttendance.toWorkDate)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[26px] border border-rose-200 bg-white/88 px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Onay Adımları</div>
              <div className="mt-1 text-sm text-slate-600">
                İşlem geri alınamaz. Devam etmek için aşağıdaki kontrolleri eksiksiz tamamla.
              </div>

              <div className="mt-4 grid gap-4">
                <Field
                  label={`Çalışan Kodunu Tekrar Yaz (${preview.employee.employeeCode})`}
                  value={confirmEmployeeCode}
                  onChange={setConfirmEmployeeCode}
                  placeholder={preview.employee.employeeCode}
                />

                <Field
                  label='Onay İfadesi'
                  value={confirmationText}
                  onChange={setConfirmationText}
                  placeholder="HARD DELETE"
                />

                <label className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-rose-300"
                    checked={acknowledgeChecked}
                    onChange={(e) => setAcknowledgeChecked(e.target.checked)}
                  />
                  <span>
                    Bu işlemin employee ana kaydını ve ilişkili operational graph verilerini fiziksel olarak sileceğini, işlemin geri alınamaz olduğunu anladım.
                  </span>
                </label>

                {needsActiveOverride ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-amber-300"
                      checked={allowActiveScopeDelete}
                      onChange={(e) => setAllowActiveScopeDelete(e.target.checked)}
                    />
                    <span>
                      Bu personelin bugün aktif kapsamda olduğunu biliyorum. Önce kapsamı sonlandır önerisini gördüm. Buna rağmen hard delete işlemini bilinçli olarak devam ettiriyorum.
                    </span>
                  </label>
                ) : null}

                {needsOperationalImpactOverride ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-rose-300"
                      checked={allowOperationalPeriodImpactDelete}
                      onChange={(e) => setAllowOperationalPeriodImpactDelete(e.target.checked)}
                    />
                    <span>
                      Bu silme işleminin açık veya ön kapanış durumundaki canlı dönemleri etkilediğini biliyorum. Buna rağmen hard delete işlemini bilinçli olarak devam ettiriyorum.
                    </span>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white/88 px-5 py-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Uygulama Politikası</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <div>• İşlem Modu: <span className="font-semibold text-slate-950">Operasyonel Hard Delete</span></div>
                <div>• Politika Saat Dilimi: <span className="font-semibold text-slate-950">{preview.policy.timezone}</span></div>
                <div>• Bugünkü DayKey: <span className="font-semibold text-slate-950">{preview.policy.todayDayKey}</span></div>
                <div>• Tarihsel Bordro İzleri: <span className="font-semibold text-slate-950">{preview.policy.preservesHistoricalLedger ? "Korunur" : "Korunmaz"}</span></div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Vazgeç
              </Button>
              <Button variant="danger" onClick={onConfirm} disabled={!confirmReady || loading}>
                {loading ? "Kalıcı Siliniyor…" : "Personeli Kalıcı Olarak Sil"}
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function EmployeeEditClient({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeCardRef = useRef<HTMLDivElement | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);
  const [workSchedules, setWorkSchedules] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);
  const [employeeGroups, setEmployeeGroups] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [employeeSubgroups, setEmployeeSubgroups] = useState<
    Array<{ id: string; code: string; name: string; groupId: string; group?: { code: string; name: string } | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [loadingHardDeletePreview, setLoadingHardDeletePreview] = useState(false);
  const [applyingHardDelete, setApplyingHardDelete] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse["item"] | null>(null);
  const [scopePreview, setScopePreview] = useState<ScopePreviewResponse["item"] | null>(null);
  const [hardDeletePreview, setHardDeletePreview] = useState<HardDeletePreviewResponse["item"] | null>(null);
  const [showScopeWarning, setShowScopeWarning] = useState(false);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [scopeConfirmChecked, setScopeConfirmChecked] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [hardDeleteAcknowledgeChecked, setHardDeleteAcknowledgeChecked] = useState(false);
  const [hardDeleteAllowActiveOverride, setHardDeleteAllowActiveOverride] = useState(false);
  const [hardDeleteAllowOperationalImpactOverride, setHardDeleteAllowOperationalImpactOverride] = useState(false);
  const [hardDeleteConfirmEmployeeCode, setHardDeleteConfirmEmployeeCode] = useState("");
  const [hardDeleteConfirmationText, setHardDeleteConfirmationText] = useState("");
  const [form, setForm] = useState<FormState>({
    employeeCode: "",
    firstName: "",
    lastName: "",
    nationalId: "",
    gender: "",
    email: "",
    phone: "",
    cardNo: "",
    deviceUserId: "",
    branchId: "",
    workSchedulePatternId: "",
    employeeGroupId: "",
    employeeSubgroupId: "",
    scopeStartDate: "",
    scopeEndDate: "",
    scopeNote: "",
  });

  const intent = (searchParams.get("intent") ?? "").trim().toLowerCase();
  const intentMode = intent === "terminate" || intent === "rehire" ? intent : null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      try {
        await fetch("/api/policy/work-schedules/ensure-defaults", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // no-op
      }

      const [res, masterRes, branchesRes, workSchedulesRes, groupsRes, subgroupsRes] = await Promise.all([
        fetch(`/api/employees/${id}`, { credentials: "include" }),
        fetch(`/api/employees/${id}/master`, { credentials: "include" }),
        fetch(`/api/org/branches`, { credentials: "include" }),
        fetch(`/api/policy/work-schedules`, { credentials: "include" }),
        fetch(`/api/workforce/groups`, { credentials: "include" }),
        fetch(`/api/workforce/subgroups`, { credentials: "include" }),
      ]);

      const txt = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(txt) ?? res.statusText);
      const json = JSON.parse(txt) as DetailResponse;
      const item = json.item;

      const masterJson = (await masterRes.json().catch(() => null)) as MasterResponse | null;
      const currentPatternId =
        masterJson?.item?.today?.shiftProfile?.workSchedule?.patternId
          ? String(masterJson.item.today.shiftProfile.workSchedule.patternId)
          : "";

      const branchesJson = await branchesRes.json().catch(() => null);
      const branchItems = Array.isArray(branchesJson)
        ? branchesJson
        : Array.isArray(branchesJson?.items)
          ? branchesJson.items
          : [];
      setBranches(branchItems);

      const workSchedulesJson = await workSchedulesRes.json().catch(() => null);
      const workScheduleItems = Array.isArray(workSchedulesJson)
        ? workSchedulesJson
        : Array.isArray(workSchedulesJson?.items)
          ? workSchedulesJson.items
          : [];
      setWorkSchedules(workScheduleItems);
      const activeWorkSchedules = workScheduleItems.filter((x: any) => x?.isActive);
      const norm = activeWorkSchedules.find((x: any) => String(x?.code ?? "").toUpperCase() === "NORM");

      const groupsJson = await groupsRes.json().catch(() => null);
      const groupItems = Array.isArray(groupsJson)
        ? groupsJson
        : Array.isArray(groupsJson?.items)
          ? groupsJson.items
          : [];
      setEmployeeGroups(groupItems);

      const subgroupsJson = await subgroupsRes.json().catch(() => null);
      const subgroupItems = Array.isArray(subgroupsJson)
        ? subgroupsJson
        : Array.isArray(subgroupsJson?.items)
          ? subgroupsJson.items
          : [];
      setEmployeeSubgroups(subgroupItems);

      setData(item);
      const loadedScope = item.employmentPeriods.find((p) => !p.endDate) ?? item.employmentPeriods[0] ?? null;
      setForm({
        employeeCode: item.employeeCode ?? "",
        firstName: item.firstName ?? "",
        lastName: item.lastName ?? "",
        nationalId: item.nationalId ?? "",
        gender: item.gender ?? "",
        email: item.email ?? "",
        phone: item.phone ?? "",
        cardNo: item.cardNo ?? "",
        deviceUserId: item.deviceUserId ?? "",
        branchId: item.branchId ?? item.branch?.id ?? "",
        workSchedulePatternId: currentPatternId || norm?.id || activeWorkSchedules[0]?.id || "",
        employeeGroupId: item.employeeGroupId ?? item.employeeGroup?.id ?? "",
        employeeSubgroupId: item.employeeSubgroupId ?? item.employeeSubgroup?.id ?? "",
        scopeStartDate: loadedScope?.startDate ? String(loadedScope.startDate).slice(0, 10) : (item.hiredAt ?? ""),
        scopeEndDate: loadedScope?.endDate ? String(loadedScope.endDate).slice(0, 10) : (item.terminatedAt ?? ""),
        scopeNote: "",
      });
      setScopePreview(null);
      setShowScopeWarning(false);
      setScopeConfirmChecked(false);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!intentMode) return;
    if (loading) return;

    const t = window.setTimeout(() => {
      scopeCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);

    return () => window.clearTimeout(t);
  }, [intentMode, loading]);

  function resetHardDeleteState() {
    setHardDeleteAcknowledgeChecked(false);
    setHardDeleteAllowActiveOverride(false);
    setHardDeleteAllowOperationalImpactOverride(false);
    setHardDeleteConfirmEmployeeCode("");
    setHardDeleteConfirmationText("");
  }

  useEffect(() => {
    if (!showScopeWarning) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showScopeWarning]);

  useEffect(() => {
    if (!showHardDeleteModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showHardDeleteModal]);

  const fullName = useMemo(() => {
    return `${form.firstName} ${form.lastName}`.trim() || "Çalışan";
  }, [form.firstName, form.lastName]);

  const currentScope = useMemo(() => {
    if (!data?.employmentPeriods?.length) return null;
    return data.employmentPeriods.find((p) => !p.endDate) ?? data.employmentPeriods[0] ?? null;
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    return (
      form.employeeCode.trim() !== (data.employeeCode ?? "") ||
      form.firstName.trim() !== (data.firstName ?? "") ||
      form.lastName.trim() !== (data.lastName ?? "") ||
      form.nationalId.trim() !== (data.nationalId ?? "") ||
      form.gender.trim() !== (data.gender ?? "") ||
      form.email.trim() !== (data.email ?? "") ||
      form.phone.trim() !== (data.phone ?? "") ||
      form.cardNo.trim() !== (data.cardNo ?? "") ||
      form.deviceUserId.trim() !== (data.deviceUserId ?? "") ||
      form.branchId.trim() !== (data.branchId ?? data.branch?.id ?? "") ||
      form.workSchedulePatternId.trim() !== "" ||
      form.employeeGroupId.trim() !== (data.employeeGroupId ?? data.employeeGroup?.id ?? "") ||
      form.employeeSubgroupId.trim() !== (data.employeeSubgroupId ?? data.employeeSubgroup?.id ?? "")
    );
  }, [data, form]);

  const locationOptions = useMemo(() => {
    return [...branches]
      .filter((b) => b.isActive)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [branches]);

  const workScheduleOptions = useMemo(() => {
    return [...workSchedules]
      .filter((p) => p.isActive)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [workSchedules]);

  const employeeGroupOptions = useMemo(() => {
    return [...employeeGroups].sort((a, b) => {
      const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
      if (byCode !== 0) return byCode;
      return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
    });
  }, [employeeGroups]);

  const employeeSubgroupOptions = useMemo(() => {
    const groupId = form.employeeGroupId;
    if (!groupId) return [];
    return [...employeeSubgroups]
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [employeeSubgroups, form.employeeGroupId]);

  const hasScopeChanges = useMemo(() => {
    if (!data) return false;
    const loadedScope = data.employmentPeriods.find((p) => !p.endDate) ?? data.employmentPeriods[0] ?? null;
    const loadedStart = loadedScope?.startDate ? String(loadedScope.startDate).slice(0, 10) : (data.hiredAt ?? "");
    const loadedEnd = loadedScope?.endDate ? String(loadedScope.endDate).slice(0, 10) : (data.terminatedAt ?? "");
    return (
      form.scopeStartDate.trim() !== (loadedStart ?? "") ||
      form.scopeEndDate.trim() !== (loadedEnd ?? "") ||
      !!form.scopeNote.trim()
    );
  }, [data, form.scopeStartDate, form.scopeEndDate, form.scopeNote]);

  const validationError = useMemo(() => {
    if (!form.employeeCode.trim()) return "Çalışan kodu zorunludur.";
    if (!form.firstName.trim()) return "Ad zorunludur.";
    if (!form.lastName.trim()) return "Soyad zorunludur.";
    if (!isLikelyNationalId(form.nationalId)) return "TC Kimlik 11 haneli olmalıdır.";
    if (!isLikelyEmail(form.email)) return "E-posta formatı geçersiz.";
    if (form.phone.trim().length > 30) return "Telefon en fazla 30 karakter olabilir.";
    if (!form.workSchedulePatternId.trim()) return "Çalışma planı zorunludur.";
    if (!form.employeeGroupId.trim()) return "Grup zorunludur.";
    if (!form.employeeSubgroupId.trim()) return "Alt grup zorunludur.";
    return null;
  }, [
    form.employeeCode,
    form.firstName,
    form.lastName,
    form.nationalId,
    form.email,
    form.phone,
    form.workSchedulePatternId,
    form.employeeGroupId,
    form.employeeSubgroupId,
  ]);

  const scopeValidationError = useMemo(() => {
    const start = form.scopeStartDate.trim();
    const end = form.scopeEndDate.trim();
    if (!start) return "Kart aktivasyon tarihi zorunludur.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return "Kart aktivasyon tarihi geçersiz.";
    if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return "Kart iptal tarihi geçersiz.";
    if (end && end < start) return "Kart iptal tarihi, aktivasyon tarihinden önce olamaz.";
    return null;
  }, [form.scopeStartDate, form.scopeEndDate]);

  async function onSaveBasic() {
    if (!data) return;
    if (validationError) {
      setNotice({ kind: "error", text: validationError });
      return;
    }

    setSavingBasic(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/employees`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.id,
          employeeCode: form.employeeCode.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          nationalId: form.nationalId.trim() || null,
          gender: form.gender.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          cardNo: form.cardNo.trim() || null,
          deviceUserId: form.deviceUserId.trim() || null,
          branchId: form.branchId.trim() || null,
          workSchedulePatternId: form.workSchedulePatternId.trim(),
          employeeGroupId: form.employeeGroupId.trim(),
          employeeSubgroupId: form.employeeSubgroupId.trim(),
        }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(txt) ?? res.statusText);
      setNotice({ kind: "success", text: "Personel bilgileri güncellendi." });
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: humanizeError(e instanceof Error ? e.message : String(e)) });
    } finally {
      setSavingBasic(false);
    }
  }

  async function previewScopeChange() {
    if (scopeValidationError) {
      setNotice({ kind: "error", text: scopeValidationError });
      return;
    }

    setSavingScope(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/card-scope/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: normalizeDateOrNull(form.scopeStartDate),
          endDate: normalizeDateOrNull(form.scopeEndDate),
          note: form.scopeNote.trim() || null,
        }),
      });
      const txt = await res.text();
      const parsed = txt ? JSON.parse(txt) : null;
      if (!res.ok) throw new Error(parsed?.error || parseApiErrorText(txt) || res.statusText);

      const item = parsed?.item as ScopePreviewResponse["item"];
      setScopePreview(item);
      setScopeConfirmChecked(false);

      if (item.warning.requiresConfirmation) {
        setShowScopeWarning(true);
        return;
      }

      await applyScopeChange(false, item);
    } catch (e) {
      setNotice({ kind: "error", text: humanizeError(e instanceof Error ? e.message : String(e)) });
    } finally {
      setSavingScope(false);
    }
  }

  async function applyScopeChange(forceConfirm: boolean, previewFromCaller?: ScopePreviewResponse["item"] | null) {
    setSavingScope(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/card-scope/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: normalizeDateOrNull(form.scopeStartDate),
          endDate: normalizeDateOrNull(form.scopeEndDate),
          note: form.scopeNote.trim() || null,
          forceConfirm,
        }),
      });

      const txt = await res.text();
      const parsed = txt ? JSON.parse(txt) : null;

      if (res.status === 409 && parsed?.error === "CONFIRM_REQUIRED" && parsed?.preview) {
        setScopePreview(parsed.preview);
        setScopeConfirmChecked(false);
        setShowScopeWarning(true);
        return;
      }

      if (!res.ok) throw new Error(parsed?.error || parseApiErrorText(txt) || res.statusText);

      const effectivePreview = parsed?.preview?.item ?? parsed?.preview ?? previewFromCaller ?? null;
      if (effectivePreview) setScopePreview(effectivePreview);
      setShowScopeWarning(false);
      setScopeConfirmChecked(false);
      setNotice({
        kind: "success",
        text:
          effectivePreview?.warning?.level === "W0"
            ? "Kart kapsamı güncellendi."
            : "Kart kapsamı güçlü uyarı onayı ile güncellendi.",
      });
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: humanizeError(e instanceof Error ? e.message : String(e)) });
    } finally {
      setSavingScope(false);
    }
  }

  async function openHardDeletePreview() {
    setLoadingHardDeletePreview(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/hard-delete/preview`, {
        method: "POST",
        credentials: "include",
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(txt) ?? res.statusText);
      const json = JSON.parse(txt) as HardDeletePreviewResponse;
      setHardDeletePreview(json.item);
      resetHardDeleteState();
      setShowHardDeleteModal(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNotice({ kind: "error", text: humanizeError(msg) });
    } finally {
      setLoadingHardDeletePreview(false);
    }
  }

  async function applyHardDelete() {
    if (!hardDeletePreview) return;

    setApplyingHardDelete(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/hard-delete/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmEmployeeCode: hardDeleteConfirmEmployeeCode.trim(),
          confirmationText: hardDeleteConfirmationText.trim(),
          allowActiveScopeDelete: hardDeleteAllowActiveOverride,
          allowOperationalPeriodImpactDelete: hardDeleteAllowOperationalImpactOverride,
          preserveHistoricalLedger: true,
        }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(txt) ?? res.statusText);

      setShowHardDeleteModal(false);
      resetHardDeleteState();
      router.push(`/employees?status=ALL&hardDeleted=1&employeeCode=${encodeURIComponent(hardDeletePreview.employee.employeeCode)}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNotice({ kind: "error", text: humanizeError(msg) });
    } finally {
      setApplyingHardDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-28 animate-pulse rounded-[28px] border border-slate-200 bg-white" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="h-[420px] animate-pulse rounded-[28px] border border-slate-200 bg-white" />
          <div className="h-[420px] animate-pulse rounded-[28px] border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
        <div className="font-semibold">Düzenleme ekranı açılamadı</div>
        <div className="mt-1">{error}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={load}>
            Tekrar dene
          </Button>
          <Link
            href={`/employees/${id}`}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/60"
          >
            Profile dön
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-sm text-slate-500">Kayıt bulunamadı.</div>;

  return (
    <>
      <div className="grid gap-5">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc,#eef2ff)] p-5 shadow-[0_22px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-2xl font-semibold tracking-tight text-slate-950">{fullName}</div>
                <Badge tone={data.isActive ? "ok" : "warn"}>{data.isActive ? "Aktif" : "Pasif"}</Badge>
                <Badge>Sicil: {data.employeeCode || "—"}</Badge>
              </div>
              <div className="text-sm text-slate-600">Kimlik, kart eşlemesi ve temel iletişim bilgilerini düzenleyin.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/employees/${id}`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/60"
              >
                Profile dön
              </Link>
              <Button variant="primary" onClick={onSaveBasic} disabled={savingBasic || !hasChanges || !!validationError}>
                {savingBasic ? "Kaydediliyor…" : "Temel Bilgileri Kaydet"}
              </Button>
            </div>
          </div>

          {notice ? (
            <div
              className={cx(
                "mt-4 rounded-2xl border px-4 py-3 text-sm shadow-sm",
                notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : notice.kind === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-sky-200 bg-sky-50 text-sky-800"
              )}
            >
              {notice.text}
            </div>
          ) : null}

          {intentMode ? (
            <div
              className={cx(
                "mt-4 rounded-[24px] border px-4 py-4 text-sm shadow-sm",
                intentMode === "terminate"
                  ? "border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#fef3c7,#fff7ed)] text-amber-950"
                  : "border-indigo-200 bg-[linear-gradient(135deg,#eef2ff,#e0e7ff,#f5f3ff)] text-indigo-950"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1.5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-current/70">
                    Yönlendirilmiş Kapsam İşlemi
                  </div>
                  <div className="text-base font-semibold">
                    {intentMode === "terminate"
                      ? "Bu çalışan için kapsam sonlandırma akışı açıldı."
                      : "Bu çalışan için yeni kapsam açma akışı açıldı."}
                  </div>
                  <div className="leading-6 text-current/85">
                    Aşağıdaki <span className="font-semibold">Kart Kapsamı</span> alanından tarihleri düzenleyip etki analizini çalıştırarak işlemi güvenli şekilde tamamlayabilirsin.
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    scopeCardRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  Kart Kapsamına Git
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Temel Bilgiler" subtitle="Bu alanlar doğrudan çalışan ana kaydına yazılır.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Çalışan Kodu" value={form.employeeCode} onChange={(v) => setForm((p) => ({ ...p, employeeCode: v }))} required placeholder="Örn: E001" />
                <Field
                  label="TC Kimlik"
                  value={form.nationalId}
                  onChange={(v) => setForm((p) => ({ ...p, nationalId: v.replace(/\D+/g, "").slice(0, 11) }))}
                  placeholder="11 haneli TC Kimlik"
                />
                <Field label="E-posta" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} type="email" placeholder="ornek@firma.com" />
                <Field label="Telefon" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="05xx xxx xx xx" />
                <Field label="Ad" value={form.firstName} onChange={(v) => setForm((p) => ({ ...p, firstName: v }))} required placeholder="Çalışan adı" />
                <Field label="Soyad" value={form.lastName} onChange={(v) => setForm((p) => ({ ...p, lastName: v }))} required placeholder="Çalışan soyadı" />
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-800">Cinsiyet</span>
                  <select
                    className={inputClass}
                    value={form.gender}
                    onChange={(ev) => setForm((p) => ({ ...p, gender: ev.target.value }))}
                  >
                    <option value="">Seçilmedi</option>
                    <option value="MALE">Erkek</option>
                    <option value="FEMALE">Kadın</option>
                    <option value="OTHER">Diğer</option>
                    <option value="UNSPECIFIED">Belirtilmedi</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-800">Lokasyon</span>
                  <select
                    className={inputClass}
                    value={form.branchId}
                    onChange={(ev) => setForm((p) => ({ ...p, branchId: ev.target.value }))}
                  >
                    <option value="">Lokasyon seçilmedi</option>
                    {locationOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} — {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-800">Çalışma Planı</span>
                  <select
                    className={inputClass}
                    value={form.workSchedulePatternId}
                    onChange={(ev) => setForm((p) => ({ ...p, workSchedulePatternId: ev.target.value }))}
                  >
                    <option value="">Çalışma planı seçin</option>
                    {workScheduleOptions.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.code} — {pattern.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-800">Grup</span>
                  <select
                    className={inputClass}
                    value={form.employeeGroupId}
                    onChange={(ev) => {
                      const nextGroupId = ev.target.value;
                      const subgroupStillValid = employeeSubgroups.some(
                        (sg) => sg.id === form.employeeSubgroupId && sg.groupId === nextGroupId,
                      );
                      setForm((p) => ({
                        ...p,
                        employeeGroupId: nextGroupId,
                        employeeSubgroupId: subgroupStillValid ? p.employeeSubgroupId : "",
                      }));
                    }}
                  >
                    <option value="">Grup seçin</option>
                    {employeeGroupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} — {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-800">Alt Grup</span>
                  <select
                    className={inputClass}
                    value={form.employeeSubgroupId}
                    disabled={!form.employeeGroupId}
                    onChange={(ev) => setForm((p) => ({ ...p, employeeSubgroupId: ev.target.value }))}
                  >
                    <option value="">{form.employeeGroupId ? "Alt grup seçin" : "Önce grup seçin"}</option>
                    {employeeSubgroupOptions.map((subgroup) => (
                      <option key={subgroup.id} value={subgroup.id}>
                        {subgroup.code} — {subgroup.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {validationError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {validationError}
                </div>
              )}
            </Card>

            <Card title="Kart & Cihaz Eşlemesi" subtitle="Kart numarası ve cihaz kullanıcı numarası tekil tutulur.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kart ID" value={form.cardNo} onChange={(v) => setForm((p) => ({ ...p, cardNo: v }))} placeholder="Kart kimliği" />
                <Field label="Cihaz Kullanıcı No" value={form.deviceUserId} onChange={(v) => setForm((p) => ({ ...p, deviceUserId: v }))} placeholder="Cihaz iç kullanıcı numarası" />
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Kart veya cihaz kimliği başka bir personelde kullanılıyorsa kayıt reddedilir.
              </div>
            </Card>
          </div>

          <div
            ref={scopeCardRef}
            className={cx(
              "rounded-[30px] transition-all",
              intentMode === "terminate"
                ? "ring-2 ring-amber-300/70 ring-offset-2 ring-offset-white"
                : intentMode === "rehire"
                  ? "ring-2 ring-indigo-300/70 ring-offset-2 ring-offset-white"
                  : ""
            )}
          >
            <Card
              title="Kart Kapsamı"
              subtitle={
                intentMode === "terminate"
                  ? "Bu çalışan için kapsam sonlandırma akışı öne çıkarıldı. Kaydetmeden önce sistem etki analizi yapar."
                  : intentMode === "rehire"
                    ? "Bu çalışan için yeni kapsam açma akışı öne çıkarıldı. Kaydetmeden önce sistem etki analizi yapar."
                    : "Kapsam tarihini kaydetmeden önce sistem etki analizi yapar. Riskli değişikliklerde güçlü uyarı gösterilir."
              }
              right={
                <div className="flex flex-wrap items-center gap-2">
                  {intentMode === "terminate" ? <Badge tone="warn">Kapsam Sonlandırma</Badge> : null}
                  {intentMode === "rehire" ? <Badge tone="ok">Yeni Kapsam Açma</Badge> : null}
                  <Button variant="primary" onClick={previewScopeChange} disabled={savingScope || !hasScopeChanges || !!scopeValidationError}>
                    {savingScope ? "Kontrol ediliyor…" : "Kapsam Değişikliğini Kaydet"}
                  </Button>
                </div>
              }
            >
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Kart Aktivasyon Tarihi"
                    type="date"
                    value={form.scopeStartDate}
                    onChange={(v) => setForm((p) => ({ ...p, scopeStartDate: v }))}
                    required
                  />
                  <Field
                    label="Kart İptal Tarihi"
                    type="date"
                    value={form.scopeEndDate}
                    onChange={(v) => setForm((p) => ({ ...p, scopeEndDate: v }))}
                  />
                </div>

                <TextArea
                  label="Düzeltme Notu"
                  value={form.scopeNote}
                  onChange={(v) => setForm((p) => ({ ...p, scopeNote: v }))}
                  placeholder="Operasyon açıklaması / tarih düzeltme nedeni / vb."
                />

                {scopeValidationError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{scopeValidationError}</div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Mevcut kapsam: <span className="font-medium text-slate-900">{formatDate(currentScope?.startDate ?? data.hiredAt)}</span>
                  {" → "}
                  <span className="font-medium text-slate-900">{formatDate(currentScope?.endDate ?? data.terminatedAt)}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card title="Son Kapsam Hareketleri" subtitle="Son dönem ve aksiyon geçmişi hızlı görünüm.">
              <div className="grid gap-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Kapsam Dönemleri</div>
                  <div className="grid gap-2">
                    {data.employmentPeriods.slice(0, 4).map((p) => (
                      <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">
                          {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{p.reason || "Not yok"}</div>
                      </div>
                    ))}
                    {data.employmentPeriods.length === 0 ? <div className="text-sm text-slate-500">Kapsam dönemi bulunamadı.</div> : null}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aksiyon Logu</div>
                  <div className="grid gap-2">
                    {data.actions.slice(0, 5).map((a) => (
                      <div key={a.id} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 shadow-sm">
                        <div className="font-medium text-slate-900">{trActionType(a.type)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDate(a.effectiveDate)} • {a.note || "Not yok"}
                        </div>
                      </div>
                    ))}
                    {data.actions.length === 0 ? <div className="text-sm text-slate-500">Aksiyon kaydı bulunamadı.</div> : null}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Tehlikeli İşlemler"
              subtitle="Bu alan geri alınamaz operasyonlar içindir. Hard delete employee ana kaydını ve ilişkili operational graph verilerini fiziksel olarak siler."
              right={
                <Button
                  variant="danger"
                  onClick={openHardDeletePreview}
                  disabled={loadingHardDeletePreview || applyingHardDelete}
                >
                  {loadingHardDeletePreview ? "Silme Önizlemesi Hazırlanıyor…" : "Hard Delete Önizlemesi Aç"}
                </Button>
              }
            >
              <div className="grid gap-4">
                <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(135deg,#fff1f2,#ffe4e6,#fff7ed)] px-4 py-4 text-sm text-rose-950 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">Kalıcı Silme</Badge>
                    {data.isActive ? <Badge tone="warn">Personel şu an aktif görünüyor</Badge> : <Badge tone="muted">Personel pasif durumda</Badge>}
                  </div>
                  <div className="mt-3 font-semibold">Bu işlem geri alınamaz.</div>
                  <div className="mt-1 leading-6 text-rose-900/90">
                    Employee kaydı fiziksel olarak silinir. Raw event, normalized event, daily attendance, leave, weekly plan ve assignment graph kayıtları da employee ile birlikte sistemden kaldırılır.
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Önce Değerlendir</div>
                    <div className="mt-1">
                      Personel bugün aktif kapsamdaysa önce <span className="font-semibold text-slate-900">Kart Kapsamı</span> bölümünden kapsamı sonlandırmak daha kontrollü bir yol olabilir.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Korunan Ledger</div>
                    <div className="mt-1">
                      Payroll snapshot ve payroll audit ledger kayıtları korunur. Hard delete yalnızca operational employee graph üstünde çalışır.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">İşlem Sonrası İz</div>
                  <div className="mt-1 leading-6">
                    Hard delete tamamlandıktan sonra kayıt, <span className="font-semibold">Denetim Kayıtları</span> ekranındaki
                    <span className="font-semibold"> Personel Silme </span>
                    görünümünde izlenebilir.
                  </div>
                  <div className="mt-3">
                    <Link
                      href="/admin/audit?view=EMPLOYEE_HARD_DELETE"
                      className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-50"
                    >
                      Denetim Kayıtlarını Aç
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {portalReady ? (
        <>
          <ScopeWarningModal
            open={showScopeWarning}
            scopePreview={scopePreview}
            scopeConfirmChecked={scopeConfirmChecked}
            setScopeConfirmChecked={setScopeConfirmChecked}
            savingScope={savingScope}
            onClose={() => {
              setShowScopeWarning(false);
              setScopeConfirmChecked(false);
            }}
            onConfirm={() => applyScopeChange(true, scopePreview)}
          />

          <HardDeletePreviewModal
            open={showHardDeleteModal}
            preview={hardDeletePreview}
            loading={applyingHardDelete}
            confirmEmployeeCode={hardDeleteConfirmEmployeeCode}
            setConfirmEmployeeCode={setHardDeleteConfirmEmployeeCode}
            confirmationText={hardDeleteConfirmationText}
            setConfirmationText={setHardDeleteConfirmationText}
            acknowledgeChecked={hardDeleteAcknowledgeChecked}
            setAcknowledgeChecked={setHardDeleteAcknowledgeChecked}
            allowActiveScopeDelete={hardDeleteAllowActiveOverride}
            setAllowActiveScopeDelete={setHardDeleteAllowActiveOverride}
            allowOperationalPeriodImpactDelete={hardDeleteAllowOperationalImpactOverride}
            setAllowOperationalPeriodImpactDelete={setHardDeleteAllowOperationalImpactOverride}
            onClose={() => {
              setShowHardDeleteModal(false);
              resetHardDeleteState();
            }}
            onConfirm={applyHardDelete}
          />
        </>
      ) : null}
    </>
  );
}
