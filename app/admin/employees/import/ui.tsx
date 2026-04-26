"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EMPLOYEE_IMPORT_FIELDS,
  EMPLOYEE_IMPORT_SHEETS,
  EmployeeImportFieldKey,
  EmployeeImportSheetKind,
  formatEmployeeImportSheetTitle,
  getEmployeeImportSheet,
  getEmployeeImportSheetByName,
  normalizeEmployeeImportHeader,
} from "@/src/features/employees/importTemplate";
import {
  formatEmployeeImportErrorPreviewPolicyText,
  formatEmployeeImportInspectionLimitText,
  formatEmployeeImportInspectionSummary,
  formatEmployeeImportPreviewPolicyText,
  formatEmployeeImportSnapshotPolicyText,
  getEmployeeImportPreviewEmptyText,
  getEmployeeImportPreviewSectionTitle,
  getEmployeeImportSnapshotLabel,
} from "@/src/services/employees/employeeImportRunPrivacy.service";
import {
  buildEmployeeImportGuidedRemediationPlan,
  type EmployeeImportGuidedRemediationActionKey,
} from "@/src/services/employees/employeeImportGuidedRemediation.service";
import type { EmployeeImportIssueSummaryDto } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import type { EmployeeImportReadinessSummaryDto } from "@/src/services/employees/employeeImportReadiness.service";
import { ActionResultDialog, type ActionResultDialogState } from "./action-result-dialog";
import { GuidedRemediationPanel } from "./guided-remediation-panel";
import { ImportIssueSummaryPanel } from "./issue-summary-panel";
import { ImportReadinessPanel } from "./readiness-panel";

type ToastKind = "success" | "info" | "warn" | "error";
type ToastState = { kind: ToastKind; message: string } | null;
type ImportWorkspaceView = "import" | "history";
type ImportRunMode = "DRY_RUN" | "APPLY";
type ImportRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
type ImportRunOutcome = "CLEAN" | "WARNING" | "BLOCKING" | "PARTIAL";
type ImportRunDrawerTab = "summary" | "warnings" | "errors" | "snapshots";

type ImportIssue = {
  line: number;
  employeeCode?: string;
  code: string;
  message: string;
  field?: EmployeeImportFieldKey;
  value?: string;
};

type ImportPreviewRow = {
  line: number;
  employeeCode: string;
  cardNo: string;
  scopeStartDate: string;
  scopeEndDate: string | null;
  values: Partial<Record<EmployeeImportFieldKey, string | null>>;
};

type ImportApplySummary =
  | {
      kind: "FULL_DATA";
      requested: number;
      found: number;
      created: number;
      updated: number;
      changed: number;
      unchanged: number;
      rejected: number;
      employmentChanged: number;
      personalChanged: number;
      orgChanged: number;
      workScheduleChanged: number;
      cardFilled: number;
      cardConflict: number;
      invalidValues: number;
      recomputeQueued: boolean;
    }
  | {
      kind: "PERSONAL_DATA";
      requested: number;
      found: number;
      changed: number;
      unchanged: number;
      rejected: number;
      profileChanged: number;
      cardFilled: number;
      employeeNotFound: number;
      cardConflict: number;
      invalidPersonalValues: number;
    }
  | {
      kind: "ORG_DATA";
      requested: number;
      found: number;
      changed: number;
      unchanged: number;
      rejected: number;
      orgChanged: number;
      employeeNotFound: number;
      cardMismatch: number;
      invalidOrgValues: number;
      recomputeQueued: boolean;
    }
  | {
      kind: "WORK_DATA";
      requested: number;
      found: number;
      changed: number;
      unchanged: number;
      rejected: number;
      workScheduleChanged: number;
      employeeNotFound: number;
      cardMismatch: number;
      invalidWorkValues: number;
      recomputeQueued: boolean;
    };

type ImportResultRunRef = {
  id: string;
  mode: ImportRunMode;
  status: ImportRunStatus;
  outcome: ImportRunOutcome | null;
  duplicateOfRunId: string | null;
};

type ImportResult = {
  ok: boolean;
  dryRun: boolean;
  applyEnabled: boolean;
  sheetKind: EmployeeImportSheetKind;
  sheetTitle: string;
  isTemplateValid: boolean;
  canProceedToNextPhase: boolean;
  totals: {
    rows: number;
    unique: number;
    valid: number;
    invalid: number;
    empty: number;
  };
  headerSummary: {
    receivedHeaders: string[];
    missingRequiredHeaders: EmployeeImportFieldKey[];
    unknownHeaders: string[];
    duplicateHeaders: string[];
    emptyHeaderIndexes: number[];
  };
  errors: ImportIssue[];
  warnings: ImportIssue[];
  issueSummary: EmployeeImportIssueSummaryDto;
  readinessSummary?: EmployeeImportReadinessSummaryDto | null;
  previewRows: ImportPreviewRow[];
  codeResolutionSummary?: {
    branch: { provided: number; resolved: number; missing: number; inactive: number; mismatchedGroup: number };
    employeeGroup: { provided: number; resolved: number; missing: number; inactive: number; mismatchedGroup: number };
    employeeSubgroup: { provided: number; resolved: number; missing: number; inactive: number; mismatchedGroup: number };
    workSchedulePattern: { provided: number; resolved: number; missing: number; inactive: number; mismatchedGroup: number };
  };
  applySummary?: ImportApplySummary;
  runRef?: ImportResultRunRef;
  changedEmployeeCodesPreview?: string[];
  message?: string;
};

type WorkbookSheet = {
  name: string;
  kind: EmployeeImportSheetKind | null;
  text: string;
};

type ImportRunActor = {
  userId: string;
  email: string | null;
  role: string | null;
  isActive: boolean | null;
};

type ImportRunReference = {
  id: string;
  mode: ImportRunMode;
  sheetKind: string;
  sheetTitle: string;
  status: ImportRunStatus;
  outcome: ImportRunOutcome | null;
  startedAt: string;
  finishedAt: string | null;
};

type ImportRunListItem = ImportRunReference & {
  requestedCount: number;
  processedCount: number | null;
  changedCount: number | null;
  unchangedCount: number | null;
  rejectedCount: number | null;
  warningCount: number | null;
  errorCount: number | null;
  actor: ImportRunActor;
  duplicateOf: ImportRunReference | null;
  duplicateRunCount: number;
};

type ImportRunIssuePreview = {
  line: number;
  employeeCode: string | null;
  code: string;
  message: string | null;
  field: string | null;
  value: string | null;
};

type ImportRunDetail = {
  id: string;
  companyId: string;
  mode: ImportRunMode;
  sheetKind: string;
  sheetTitle: string;
  status: ImportRunStatus;
  outcome: ImportRunOutcome | null;
  contentHash: string;
  actor: ImportRunActor;
  requestedCount: number;
  processedCount: number | null;
  foundCount: number | null;
  changedCount: number | null;
  unchangedCount: number | null;
  rejectedCount: number | null;
  warningCount: number | null;
  errorCount: number | null;
  failedCode: string | null;
  failedMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  duplicateOf: ImportRunReference | null;
  duplicateRunsPreview: ImportRunReference[];
  duplicateRunCount: number;
  snapshots: {
    headerSummary: Record<string, unknown> | null;
    codeResolution: Record<string, unknown> | null;
    applySummary: Record<string, unknown> | null;
  };
  previews: {
    warnings: ImportRunIssuePreview[];
    errors: ImportRunIssuePreview[];
    changedEmployeeCodes: string[];
  };
  issueSummary: EmployeeImportIssueSummaryDto;
  readinessSummary: EmployeeImportReadinessSummaryDto | null;
  inspectionPolicy: {
    actorMasked: boolean;
    previewValuesMasked: boolean;
    previewRetentionDays: number;
    snapshotRetentionDays: number;
    issuePreviewLimit: number;
    changedEmployeePreviewLimit: number;
    previewsExpired: boolean;
    snapshotsExpired: boolean;
  };
};

type ImportRunListResponse = {
  ok: boolean;
  items: ImportRunListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  filters?: {
    runId: string | null;
    actor: string | null;
    employeeCode: string | null;
    mode: ImportRunMode | null;
    sheetKind: EmployeeImportSheetKind | null;
    status: ImportRunStatus | null;
    outcome: ImportRunOutcome | null;
    duplicateLinkage: "DUPLICATE" | "REFERENCE" | "ANY_LINKED" | null;
    startedAtFrom: string | null;
    startedAtTo: string | null;
  };
};

type ImportRunDetailResponse = {
  ok: boolean;
  item: ImportRunDetail;
};

type ImportRunHealthIssueSeverity = "critical" | "warning" | "info";

type ImportRunHealthReference = {
  refType: "LOCK" | "RUN";
  id: string;
  sheetKind: string;
  sheetTitle: string;
  actorUserId: string;
  mode: ImportRunMode | null;
  status: ImportRunStatus | null;
  outcome: ImportRunOutcome | null;
  acquiredAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  failedCode: string | null;
  duplicateOfRunId: string | null;
  recoveryAction: "NORMALIZE_STALE_SHEET_STATE" | null;
  recoverySheetKind: string | null;
};

type ImportRunHealthIssue = {
  code:
    | "STALE_APPLY_LOCK"
    | "ORPHAN_APPLY_LOCK"
    | "STALE_RUNNING_APPLY_RUN"
    | "STALE_RUNNING_DRY_RUN"
    | "RECENT_FAILED_RUN"
    | "RECENT_DUPLICATE_PATTERN";
  severity: ImportRunHealthIssueSeverity;
  title: string;
  message: string;
  count: number;
  references: ImportRunHealthReference[];
};

type ImportRunHealthSummary = {
  generatedAt: string;
  staleThresholdMinutes: number;
  recentFailureWindowDays: number;
  duplicatePatternWindowDays: number;
  counts: {
    activeApplyLocks: number;
    runningApplyRuns: number;
    runningDryRuns: number;
    staleApplyLocks: number;
    orphanApplyLocks: number;
    staleRunningApplyRuns: number;
    staleRunningDryRuns: number;
    recentFailedRuns: number;
    recentDuplicateRuns: number;
  };
  issues: ImportRunHealthIssue[];
};

type ImportRunHealthResponse = {
  ok: boolean;
  item: ImportRunHealthSummary;
};

type ImportRunOperationalRecoveryResult = {
  action: "NORMALIZE_STALE_SHEET_STATE";
  sheetKind: EmployeeImportSheetKind;
  staleThresholdDate: string;
  blocked: false;
  noOp: boolean;
  lockDeleted: boolean;
  recoveredApplyRunIds: string[];
  recoveredDryRunIds: string[];
  recoveredApplyRunCount: number;
  recoveredDryRunCount: number;
};

type ImportRunOperationalRecoveryResponse = {
  ok: boolean;
  item: ImportRunOperationalRecoveryResult;
  message?: string;
};

type ImportRunRetentionMaintenanceSummary = {
  generatedAt: string;
  previewRetentionDays: number;
  snapshotRetentionDays: number;
  previewThresholdDate: string;
  snapshotThresholdDate: string;
  counts: {
    previewPayloadCandidates: number;
    snapshotPayloadCandidates: number;
    distinctCandidateRuns: number;
  };
  oldestPreviewFinishedAt: string | null;
  oldestSnapshotFinishedAt: string | null;
};

type ImportRunRetentionMaintenanceSummaryResponse = {
  ok: boolean;
  item: ImportRunRetentionMaintenanceSummary;
};

type ImportRunRetentionMaintenanceResult = {
  action: "PRUNE_AGED_DETAIL_PAYLOADS";
  previewThresholdDate: string;
  snapshotThresholdDate: string;
  previewPayloadCleanedCount: number;
  snapshotPayloadCleanedCount: number;
  touchedRunCount: number;
  noOp: boolean;
};

type ImportRunRetentionMaintenanceResponse = {
  ok: boolean;
  item: ImportRunRetentionMaintenanceResult;
  message?: string;
};

type EmployeeImportUiPermissions = {
  canAccessWorkspace: boolean;
  canDownloadTemplate: boolean;
  canValidate: boolean;
  canApply: boolean;
  canReadHistory: boolean;
  canRecoverOperations: boolean;
};

type EmployeeImportUiVisibility = {
  mode: "COMPANY_ALL" | "LIMITED_USER_SCOPE_BLOCKED";
  blockedReason: string | null;
};

type ImportRunHistoryFilters = {
  runId: string;
  actor: string;
  employeeCode: string;
  mode: "" | ImportRunMode;
  sheetKind: "" | EmployeeImportSheetKind;
  status: "" | ImportRunStatus;
  outcome: "" | ImportRunOutcome;
  duplicateLinkage: "" | "DUPLICATE" | "REFERENCE" | "ANY_LINKED";
  startedAtFrom: string;
  startedAtTo: string;
};

type ImportRunHistoryListState = {
  items: ImportRunListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function detectDelimiterClient(firstLine: string): "," | ";" | "\t" {
  const line = firstLine ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitLineClient(line: string, delimiter: "," | ";" | "\t"): string[] {
  return String(line ?? "")
    .split(delimiter)
    .map((item) => item.trim());
}

function normalizeCsvText(text: string) {
  return text.replace(/^\uFEFF/, "");
}

type ImportIssueDisplayItem = {
  line?: number | null;
  employeeCode?: string | null;
  code: string;
  message?: string | null;
};

type ImportIssueDisplayGroup = {
  key: string;
  code: string;
  title: string;
  message: string;
  items: ImportIssueDisplayItem[];
};

function issuePrimaryId(issue: ImportIssueDisplayItem): string {
  const code = String(issue.employeeCode ?? "").trim();
  if (code) return code;
  if (typeof issue.line === "number" && issue.line > 0) return `Satır ${issue.line}`;
  return "—";
}

function issueAffectedLabel(issue: ImportIssueDisplayItem): string {
  if (typeof issue.line === "number" && issue.line > 0) return `Satır ${issue.line}`;
  return issuePrimaryId(issue);
}

function extractPreviousRunId(message?: string | null): string | null {
  const match = String(message ?? "").match(/(?:Önceki|Onceki)\s+runId:\s*([^\s]+)/i);
  return match?.[1] ?? null;
}

function formatIssueDisplayTitle(issue: ImportIssueDisplayItem): string {
  if (issue.code === "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED") {
    return "Bu dosya daha önce içe aktarılmış olabilir";
  }
  if (issue.code === "IS_ACTIVE_DERIVED_IN_PATCH_8_8") {
    return "Aktiflik bilgisi sistem tarafından hesaplanır";
  }
  if (issue.code === "COMPANY_CODE_REFERENCE_ONLY_IN_PATCH_8_8") {
    return "Şirket kodu bilgi amaçlı kontrol edilir";
  }
  if (issue.code === "HIRE_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8") {
    return "İşe giriş tarihi tek başına işlem başlatmaz";
  }
  if (issue.code === "TERMINATION_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8") {
    return "İşten çıkış tarihi tek başına işlem başlatmaz";
  }
  if (issue.code === "HIRE_DATE_IGNORED_FOR_TERMINATE_IN_PATCH_8_8") {
    return "İşten çıkarma işleminde işe giriş tarihi dikkate alınmaz";
  }
  if (issue.code === "TERMINATION_DATE_IGNORED_FOR_HIRE_IN_PATCH_8_8") {
    return "Yeni giriş işleminde işten çıkış tarihi dikkate alınmaz";
  }
  if (issue.code === "TERMINATION_DATE_IGNORED_FOR_REHIRE_IN_PATCH_8_8") {
    return "Tekrar işe alma işleminde işten çıkış tarihi dikkate alınmaz";
  }
  if (issue.code === "TERMINATION_DATE_REFERENCE_ONLY_ON_CREATE_IN_PATCH_8_8") {
    return "Yeni çalışan kaydında işten çıkış tarihi bilgi amaçlı kalır";
  }
  return issue.code;
}

function formatIssueDisplayMessage(issue: ImportIssueDisplayItem): string {
  if (issue.code === "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED") {
    const previousRunId = extractPreviousRunId(issue.message);
    return [
      "Sistem, bu dosya içeriğinin daha önce uygulanmış bir içe aktarım kaydıyla aynı olduğunu tespit etti. Devam etmeden önce önceki kaydı kontrol edin.",
      previousRunId ? `Önceki işlem kaydı: ${previousRunId}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (issue.code === "IS_ACTIVE_DERIVED_IN_PATCH_8_8") {
    return "Dosyadaki aktif/pasif alanı doğrudan çalışanı açıp kapatmaz. Çalışanın durumu işe giriş ve işten çıkış dönemlerine göre sistem tarafından belirlenir.";
  }
  if (issue.code === "COMPANY_CODE_REFERENCE_ONLY_IN_PATCH_8_8") {
    return "İçe aktarım mevcut şirket içinde çalışır. Dosyadaki şirket kodu yeni şirket seçimi veya şirket değişikliği başlatmaz.";
  }
  if (issue.code === "HIRE_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8") {
    return "Mevcut çalışan için işlem türü belirtilmediyse işe giriş tarihi yalnızca bilgi amaçlı değerlendirilir.";
  }
  if (issue.code === "TERMINATION_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8") {
    return "Mevcut çalışan için işlem türü belirtilmediyse işten çıkış tarihi yalnızca bilgi amaçlı değerlendirilir.";
  }
  if (issue.code === "HIRE_DATE_IGNORED_FOR_TERMINATE_IN_PATCH_8_8") {
    return "İşten çıkarma işleminde çalışanı kapatan tarih işten çıkış tarihidir. İşe giriş tarihi bu işlemde değişiklik üretmez.";
  }
  if (issue.code === "TERMINATION_DATE_IGNORED_FOR_HIRE_IN_PATCH_8_8") {
    return "Yeni giriş işleminde çalışanı başlatan tarih işe giriş tarihidir. İşten çıkış tarihi bu işlemde değişiklik üretmez.";
  }
  if (issue.code === "TERMINATION_DATE_IGNORED_FOR_REHIRE_IN_PATCH_8_8") {
    return "Tekrar işe alma işleminde çalışanı yeniden başlatan tarih işe giriş tarihidir. İşten çıkış tarihi bu işlemde değişiklik üretmez.";
  }
  if (issue.code === "TERMINATION_DATE_REFERENCE_ONLY_ON_CREATE_IN_PATCH_8_8") {
    return "Sistemde olmayan çalışan oluşturulurken işten çıkış tarihi çalışanı otomatik kapatmaz; yalnızca bilgi amaçlı değerlendirilir.";
  }
  return String(issue.message ?? "").trim() || "Mesaj yok.";
}

function formatIssueDisplayBadge(issueCode: string): string {
  if (issueCode === "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED") return "Benzer içerik";
  if (issueCode === "COMPANY_CODE_REFERENCE_ONLY_IN_PATCH_8_8") return "Şirket bilgisi";
  if (
    issueCode === "IS_ACTIVE_DERIVED_IN_PATCH_8_8" ||
    issueCode === "HIRE_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8" ||
    issueCode === "TERMINATION_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8" ||
    issueCode === "HIRE_DATE_IGNORED_FOR_TERMINATE_IN_PATCH_8_8" ||
    issueCode === "TERMINATION_DATE_IGNORED_FOR_HIRE_IN_PATCH_8_8" ||
    issueCode === "TERMINATION_DATE_IGNORED_FOR_REHIRE_IN_PATCH_8_8" ||
    issueCode === "TERMINATION_DATE_REFERENCE_ONLY_ON_CREATE_IN_PATCH_8_8"
  ) {
    return "Zaman kapsamı";
  }
  return issueCode;
}

function groupImportIssueDisplayItems(issues: ImportIssueDisplayItem[]): ImportIssueDisplayGroup[] {
  const groups = new Map<string, ImportIssueDisplayGroup>();
  for (const issue of issues) {
    const title = formatIssueDisplayTitle(issue);
    const message = formatIssueDisplayMessage(issue);
    const key = `${issue.code}::${message}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(issue);
      continue;
    }
    groups.set(key, {
      key,
      code: issue.code,
      title,
      message,
      items: [issue],
    });
  }
  return Array.from(groups.values());
}

function ImportWarningGroupList({ issues }: { issues: ImportIssueDisplayItem[] }) {
  const groups = groupImportIssueDisplayItems(issues);
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const itemCount = group.items.length;
        const affectedLabel = itemCount === 1 ? issueAffectedLabel(group.items[0]) : `${itemCount} satırda tekrar ediyor`;
        return (
          <details
            key={group.key}
            className="group rounded-2xl border border-amber-100 bg-white/95 px-4 py-3 text-sm text-amber-900 shadow-sm open:border-amber-200 open:bg-amber-50"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 marker:hidden">
              <span className="min-w-0">
                <span className="block font-semibold text-amber-950">{group.title}</span>
                <span className="mt-1 block leading-6">{group.message}</span>
                <span className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    {affectedLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {formatIssueDisplayBadge(group.code)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                {itemCount > 1 ? "Detayları aç" : "Detay"}
              </span>
            </summary>
            <div className="mt-3 border-t border-amber-100 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Etkilenen satırlar</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.items.map((item, idx) => (
                  <span
                    key={`${group.key}-${issueAffectedLabel(item)}-${idx}`}
                    className="rounded-full border border-white bg-white px-2.5 py-1 text-xs font-medium text-amber-900 shadow-sm"
                  >
                    {issueAffectedLabel(item)}
                  </span>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function humanFieldLabel(field?: EmployeeImportFieldKey) {
  if (!field) return null;
  return EMPLOYEE_IMPORT_FIELDS[field]?.label ?? field;
}

function formatRunModeLabel(mode: ImportRunMode) {
  return mode === "DRY_RUN" ? "Doğrulama" : "Uygulama";
}

function formatRunStatusLabel(status: ImportRunStatus) {
  if (status === "RUNNING") return "Çalışıyor";
  if (status === "FAILED") return "Başarısız";
  return "Tamamlandı";
}

function formatRunOutcomeLabel(outcome: ImportRunOutcome | null) {
  if (outcome === "CLEAN") return "Temiz";
  if (outcome === "WARNING") return "Uyarılı";
  if (outcome === "BLOCKING") return "Bloklayan";
  if (outcome === "PARTIAL") return "Kısmi";
  return "Belirtilmedi";
}

function formatActorRoleLabel(role: string | null | undefined) {
  if (role === "SYSTEM_ADMIN") return "Sistem yöneticisi";
  if (role === "HR_CONFIG_ADMIN") return "İK yapılandırma yöneticisi";
  if (role === "HR_OPERATOR") return "İK operasyon kullanıcısı";
  if (role === "SUPERVISOR") return "Ekip yöneticisi";
  return role || "Belirtilmedi";
}

function runModeTone(mode: ImportRunMode) {
  return mode === "DRY_RUN"
    ? "border-slate-300 bg-slate-100 text-slate-700"
    : "border-sky-200 bg-sky-50 text-sky-700";
}

function runStatusTone(status: ImportRunStatus) {
  if (status === "RUNNING") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "FAILED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function runOutcomeTone(outcome: ImportRunOutcome | null) {
  if (outcome === "CLEAN") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (outcome === "WARNING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (outcome === "BLOCKING") return "border-rose-200 bg-rose-50 text-rose-700";
  if (outcome === "PARTIAL") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function runHealthSeverityTone(severity: ImportRunHealthIssueSeverity) {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function formatRunHealthSeverityLabel(severity: ImportRunHealthIssueSeverity) {
  if (severity === "critical") return "Kritik";
  if (severity === "warning") return "Uyarı";
  return "Bilgi";
}

function formatRunHealthReferenceDate(reference: ImportRunHealthReference) {
  return formatRunDateTime(reference.refType === "LOCK" ? reference.acquiredAt : reference.startedAt);
}

function formatApplySummaryDescription(summary: ImportApplySummary) {
  if (summary.kind === "FULL_DATA") {
    return "Tam toplu aktarım özeti. İstihdam, kişisel, organizasyon ve çalışma verileri bu işlemde birlikte değerlendirildi.";
  }
  if (summary.kind === "PERSONAL_DATA") {
    return "Kişisel veri aktarım özeti. Profil değişiklikleri, kart ilk dolumları ve reddedilen satırlar burada görünür.";
  }
  if (summary.kind === "WORK_DATA") {
    return "Çalışma verileri aktarım özeti. Desen değişiklikleri, kart kontrolleri ve yeniden hesaplama sonucu burada görünür.";
  }
  return "Organizasyon verileri aktarım özeti. Organizasyon değişiklikleri, kart kontrolleri ve yeniden hesaplama sonucu burada görünür.";
}

function formatImportRunCardTitle(runRef: ImportResultRunRef) {
  return runRef.mode === "DRY_RUN" ? "Doğrulama kaydı" : "İçe aktarım kaydı";
}

function formatImportRunDetailActionLabel(runRef: ImportResultRunRef) {
  return runRef.mode === "DRY_RUN" ? "Doğrulama kaydını aç" : "İşlem kaydını aç";
}

function formatImportResultSectionLabel(result: ImportResult) {
  return result.applySummary ? "İşlem sonucu" : "Kontrol sonucu";
}

function formatImportResultHeadline(result: ImportResult) {
  if (result.applySummary) {
    return result.applySummary.rejected === 0
      ? "İşlem tamamlandı"
      : "İşlem tamamlandı, bazı satırlar gözden geçirilmeli";
  }
  if (result.readinessSummary) return result.readinessSummary.headline;
  return result.canProceedToNextPhase ? "Kontrol tamamlandı" : "Kontrol tamamlandı, düzeltmeler gerekiyor";
}

function formatImportResultSupportText(result: ImportResult) {
  if (result.applySummary) {
    return formatApplySummaryDescription(result.applySummary);
  }
  if (result.readinessSummary) return result.readinessSummary.supportText;
  if (result.errors.length > 0) {
    return `${result.totals.invalid} satır uygulama öncesi düzeltme bekliyor. Önce sorunları açıp gözden geçirebilirsiniz.`;
  }
  if (result.warnings.length > 0) {
    return "Kontrol tamamlandı. İsterseniz uyarıları inceleyip ardından uygulamaya geçebilirsiniz.";
  }
  return "Veri seti uygulamaya hazır görünüyor.";
}

function buildImportResultDialogMetrics(result: ImportResult): ActionResultDialogState["metrics"] {
  if (result.applySummary) {
    return getCompactApplySummaryStats(result.applySummary)
      .slice(0, 3)
      .map(([label, value]) => ({ label: String(label), value }));
  }

  return [
    { label: "Toplam satır", value: result.totals.rows },
    {
      label: result.canProceedToNextPhase ? "Uygun" : "Düzeltilecek",
      value: result.canProceedToNextPhase ? result.totals.valid : result.totals.invalid,
    },
    { label: "Uyarı", value: result.warnings.length },
  ];
}

function buildImportResultDialogAction(
  result: ImportResult,
  args: {
    canReadHistory: boolean;
    hasIssueDetails: boolean;
    hasPreviewRows: boolean;
    hasTechnicalDetails: boolean;
  },
): ActionResultDialogState["primaryAction"] {
  if (result.applySummary) {
    if (args.hasIssueDetails && result.applySummary.rejected > 0) {
      return { key: "OPEN_ISSUES", label: "Düzeltmeleri aç" };
    }
    if (result.runRef && args.canReadHistory) {
      return { key: "OPEN_RUN_DETAIL", label: "İşlem detayını aç" };
    }
    if (args.hasTechnicalDetails) {
      return { key: "OPEN_TECHNICAL", label: "Teknik özeti aç" };
    }
    return undefined;
  }

  const readinessStatus =
    result.readinessSummary?.status ??
    (result.canProceedToNextPhase ? "READY" : result.errors.length > 0 ? "BLOCKED" : "REVIEW");

  if (readinessStatus === "BLOCKED" && args.hasIssueDetails) {
    return { key: "OPEN_ISSUES", label: "Sorunları aç" };
  }
  if (readinessStatus === "REVIEW" && args.hasIssueDetails) {
    return { key: "OPEN_ISSUES", label: "Uyarıları incele" };
  }
  if (args.hasPreviewRows) {
    return { key: "OPEN_PREVIEW", label: "Önizlemeyi aç" };
  }
  if (args.hasTechnicalDetails) {
    return { key: "OPEN_TECHNICAL", label: "Teknik özeti aç" };
  }
  return undefined;
}

function buildImportResultDialog(
  result: ImportResult,
  args: {
    canReadHistory: boolean;
    hasIssueDetails: boolean;
    hasPreviewRows: boolean;
    hasTechnicalDetails: boolean;
  },
): ActionResultDialogState {
  if (result.applySummary) {
    const requiresReview = result.applySummary.rejected > 0 || !result.ok;

    return {
      sourceLabel: "Uygulama sonucu",
      tone: requiresReview ? "warning" : "success",
      statusLabel: requiresReview ? "Gözden geçir" : "Başarılı",
      title: requiresReview ? "İşlem tamamlandı, kontrol gerekli" : "İşlem başarıyla tamamlandı",
      description: requiresReview
        ? "Bazı satırlar uygulandı, bazıları ise gözden geçirme bekliyor."
        : "İçe aktarım işlemi tamamlandı. Sonucu kısaca onaylayıp isterseniz ayrıntılara geçin.",
      detail: formatImportResultSupportText(result),
      metrics: buildImportResultDialogMetrics(result),
      primaryAction: buildImportResultDialogAction(result, args),
    };
  }

  const readinessStatus =
    result.readinessSummary?.status ??
    (result.canProceedToNextPhase ? "READY" : result.errors.length > 0 ? "BLOCKED" : "REVIEW");

  if (readinessStatus === "READY") {
    return {
      sourceLabel: "Kontrol sonucu",
      tone: "success",
      statusLabel: "Hazır",
      title: "Kontrol tamamlandı",
      description: "Dosya uygulama öncesi temiz görünüyor.",
      detail: formatImportResultSupportText(result),
      metrics: buildImportResultDialogMetrics(result),
      primaryAction: buildImportResultDialogAction(result, args),
    };
  }

  if (readinessStatus === "REVIEW") {
    return {
      sourceLabel: "Kontrol sonucu",
      tone: "warning",
      statusLabel: "Gözden geçir",
      title: "Kontrol tamamlandı, düzeltme öneriliyor",
      description: "Dosya ilerleyebilir görünüyor ancak önce dikkat isteyen satırları incelemek daha güvenli olur.",
      detail: formatImportResultSupportText(result),
      metrics: buildImportResultDialogMetrics(result),
      primaryAction: buildImportResultDialogAction(result, args),
    };
  }

  return {
    sourceLabel: "Kontrol sonucu",
    tone: "error",
    statusLabel: "Düzeltme gerekli",
    title: "Düzeltme gerekiyor",
    description: "Bu dosya mevcut haliyle uygulamaya hazır değil.",
    detail: formatImportResultSupportText(result),
    metrics: buildImportResultDialogMetrics(result),
    primaryAction: buildImportResultDialogAction(result, args),
  };
}

function buildImportActionFailureDialog(action: "VALIDATE" | "APPLY", message: string): ActionResultDialogState {
  return {
    sourceLabel: action === "VALIDATE" ? "Kontrol sonucu" : "Uygulama sonucu",
    tone: "error",
    statusLabel: "Tamamlanamadı",
    title: action === "VALIDATE" ? "Kontrol tamamlanamadı" : "Uygulama tamamlanamadı",
    description: message,
    detail: "Detayları sayfadaki hata alanında veya teknik bölümlerde inceleyebilirsiniz.",
    metrics: [],
  };
}

function getCompactApplySummaryStats(summary: ImportApplySummary): Array<[string, string | number]> {
  if (summary.kind === "FULL_DATA") {
    return [
      ["Değişen", summary.changed],
      ["Yeni", summary.created],
      ["Reddedilen", summary.rejected],
      ["Yeniden hesaplama", summary.recomputeQueued ? "Var" : "Yok"],
    ];
  }
  if (summary.kind === "PERSONAL_DATA") {
    return [
      ["Değişen", summary.changed],
      ["Profil", summary.profileChanged],
      ["Reddedilen", summary.rejected],
      ["Kart ilk dolumu", summary.cardFilled],
    ];
  }
  if (summary.kind === "WORK_DATA") {
    return [
      ["Değişen", summary.changed],
      ["Plan", summary.workScheduleChanged],
      ["Reddedilen", summary.rejected],
      ["Yeniden hesaplama", summary.recomputeQueued ? "Var" : "Yok"],
    ];
  }
  return [
    ["Değişen", summary.changed],
    ["Organizasyon", summary.orgChanged],
    ["Reddedilen", summary.rejected],
    ["Yeniden hesaplama", summary.recomputeQueued ? "Var" : "Yok"],
  ];
}

function formatRunDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function actorPrimaryLabel(actor: ImportRunActor) {
  return actor.email || actor.userId;
}

function formatWorkspaceViewLabel(view: ImportWorkspaceView) {
  return view === "import" ? "İçe Aktarım" : "Geçmiş ve İnceleme";
}

function buildDefaultRunHistoryFilters(): ImportRunHistoryFilters {
  return {
    runId: "",
    actor: "",
    employeeCode: "",
    mode: "",
    sheetKind: "",
    status: "",
    outcome: "",
    duplicateLinkage: "",
    startedAtFrom: "",
    startedAtTo: "",
  };
}

function buildEmptyRunHistoryListState(limit = 12): ImportRunHistoryListState {
  return {
    items: [],
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  };
}

function hasActiveRunHistoryFilters(filters: ImportRunHistoryFilters) {
  return Boolean(
    toQueryText(filters.runId) ||
      toQueryText(filters.actor) ||
      toQueryText(filters.employeeCode) ||
      filters.mode ||
      filters.sheetKind ||
      filters.status ||
      filters.outcome ||
      filters.duplicateLinkage ||
      toQueryText(filters.startedAtFrom) ||
      toQueryText(filters.startedAtTo),
  );
}

function formatDuplicateLinkageLabel(value: ImportRunHistoryFilters["duplicateLinkage"]) {
  if (value === "DUPLICATE") return "Yinelenen kayıt";
  if (value === "REFERENCE") return "Referans kayıt";
  if (value === "ANY_LINKED") return "Bağlantılı tüm kayıtlar";
  return "Tümü";
}

function toQueryText(value: string) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function buildImportRunHistorySearchParams(args: {
  filters: ImportRunHistoryFilters;
  page: number;
  limit: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(args.page));
  params.set("limit", String(args.limit));

  const entries: Array<[string, string | null]> = [
    ["runId", toQueryText(args.filters.runId)],
    ["actor", toQueryText(args.filters.actor)],
    ["employeeCode", toQueryText(args.filters.employeeCode)],
    ["mode", args.filters.mode || null],
    ["sheetKind", args.filters.sheetKind || null],
    ["status", args.filters.status || null],
    ["outcome", args.filters.outcome || null],
    ["duplicateLinkage", args.filters.duplicateLinkage || null],
    ["startedAtFrom", toQueryText(args.filters.startedAtFrom)],
    ["startedAtTo", toQueryText(args.filters.startedAtTo)],
  ];

  for (const [key, value] of entries) {
    if (value) params.set(key, value);
  }

  return params;
}

function formatDrawerTabLabel(tab: ImportRunDrawerTab) {
  if (tab === "warnings") return "Uyarılar";
  if (tab === "errors") return "Hatalar";
  if (tab === "snapshots") return "Anlık görüntüler";
  return "Özet";
}

function parseAttachmentFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] ?? null;
}

async function requestImportRunHistoryList(args: {
  filters: ImportRunHistoryFilters;
  page: number;
  limit?: number;
}): Promise<ImportRunHistoryListState> {
  const params = buildImportRunHistorySearchParams({
    filters: args.filters,
    page: args.page,
    limit: args.limit ?? 12,
  });
  const res = await fetch(`/api/employees/import/runs?${params.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (ImportRunListResponse & { message?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(json?.message || `İşlem kaydı geçmişi alınamadı (${res.status})`);
  }
  return {
    items: Array.isArray(json.items) ? json.items : [],
    page: typeof json.page === "number" ? json.page : args.page,
    limit: typeof json.limit === "number" ? json.limit : args.limit ?? 12,
    total: typeof json.total === "number" ? json.total : 0,
    totalPages: typeof json.totalPages === "number" ? json.totalPages : 0,
  };
}

async function requestImportRunDetail(runId: string): Promise<ImportRunDetail> {
  const res = await fetch(`/api/employees/import/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (ImportRunDetailResponse & { message?: string }) | null;
  if (!res.ok || !json?.item) {
    throw new Error(json?.message || `İşlem kaydı detayı alınamadı (${res.status})`);
  }
  return json.item;
}

async function requestImportRunSupportHandoffBundleExport(runId: string): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(`/api/employees/import/runs/${encodeURIComponent(runId)}/support-handoff-bundle`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message || `Destek paketi indirilemedi (${res.status})`);
  }

  return {
    blob: await res.blob(),
    filename: parseAttachmentFilename(res.headers.get("Content-Disposition")),
  };
}

async function requestImportRunCorrectionPackExport(runId: string): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(`/api/employees/import/runs/${encodeURIComponent(runId)}/correction-pack`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message || `Düzeltme paketi indirilemedi (${res.status})`);
  }

  return {
    blob: await res.blob(),
    filename: parseAttachmentFilename(res.headers.get("content-disposition")),
  };
}

async function requestImportRunHealthSummary(): Promise<ImportRunHealthSummary> {
  const res = await fetch("/api/employees/import/runs/health", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (ImportRunHealthResponse & { message?: string }) | null;
  if (!res.ok || !json?.item) {
    throw new Error(json?.message || `İçe aktarım sağlığı alınamadı (${res.status})`);
  }
  return json.item;
}

async function requestImportRunOperationalRecovery(sheetKind: string): Promise<ImportRunOperationalRecoveryResult> {
  const res = await fetch("/api/employees/import/runs/operations/recover", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "NORMALIZE_STALE_SHEET_STATE",
      sheetKind,
    }),
  });
  const json = (await res.json().catch(() => null)) as (ImportRunOperationalRecoveryResponse & { message?: string }) | null;
  if (!res.ok || !json?.item) {
    throw new Error(json?.message || `Operasyon düzeltmesi tamamlanamadı (${res.status})`);
  }
  return json.item;
}

async function requestImportRunRetentionMaintenanceSummary(): Promise<ImportRunRetentionMaintenanceSummary> {
  const res = await fetch("/api/employees/import/runs/operations/retention-maintenance", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | (ImportRunRetentionMaintenanceSummaryResponse & { message?: string })
    | null;
  if (!res.ok || !json?.item) {
      throw new Error(json?.message || `Saklama bakımı özeti alınamadı (${res.status})`);
  }
  return json.item;
}

async function requestImportRunRetentionMaintenance(): Promise<ImportRunRetentionMaintenanceResult> {
  const res = await fetch("/api/employees/import/runs/operations/retention-maintenance", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "PRUNE_AGED_DETAIL_PAYLOADS",
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | (ImportRunRetentionMaintenanceResponse & { message?: string })
    | null;
  if (!res.ok || !json?.item) {
      throw new Error(json?.message || `Saklama bakımı çalıştırılamadı (${res.status})`);
  }
  return json.item;
}

export default function EmployeesImportClient({
  permissions,
  visibility,
}: {
  permissions: EmployeeImportUiPermissions;
  visibility: EmployeeImportUiVisibility;
}) {
  const canAccessWorkspace = permissions.canAccessWorkspace;
  const canDownloadTemplate = permissions.canDownloadTemplate;
  const canValidate = permissions.canValidate;
  const canApply = permissions.canApply;
  const canReadHistory = permissions.canReadHistory;
  const canRecoverOperations = permissions.canRecoverOperations;
  const canUseImportWorkspace = canDownloadTemplate || canValidate || canApply;
  const visibilityBlockedReason = visibility.blockedReason;
  const [activeView, setActiveView] = useState<ImportWorkspaceView>("import");
  const [selectedSheetKind, setSelectedSheetKind] = useState<EmployeeImportSheetKind | "">("");
  const [sourceType, setSourceType] = useState<"text" | "xlsx">("text");
  const [csvText, setCsvText] = useState<string>("");
  const [xlsxSheets, setXlsxSheets] = useState<WorkbookSheet[]>([]);
  const [selectedWorkbookSheet, setSelectedWorkbookSheet] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [actionResultDialog, setActionResultDialog] = useState<ActionResultDialogState | null>(null);
  const [draftRunHistoryFilters, setDraftRunHistoryFilters] = useState<ImportRunHistoryFilters>(() => buildDefaultRunHistoryFilters());
  const [appliedRunHistoryFilters, setAppliedRunHistoryFilters] = useState<ImportRunHistoryFilters>(() => buildDefaultRunHistoryFilters());
  const [runHistoryPage, setRunHistoryPage] = useState(1);
  const [runHealth, setRunHealth] = useState<ImportRunHealthSummary | null>(null);
  const [runHealthLoading, setRunHealthLoading] = useState(false);
  const [runHealthError, setRunHealthError] = useState<string | null>(null);
  const [recoverySheetKind, setRecoverySheetKind] = useState<string | null>(null);
  const [retentionMaintenanceSummary, setRetentionMaintenanceSummary] = useState<ImportRunRetentionMaintenanceSummary | null>(null);
  const [retentionMaintenanceLoading, setRetentionMaintenanceLoading] = useState(false);
  const [retentionMaintenanceError, setRetentionMaintenanceError] = useState<string | null>(null);
  const [retentionMaintenanceRunning, setRetentionMaintenanceRunning] = useState(false);
  const [runHistoryState, setRunHistoryState] = useState<ImportRunHistoryListState>(() => buildEmptyRunHistoryListState());
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<ImportRunDetail | null>(null);
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);
  const [selectedRunError, setSelectedRunError] = useState<string | null>(null);
  const [exportingRunId, setExportingRunId] = useState<string | null>(null);
  const [exportingCorrectionRunId, setExportingCorrectionRunId] = useState<string | null>(null);
  const [activeRunDrawerTab, setActiveRunDrawerTab] = useState<ImportRunDrawerTab>("summary");
  const [showTemplateFields, setShowTemplateFields] = useState(false);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [showResultIssues, setShowResultIssues] = useState(false);
  const [showResultPreviewRows, setShowResultPreviewRows] = useState(false);
  const [showResultTechnical, setShowResultTechnical] = useState(false);
  const [pinResultIssueToggle, setPinResultIssueToggle] = useState(false);
  const [pinResultPreviewToggle, setPinResultPreviewToggle] = useState(false);
  const [pinResultTechnicalToggle, setPinResultTechnicalToggle] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const resultIssuesSectionRef = useRef<HTMLDivElement | null>(null);
  const resultPreviewRowsSectionRef = useRef<HTMLDivElement | null>(null);
  const resultTechnicalSectionRef = useRef<HTMLDivElement | null>(null);
  const runDetailScrollRef = useRef<HTMLElement | null>(null);
  const hasActiveHistoryFilters = useMemo(
    () => hasActiveRunHistoryFilters(appliedRunHistoryFilters),
    [appliedRunHistoryFilters],
  );

  const sheetMeta = useMemo(() => (selectedSheetKind ? getEmployeeImportSheet(selectedSheetKind) : null), [selectedSheetKind]);
  const selectedWorkbookMeta = useMemo(
    () => xlsxSheets.find((sheet) => sheet.name === selectedWorkbookSheet) ?? null,
    [selectedWorkbookSheet, xlsxSheets]
  );

  const effectiveText = sourceType === "xlsx" ? selectedWorkbookMeta?.text ?? "" : csvText;

  const preview = useMemo(() => {
    const text = normalizeCsvText(effectiveText).trim();
    if (!text) return null;
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const delimiter = detectDelimiterClient(lines[0]);
    const header = splitLineClient(lines[0], delimiter);
    const second = lines.length > 1 ? splitLineClient(lines[1], delimiter) : [];
    return { delimiter, header, second, lineCount: lines.length };
  }, [effectiveText]);

  const normalizedPreviewHeaders = useMemo(
    () => (preview?.header ?? []).map((item) => normalizeEmployeeImportHeader(item)),
    [preview]
  );

  const matchedTemplateHeaderCount = useMemo(() => {
    if (!preview || !sheetMeta) return 0;
    return sheetMeta.headers.filter((field) => normalizedPreviewHeaders.includes(normalizeEmployeeImportHeader(field))).length;
  }, [normalizedPreviewHeaders, preview, sheetMeta]);

  const hasResultIssueDetails = Boolean(result && (result.errors.length > 0 || result.warnings.length > 0));
  const hasResultPreviewDetails = Boolean(result && result.previewRows.length > 0);
  const hasResultTechnicalDetails = Boolean(result);
  const historyConsoleLoading = runHistoryLoading || runHealthLoading || retentionMaintenanceLoading;
  const guidedRemediationPlan = useMemo(
    () =>
      result
        ? buildEmployeeImportGuidedRemediationPlan({
            readinessSummary: result.readinessSummary,
            issueSummary: result.issueSummary,
            hasApplySummary: Boolean(result.applySummary),
            rejectedCount: result.applySummary?.rejected ?? 0,
            hasIssueDetails: hasResultIssueDetails,
            hasPreviewRows: hasResultPreviewDetails,
            hasTechnicalDetails: hasResultTechnicalDetails,
            hasRunRef: Boolean(result.runRef),
            canReadHistory,
            canApply,
            applyEnabled: Boolean(result.applyEnabled),
          })
        : null,
    [
      canApply,
      canReadHistory,
      hasResultIssueDetails,
      hasResultPreviewDetails,
      hasResultTechnicalDetails,
      result,
    ],
  );
  const guidedRemediationActionKeys = useMemo(
    () => new Set(guidedRemediationPlan?.actions.map((item) => item.key) ?? []),
    [guidedRemediationPlan],
  );
  const showIssueToggleInActionRow =
    hasResultIssueDetails &&
    (!guidedRemediationActionKeys.has("OPEN_ISSUES") || showResultIssues || pinResultIssueToggle);
  const showPreviewToggleInActionRow =
    hasResultPreviewDetails &&
    (!guidedRemediationActionKeys.has("OPEN_PREVIEW") || showResultPreviewRows || pinResultPreviewToggle);
  const showTechnicalToggleInActionRow =
    hasResultTechnicalDetails &&
    (!guidedRemediationActionKeys.has("OPEN_TECHNICAL") || showResultTechnical || pinResultTechnicalToggle);
  const guidedRemediationActionLabels: Partial<Record<EmployeeImportGuidedRemediationActionKey, string>> = {
    OPEN_ISSUES: "Sorunları aç",
    DOWNLOAD_CORRECTION_PACK: "Düzeltme paketini indir",
    OPEN_PREVIEW: "Önizlemeyi aç",
    OPEN_TECHNICAL: "Teknik özeti aç",
    APPLY_NOW: "Şimdi uygula",
    OPEN_RUN_DETAIL: "İşlem kaydına git",
  };

  function showToast(kind: ToastKind, message: string) {
    setToast({ kind, message });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function closeActionResultDialog() {
    setActionResultDialog(null);
  }

  function scrollToSection(ref: { current: HTMLDivElement | null }) {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  const loadRunHistory = useCallback(async () => {
    if (!canReadHistory) return;

    setRunHistoryLoading(true);
    setRunHistoryError(null);
    try {
      setRunHistoryState(
        await requestImportRunHistoryList({
          filters: appliedRunHistoryFilters,
          page: runHistoryPage,
          limit: 12,
        }),
      );
    } catch (err: unknown) {
      setRunHistoryError(getErrorMessage(err, "İşlem kaydı geçmişi alınamadı."));
    } finally {
      setRunHistoryLoading(false);
    }
  }, [appliedRunHistoryFilters, canReadHistory, runHistoryPage]);

  const loadRunHealth = useCallback(async () => {
    if (!canReadHistory) return;

    setRunHealthLoading(true);
    setRunHealthError(null);
    try {
      setRunHealth(await requestImportRunHealthSummary());
    } catch (err: unknown) {
      setRunHealth(null);
      setRunHealthError(getErrorMessage(err, "İçe aktarım sağlığı alınamadı."));
    } finally {
      setRunHealthLoading(false);
    }
  }, [canReadHistory]);

  const loadRetentionMaintenanceSummary = useCallback(async () => {
    if (!canRecoverOperations) {
      setRetentionMaintenanceSummary(null);
      setRetentionMaintenanceError(null);
      return;
    }

    setRetentionMaintenanceLoading(true);
    setRetentionMaintenanceError(null);
    try {
      setRetentionMaintenanceSummary(await requestImportRunRetentionMaintenanceSummary());
    } catch (err: unknown) {
      setRetentionMaintenanceSummary(null);
      setRetentionMaintenanceError(getErrorMessage(err, "Saklama bakımı özeti alınamadı."));
    } finally {
      setRetentionMaintenanceLoading(false);
    }
  }, [canRecoverOperations]);

  const refreshHistoryConsole = useCallback(async () => {
    if (!canReadHistory) return;
    const tasks = [loadRunHistory(), loadRunHealth()];
    if (canRecoverOperations) tasks.push(loadRetentionMaintenanceSummary());
    await Promise.all(tasks);
  }, [canReadHistory, canRecoverOperations, loadRetentionMaintenanceSummary, loadRunHealth, loadRunHistory]);

  function beginRunDetailLoad(runId: string) {
    setActiveView("history");
    setSelectedRunId(runId);
    setSelectedRunLoading(true);
    setSelectedRunError(null);
    setSelectedRunDetail(null);
    setActiveRunDrawerTab("summary");
  }

  function applyRunHistoryFilters() {
    setAppliedRunHistoryFilters({ ...draftRunHistoryFilters });
    setRunHistoryPage(1);
  }

  function resetRunHistoryFilters() {
    const nextFilters = buildDefaultRunHistoryFilters();
    setDraftRunHistoryFilters(nextFilters);
    setAppliedRunHistoryFilters(nextFilters);
    setRunHistoryPage(1);
  }

  async function openRunDetail(runId: string) {
    if (!canReadHistory) {
      showToast("warn", "Bu hesabın işlem kaydı geçmişini inceleme yetkisi yok.");
      return;
    }

    const normalizedRunId = String(runId ?? "").trim();
    if (!normalizedRunId) return;

    beginRunDetailLoad(normalizedRunId);

    try {
      setSelectedRunDetail(await requestImportRunDetail(normalizedRunId));
    } catch (err: unknown) {
      const message = getErrorMessage(err, "İşlem kaydı detayı alınamadı.");
      setSelectedRunError(message);
      showToast("error", message);
    } finally {
      setSelectedRunLoading(false);
    }
  }

  async function handleSupportHandoffBundleExport(runId: string) {
    const normalizedRunId = String(runId ?? "").trim();
    if (!normalizedRunId) return;

    setExportingRunId(normalizedRunId);
    try {
      const file = await requestImportRunSupportHandoffBundleExport(normalizedRunId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || `import-run-support-handoff-${normalizedRunId}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Destek paketi indirildi.");
    } catch (err: unknown) {
      showToast("error", getErrorMessage(err, "Destek paketi indirilemedi."));
    } finally {
      setExportingRunId(null);
    }
  }

  async function handleCorrectionPackExport(runId: string) {
    const normalizedRunId = String(runId ?? "").trim();
    if (!normalizedRunId) return;

    setExportingCorrectionRunId(normalizedRunId);
    try {
      const file = await requestImportRunCorrectionPackExport(normalizedRunId);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || `import-correction-pack-${normalizedRunId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Düzeltme paketi indirildi.");
    } catch (err: unknown) {
      showToast("error", getErrorMessage(err, "Düzeltme paketi indirilemedi."));
    } finally {
      setExportingCorrectionRunId(null);
    }
  }

  function handleGuidedRemediationAction(actionKey: EmployeeImportGuidedRemediationActionKey) {
    if (!result) return;

    if (actionKey === "OPEN_ISSUES") {
      setPinResultIssueToggle(true);
      setShowResultIssues(true);
      scrollToSection(resultIssuesSectionRef);
      return;
    }
    if (actionKey === "DOWNLOAD_CORRECTION_PACK") {
      if (result.runRef) {
        void handleCorrectionPackExport(result.runRef.id);
      }
      return;
    }
    if (actionKey === "OPEN_PREVIEW") {
      setPinResultPreviewToggle(true);
      setShowResultPreviewRows(true);
      scrollToSection(resultPreviewRowsSectionRef);
      return;
    }
    if (actionKey === "OPEN_TECHNICAL") {
      setPinResultTechnicalToggle(true);
      setShowResultTechnical(true);
      scrollToSection(resultTechnicalSectionRef);
      return;
    }
    if (actionKey === "APPLY_NOW") {
      void runApply();
      return;
    }
    if (actionKey === "OPEN_RUN_DETAIL" && result.runRef) {
      void openRunDetail(result.runRef.id);
    }
  }

  function handleActionResultDialogPrimaryAction(actionKey: EmployeeImportGuidedRemediationActionKey) {
    setActionResultDialog(null);
    handleGuidedRemediationAction(actionKey);
  }

  async function handleOperationalRecovery(sheetKind: string) {
    if (!canRecoverOperations) {
      showToast("warn", "Bu hesabın operasyon düzeltme yetkisi yok.");
      return;
    }

    const normalizedSheetKind = String(sheetKind ?? "").trim();
    if (!normalizedSheetKind) return;

    setRecoverySheetKind(normalizedSheetKind);
    try {
      const recovery = await requestImportRunOperationalRecovery(normalizedSheetKind);
      await refreshHistoryConsole();
      showToast(
        recovery.noOp ? "info" : "success",
        recovery.noOp
          ? `${formatEmployeeImportSheetTitle(recovery.sheetKind, null)} için toparlama gerektiren bayat veya sahipsiz durum kalmamış.`
          : `${formatEmployeeImportSheetTitle(recovery.sheetKind, null)} için operasyon düzeltmesi tamamlandı.`,
      );
      if (selectedRunId) {
        void openRunDetail(selectedRunId);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Operasyon düzeltmesi tamamlanamadı.");
      showToast("error", message);
    } finally {
      setRecoverySheetKind(null);
    }
  }

  async function handleRetentionMaintenance() {
    if (!canRecoverOperations) {
        showToast("warn", "Bu hesabın saklama bakımı yetkisi yok.");
      return;
    }

    setRetentionMaintenanceRunning(true);
    try {
      const result = await requestImportRunRetentionMaintenance();
      await refreshHistoryConsole();
      showToast(
        result.noOp ? "info" : "success",
        result.noOp
          ? "Saklama süresi dolmuş önizleme veya anlık görüntü içeriği bulunmadı."
          : `Saklama bakımı tamamlandı. ${result.touchedRunCount} kayıtta süresi dolmuş içerik temizlendi.`,
      );
      if (selectedRunId) {
        void openRunDetail(selectedRunId);
      }
    } catch (err: unknown) {
      showToast("error", getErrorMessage(err, "Saklama bakımı çalıştırılamadı."));
    } finally {
      setRetentionMaintenanceRunning(false);
    }
  }

  function closeRunDetail() {
    setSelectedRunId(null);
    setSelectedRunDetail(null);
    setSelectedRunError(null);
    setSelectedRunLoading(false);
  }

  useEffect(() => {
    if (!canReadHistory) {
      setRunHealth(null);
      setRunHealthError(null);
      setRetentionMaintenanceSummary(null);
      setRetentionMaintenanceError(null);
      setRunHistoryState(buildEmptyRunHistoryListState());
      setRunHistoryError(null);
      return;
    }
    void refreshHistoryConsole();
  }, [canReadHistory, refreshHistoryConsole]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!actionResultDialog) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionResultDialog(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionResultDialog]);

  useEffect(() => {
    setShowResultIssues(false);
    setShowResultPreviewRows(false);
    setShowResultTechnical(false);
    setPinResultIssueToggle(false);
    setPinResultPreviewToggle(false);
    setPinResultTechnicalToggle(false);
  }, [result]);

  useEffect(() => {
    if (!canUseImportWorkspace && canReadHistory && activeView !== "history") {
      setActiveView("history");
      return;
    }
    if (!canReadHistory && activeView === "history") {
      setActiveView("import");
    }
  }, [activeView, canReadHistory, canUseImportWorkspace]);

  useEffect(() => {
    if (!selectedRunId) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      runDetailScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedRunId, selectedRunLoading]);

  async function handleTemplateDownload() {
    if (!canDownloadTemplate) {
      showToast("warn", "Şablon indirme yetkin yok.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/employees/import/template", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || `Template indirilemedi (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employee-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Örnek şablon indirildi.");
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Şablon indirilemedi.");
      setError(message);
      showToast("error", message);
    }
  }

  async function handleWorkbookUpload(ev: ChangeEvent<HTMLInputElement>) {
    if (!canValidate && !canApply) {
      showToast("warn", "İçe aktarma verisini hazırlama yetkin yok.");
      ev.target.value = "";
      return;
    }
    const file = ev.target.files?.[0] ?? null;
    if (!file) return;
    closeActionResultDialog();
    setError(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheets: WorkbookSheet[] = workbook.SheetNames.map((name) => {
        const ws = workbook.Sheets[name];
        const text = XLSX.utils.sheet_to_csv(ws, { FS: "\t", RS: "\n", blankrows: false });
        const matched = getEmployeeImportSheetByName(name);
        return {
          name,
          kind: matched?.kind ?? null,
          text,
        };
      });
      setXlsxSheets(sheets);
      setSourceType("xlsx");
      setSelectedWorkbookSheet("");
      setSelectedSheetKind("");
      showToast("success", `${file.name} yüklendi.`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Excel dosyası okunamadı.");
      setError(message);
      showToast("error", message);
    } finally {
      ev.target.value = "";
    }
  }

  async function runValidation() {
    if (!canValidate) {
      showToast("warn", "Doğrulama yetkin yok.");
      return;
    }
    const text = normalizeCsvText(effectiveText).trim();
    if (!text) {
      setError("Doğrulama için önce metin yapıştırın ya da Excel dosyası seçin.");
      return;
    }

    if (!selectedSheetKind) {
      setError("Kontrol için önce şablon türü seçin.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    closeActionResultDialog();
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          csvText: text,
          sheetKind: selectedSheetKind,
        }),
      });
      const json = (await res.json().catch(() => null)) as ImportResult | null;
      if (!res.ok || !json) {
        throw new Error(json?.message || `Doğrulama başarısız (${res.status})`);
      }
      setResult(json);
      setActionResultDialog(
        buildImportResultDialog(json, {
          canReadHistory,
          hasIssueDetails: json.errors.length > 0 || json.warnings.length > 0,
          hasPreviewRows: json.previewRows.length > 0,
          hasTechnicalDetails: true,
        }),
      );
      void refreshHistoryConsole();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Doğrulama başarısız.");
      setError(message);
      setActionResultDialog(buildImportActionFailureDialog("VALIDATE", message));
    } finally {
      setLoading(false);
    }
  }

  async function runApply() {
    if (!canApply) {
      showToast("warn", "Uygulama yetkin yok.");
      return;
    }
    const text = normalizeCsvText(effectiveText).trim();
    if (!text) {
      setError("Uygulama için önce doğrulama yap ve veri içeriğini hazır tut.");
      return;
    }

    if (!selectedSheetKind) {
      setError("Uygulama için önce şablon türü seçin.");
      return;
    }

    setLoading(true);
    setError(null);
    closeActionResultDialog();
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          csvText: text,
          sheetKind: selectedSheetKind,
        }),
      });
      const json = (await res.json().catch(() => null)) as ImportResult | null;
      if (!json) {
        throw new Error(`Uygulama başarısız (${res.status})`);
      }
      if (!res.ok) {
        setResult(json);
        throw new Error(json.message || `Uygulama başarısız (${res.status})`);
      }
      setResult(json);
      setActionResultDialog(
        buildImportResultDialog(json, {
          canReadHistory,
          hasIssueDetails: json.errors.length > 0 || json.warnings.length > 0,
          hasPreviewRows: json.previewRows.length > 0,
          hasTechnicalDetails: true,
        }),
      );
      void refreshHistoryConsole();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Uygulama başarısız.");
      setError(message);
      setActionResultDialog(buildImportActionFailureDialog("APPLY", message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {actionResultDialog ? (
        <ActionResultDialog
          item={actionResultDialog}
          onClose={closeActionResultDialog}
          onPrimaryAction={handleActionResultDialogPrimaryAction}
        />
      ) : null}

      {toast ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm shadow-sm",
            toast.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            toast.kind === "info" && "border-sky-200 bg-sky-50 text-sky-800",
            toast.kind === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
            toast.kind === "error" && "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {toast.message}
        </div>
      ) : null}

      {!canAccessWorkspace ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {visibilityBlockedReason ?? "Bu ekranı kullanmak için import workspace yetkisi gerekir."}
        </div>
      ) : null}

      {canValidate && !canApply ? (
        <div className="rounded-2xl border border-amber-300/55 bg-[linear-gradient(135deg,rgba(254,243,199,0.9),rgba(255,251,235,0.92))] p-4 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-900">Read-only</div>
              <div className="mt-1 text-sm text-amber-800">
                Bu ekranda personeli içeri alma işlemi için yetkin yok. Dosyayı kontrol edebilir ve geçmişi görüntüleyebilirsin.
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
              Yetki: OPS_WRITE gerekli
            </span>
          </div>
        </div>
      ) : null}

      {canAccessWorkspace ? (
        <section className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-2">
              {([
                ...(canUseImportWorkspace ? (["import"] as const) : []),
                ...(canReadHistory ? (["history"] as const) : []),
              ] as ImportWorkspaceView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setActiveView(view);
                    if (view === "import") closeRunDetail();
                  }}
                  className={cx(
                    "group relative overflow-hidden rounded-3xl border px-4 py-3 text-left transition",
                    activeView === view
                      ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
                      : "border-slate-200 bg-white text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.1)]"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cx(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition",
                        activeView === view
                          ? "bg-white/15 text-white"
                          : view === "import"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-sky-50 text-sky-700"
                      )}
                    >
                      {view === "import" ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m7 10 5 5 5-5" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 21h14" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v5l3 2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 7.5A9 9 0 1 1 3 13" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4v4h4" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{formatWorkspaceViewLabel(view)}</span>
                      <span className={cx("mt-1 block text-xs leading-5", activeView === view ? "text-slate-200" : "text-slate-500")}>
                        {view === "import" ? "Dosyayı seç, kontrol et ve uygula." : "Geçmiş kayıtları ve detayları incele."}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="hidden lg:block" aria-hidden="true" />
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <span className={cx("rounded-full border px-3 py-1 font-medium", canDownloadTemplate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                Şablon: {canDownloadTemplate ? "Açık" : "Kapalı"}
              </span>
              <span className={cx("rounded-full border px-3 py-1 font-medium", canValidate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                Kontrol: {canValidate ? "Açık" : "Kapalı"}
              </span>
              <span className={cx("rounded-full border px-3 py-1 font-medium", canApply ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                Uygulama: {canApply ? "Açık" : "Kapalı"}
              </span>
              <span className={cx("rounded-full border px-3 py-1 font-medium", canReadHistory ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                Geçmiş: {canReadHistory ? "Açık" : "Kapalı"}
              </span>
            </div>
            <div className="flex justify-center lg:justify-end">
            <Link
              href="/employees"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
              title="Çalışan listesine dön"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 11.5 12 4l9 7.5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6.75 10.5V20h10.5v-9.5" />
              </svg>
              <span>Listeye dön</span>
            </Link>
            </div>
          </div>
          {visibilityBlockedReason ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
              {visibilityBlockedReason}
            </div>
          ) : null}
        </section>
      ) : null}

      {canUseImportWorkspace && activeView === "import" ? (
        <>
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-lg font-semibold text-slate-900">Şablon bazlı içe aktarım</div>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Dosyanızı seçin, ilgili sekmeyi belirleyin ve önce kontrol edin. Sistem kolon adlarını, tarihleri ve gerekli kodları otomatik denetler; temiz sonuçta uygulama adımı açılır.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTemplateDownload}
              disabled={!canDownloadTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_18px_36px_rgba(15,23,42,0.24)] focus:outline-none focus:ring-4 focus:ring-slate-300/60 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m7 10 5 5 5-5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 21h14" />
              </svg>
              Örnek şablonu indir
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setSourceType("text")}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left transition",
                sourceType === "text"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              )}
            >
              <div className="text-sm font-semibold">Metin / TSV / CSV</div>
              <div className={cx("mt-1 text-xs", sourceType === "text" ? "text-slate-200" : "text-slate-500")}>
                Tam toplu veya ilgili sekmenin içeriğini yapıştırarak kontrol edin.
              </div>
            </button>
            <label
              className={cx(
                "cursor-pointer rounded-2xl border px-4 py-3 transition",
                sourceType === "xlsx"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition",
                    sourceType === "xlsx" ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m7 10 5 5 5-5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 21h14" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Excel workbook (.xlsx / .xls)</span>
                  <span className={cx("mt-1 block text-xs", sourceType === "xlsx" ? "text-slate-200" : "text-slate-500")}>
                    Tam toplu ve parçalı sekmeleri içeren Excel dosyasını seçin.
                  </span>
                </span>
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleWorkbookUpload} disabled={!canValidate && !canApply} />
            </label>
          </div>

          {sourceType === "xlsx" ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Workbook tabı</label>
                  <select
                    value={selectedWorkbookSheet}
                    onChange={(ev) => {
                      const next = ev.target.value;
                      setSelectedWorkbookSheet(next);
                      const matched = xlsxSheets.find((item) => item.name === next)?.kind ?? null;
                      setSelectedSheetKind(matched && getEmployeeImportSheet(matched).importable ? matched : "");
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    disabled={!xlsxSheets.length}
                  >
                    <option value="">{xlsxSheets.length ? "Workbook tabı seçin" : "Önce Excel seç"}</option>
                    {xlsxSheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name}
                        {sheet.kind ? ` · ${getEmployeeImportSheet(sheet.kind).title}` : " · Tanınmayan tab"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Şablon türü</label>
                  <select
                    value={selectedSheetKind}
                    onChange={(ev) => setSelectedSheetKind(ev.target.value as EmployeeImportSheetKind | "")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    <option value="">Şablon türü seçin</option>
                    {EMPLOYEE_IMPORT_SHEETS.filter((sheet) => sheet.importable).map((sheet) => (
                      <option key={sheet.kind} value={sheet.kind}>
                        {sheet.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                {selectedWorkbookMeta?.kind ? (
                  <span>
                    Seçili tab sistem tarafından <strong>{getEmployeeImportSheet(selectedWorkbookMeta.kind).title}</strong> olarak tanındı.
                  </span>
                ) : (
                  <span>
                    Seçili tab adı tanınmadı. Doğru sözleme için şablonun tab adlarını değiştirmeden kullan.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Şablon türü</label>
                <select
                  value={selectedSheetKind}
                  onChange={(ev) => setSelectedSheetKind(ev.target.value as EmployeeImportSheetKind | "")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">Şablon türü seçin</option>
                  {EMPLOYEE_IMPORT_SHEETS.filter((sheet) => sheet.importable).map((sheet) => (
                    <option key={sheet.kind} value={sheet.kind}>
                      {sheet.title}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={csvText}
                onChange={(ev) => setCsvText(ev.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full rounded-3xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-sm text-slate-100 outline-none focus:border-slate-500"
                placeholder="Şablonun ilgili tab içeriğini buraya yapıştırabilirsin."
                disabled={!canValidate && !canApply}
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runValidation}
              disabled={!canValidate || loading || !selectedSheetKind || !normalizeCsvText(effectiveText).trim()}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "İşleniyor..." : "Kontrol Et"}
            </button>
            <button
              type="button"
              onClick={runApply}
              disabled={!canApply || loading || !result?.applyEnabled}
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {loading ? "İşleniyor..." : "Uygula"}
            </button>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900">
              Uygulama adımı Tam Toplu Aktarım, Kişisel Veriler, Organizasyon Verileri ve Çalışma Verileri sekmelerinde kullanılabilir.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900">Seçili Şablon</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{sheetMeta?.description ?? "Önce şablon türü seçin."}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplateFields((current) => !current)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200/70"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 18h10" />
              </svg>
              {showTemplateFields ? "Kolon ayrıntılarını gizle" : "Kolon ayrıntılarını göster"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Zorunlu alan", sheetMeta?.required.length ?? 0],
              ["Toplam kolon", sheetMeta?.headers.length ?? 0],
              ["Eşleşen kolon", preview ? matchedTemplateHeaderCount : "Bekleniyor"],
            ].map(([label, value]) => {
              const isPending = value === "Bekleniyor";
              return (
                <div key={String(label)} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div
                    className={cx(
                      "mt-2 max-w-full font-semibold",
                      isPending
                        ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700"
                        : "text-2xl text-slate-900"
                    )}
                  >
                    {String(value)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="font-semibold text-slate-900">Zorunlu kolonlar</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {sheetMeta ? (
                sheetMeta.required.map((field) => (
                  <span key={field} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">
                    {field}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Şablon türü seçildiğinde zorunlu kolonlar burada görünür.</span>
              )}
            </div>
          </div>

          {showTemplateFields ? (
          <div className="mt-4 space-y-2 max-h-[28rem] overflow-auto pr-1">
            {sheetMeta ? sheetMeta.headers.map((field) => {
              const normalized = normalizeEmployeeImportHeader(field);
              const present = normalizedPreviewHeaders.includes(normalized);
              const isRequired = sheetMeta.required.includes(field);
              return (
                <div
                  key={field}
                  className={cx(
                    "rounded-2xl border px-4 py-3",
                    present ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{field}</div>
                      <div className="mt-1 text-xs text-slate-500">{EMPLOYEE_IMPORT_FIELDS[field].label}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                          isRequired ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {isRequired ? "Zorunlu" : "Opsiyonel"}
                      </span>
                      {preview ? (
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                            present ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {present ? "Bulundu" : "Yok"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-600">{EMPLOYEE_IMPORT_FIELDS[field].description}</div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Şablon türü seçildiğinde kolon ayrıntıları burada görünür.
              </div>
            )}
          </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-500">
              Tüm kolon açıklamalarını sadece ihtiyaç duyduğunuzda açıyoruz. Ana ekranda sade görünüm korunur.
            </div>
          )}
        </div>
      </section>

      {preview ? (
        <section className="rounded-[2rem] border border-slate-300 bg-slate-50/75 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-900">Kaynak önizleme</div>
              <p className="mt-1 text-sm text-slate-600">
                İlk satırı ve ayraç bilgisini gerektiğinde açıp kontrol edebilirsiniz. Ana ekranı sade tutmak için tablo varsayılan kapalıdır.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-white bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                {preview.lineCount} satır · Ayraç: {preview.delimiter === "\t" ? "TAB" : preview.delimiter}
              </div>
              <button
                type="button"
                onClick={() => setShowSourcePreview((current) => !current)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {showSourcePreview ? "Önizlemeyi gizle" : "İlk satırı göster"}
              </button>
            </div>
          </div>

          {showSourcePreview ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.header.map((header, idx) => (
                      <th key={`${header}-${idx}`} className="px-3 py-2 text-left font-semibold text-slate-700">
                        {header || `col_${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    {preview.second.map((value, idx) => (
                      <td key={idx} className="px-3 py-2 text-slate-600">
                        {value || "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
              İlk satır ve kolon düzeni hazır. Gerekirse açıp kontrol edebilirsiniz.
            </div>
          )}
        </section>
      ) : null}

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">{error}</div> : null}

      {result ? (
        <section className="space-y-4">
          <div className="rounded-[2rem] border border-slate-300 bg-slate-50/90 p-5 shadow-sm">
            <div className="h-1.5 w-14 rounded-full bg-slate-900" />
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatImportResultSectionLabel(result)} · {result.sheetTitle}
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{formatImportResultHeadline(result)}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{formatImportResultSupportText(result)}</p>
              </div>
              <div className={cx(
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                result.readinessSummary
                  ? result.readinessSummary.status === "READY"
                    ? "bg-emerald-100 text-emerald-700"
                    : result.readinessSummary.status === "REVIEW"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                  : result.canProceedToNextPhase
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
              )}>
                {result.readinessSummary
                  ? result.readinessSummary.status === "READY"
                    ? "Hazır"
                    : result.readinessSummary.status === "REVIEW"
                      ? "Gözden geçir"
                      : "Düzeltme gerekli"
                  : result.canProceedToNextPhase
                    ? "Sonraki faza hazır"
                    : "Düzeltme gerekli"}
              </div>
            </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["Toplam satır", result.totals.rows],
                ["Uygun", result.totals.valid],
                ["Düzeltilecek", result.totals.invalid],
                ["Uyarı", result.warnings.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{String(value)}</div>
                </div>
              ))}
              </div>

            {result.readinessSummary ? (
              <div className="mt-4">
                <ImportReadinessPanel
                  title="Uygulamaya hazırlık kontrolü"
                  summary={result.readinessSummary}
                />
              </div>
            ) : null}

            {guidedRemediationPlan ? (
              <div className="mt-4">
                <GuidedRemediationPanel
                  plan={guidedRemediationPlan}
                  actionLabels={guidedRemediationActionLabels}
                  disabledActions={{
                    APPLY_NOW: loading || !result.applyEnabled || !canApply,
                    DOWNLOAD_CORRECTION_PACK:
                      !result.runRef || exportingCorrectionRunId === result.runRef.id,
                    OPEN_RUN_DETAIL: !result.runRef || !canReadHistory,
                  }}
                  onAction={handleGuidedRemediationAction}
                />
              </div>
            ) : null}

            {result.applySummary ? (
              <div className="mt-4 rounded-[1.75rem] border border-slate-300 bg-slate-100/80 p-4">
                <div className="text-sm font-semibold text-slate-900">Kısa işlem özeti</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {getCompactApplySummaryStats(result.applySummary).map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="hidden">
                {showIssueToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultIssueToggle(true);
                      setShowResultIssues((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    {showResultIssues
                      ? "Düzeltmeleri gizle"
                      : `Düzeltmeleri gör (${result.errors.length} hata${result.warnings.length ? `, ${result.warnings.length} uyarı` : ""})`}
                  </button>
                ) : null}
                {showPreviewToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultPreviewToggle(true);
                      setShowResultPreviewRows((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {showResultPreviewRows ? "Önizlemeyi gizle" : `Önizleme satırlarını gör (${result.previewRows.length})`}
                  </button>
                ) : null}
                {showTechnicalToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultTechnicalToggle(true);
                      setShowResultTechnical((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {showResultTechnical ? "Teknik ayrıntıları gizle" : "Teknik ayrıntıları göster"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {result.runRef ? (
              <div className="mt-4 rounded-[1.75rem] border border-sky-200/80 bg-sky-50/70 p-4">
                <div className="text-sm font-semibold text-slate-900">{formatImportRunCardTitle(result.runRef)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700">
                    İşlem No: {result.runRef.id}
                  </span>
                  <span className={cx("rounded-full border px-3 py-1 font-medium", runModeTone(result.runRef.mode))}>
                    Mod: {formatRunModeLabel(result.runRef.mode)}
                  </span>
                  <span className={cx("rounded-full border px-3 py-1 font-medium", runStatusTone(result.runRef.status))}>
                    Durum: {formatRunStatusLabel(result.runRef.status)}
                  </span>
                  <span className={cx("rounded-full border px-3 py-1 font-medium", runOutcomeTone(result.runRef.outcome))}>
                    Sonuç: {formatRunOutcomeLabel(result.runRef.outcome)}
                  </span>
                  {result.runRef.duplicateOfRunId ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-700">
                      Önceki benzer kayıt: {result.runRef.duplicateOfRunId}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canReadHistory && !guidedRemediationActionKeys.has("OPEN_RUN_DETAIL") ? (
                    <button
                      type="button"
                      onClick={() => void openRunDetail(result.runRef!.id)}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      {formatImportRunDetailActionLabel(result.runRef!)}
                    </button>
                  ) : null}
                  {(result.issueSummary.totalErrorCount > 0 || result.issueSummary.totalWarningCount > 0) &&
                  !guidedRemediationActionKeys.has("DOWNLOAD_CORRECTION_PACK") ? (
                    <button
                      type="button"
                      onClick={() => void handleCorrectionPackExport(result.runRef!.id)}
                      disabled={exportingCorrectionRunId === result.runRef.id}
                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exportingCorrectionRunId === result.runRef.id ? "İndiriliyor..." : "Düzeltme paketini indir"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showIssueToggleInActionRow || showPreviewToggleInActionRow || showTechnicalToggleInActionRow ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {showIssueToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultIssueToggle(true);
                      setShowResultIssues((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    {showResultIssues
                      ? "Düzeltmeleri gizle"
                      : `Düzeltmeleri gör (${result.errors.length} hata${result.warnings.length ? `, ${result.warnings.length} uyarı` : ""})`}
                  </button>
                ) : null}
                {showPreviewToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultPreviewToggle(true);
                      setShowResultPreviewRows((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {showResultPreviewRows ? "Önizlemeyi gizle" : `Önizleme satırlarını gör (${result.previewRows.length})`}
                  </button>
                ) : null}
                {showTechnicalToggleInActionRow ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinResultTechnicalToggle(true);
                      setShowResultTechnical((current) => !current);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {showResultTechnical ? "Teknik ayrıntıları gizle" : "Teknik ayrıntıları göster"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>


          {showResultTechnical && result.applySummary ? (
            <div ref={resultTechnicalSectionRef} className="rounded-[2rem] border border-slate-300 bg-slate-50/80 p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Detaylı işlem özeti</div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatApplySummaryDescription(result.applySummary)}
                  </p>
                </div>
                <div className={cx(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  result.applySummary.rejected === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}>
                  {result.applySummary.rejected === 0 ? "Uygulama temiz" : "Kısmi uygulama"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                {(
                  result.applySummary.kind === "FULL_DATA"
                    ? [
                        ["İstenen", result.applySummary.requested],
                        ["Bulunan", result.applySummary.found],
                        ["Yeni", result.applySummary.created],
                        ["Güncellenen", result.applySummary.updated],
                        ["Değişen", result.applySummary.changed],
                        ["Değişmeyen", result.applySummary.unchanged],
                        ["Reddedilen", result.applySummary.rejected],
                        ["Yeniden hesaplama", result.applySummary.recomputeQueued ? "Var" : "Yok"],
                        ["İstihdam", result.applySummary.employmentChanged],
                        ["Kişisel", result.applySummary.personalChanged],
                        ["Organizasyon", result.applySummary.orgChanged],
                        ["Çalışma planı", result.applySummary.workScheduleChanged],
                        ["Kart ilk dolum", result.applySummary.cardFilled],
                        ["Kart uyuşmazlığı", result.applySummary.cardConflict],
                        ["Geçersiz değer", result.applySummary.invalidValues],
                      ]
                    : result.applySummary.kind === "PERSONAL_DATA"
                    ? [
                        ["İstenen", result.applySummary.requested],
                        ["Bulunan", result.applySummary.found],
                        ["Değişen", result.applySummary.changed],
                        ["Değişmeyen", result.applySummary.unchanged],
                        ["Reddedilen", result.applySummary.rejected],
                        ["Profil", result.applySummary.profileChanged],
                        ["Kart ilk dolum", result.applySummary.cardFilled],
                        ["Geçersiz değer", result.applySummary.invalidPersonalValues],
                      ]
                    : result.applySummary.kind === "WORK_DATA"
                      ? [
                          ["İstenen", result.applySummary.requested],
                          ["Bulunan", result.applySummary.found],
                          ["Değişen", result.applySummary.changed],
                          ["Değişmeyen", result.applySummary.unchanged],
                          ["Reddedilen", result.applySummary.rejected],
                          ["Çalışma planı", result.applySummary.workScheduleChanged],
                          ["Kart uyuşmazlığı", result.applySummary.cardMismatch],
                          ["Yeniden hesaplama", result.applySummary.recomputeQueued ? "Var" : "Yok"],
                        ]
                      : [
                          ["İstenen", result.applySummary.requested],
                          ["Bulunan", result.applySummary.found],
                          ["Değişen", result.applySummary.changed],
                          ["Değişmeyen", result.applySummary.unchanged],
                          ["Reddedilen", result.applySummary.rejected],
                          ["Organizasyon", result.applySummary.orgChanged],
                          ["Kart uyuşmazlığı", result.applySummary.cardMismatch],
                          ["Yeniden hesaplama", result.applySummary.recomputeQueued ? "Var" : "Yok"],
                        ]
                ).map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{String(value)}</div>
                  </div>
                ))}
              </div>
              {result.changedEmployeeCodesPreview?.length ? (
                <div className="mt-4 rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Değişen ilk çalışanlar</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.changedEmployeeCodesPreview.map((code) => (
                      <span key={code} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showResultTechnical && result.codeResolutionSummary ? (
            <div
              ref={result.applySummary ? undefined : resultTechnicalSectionRef}
              className="rounded-[2rem] border border-slate-300 bg-slate-50/80 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Kod kontrolü</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Lokasyon / grup / alt grup / çalışma planı kodları aktif company başında çözülür. Eksik veya pasif kodlar sonraki faza geçişini durdurur.
                  </p>
                </div>
                <div className={cx(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  result.codeResolutionSummary.branch.missing +
                    result.codeResolutionSummary.branch.inactive +
                    result.codeResolutionSummary.employeeGroup.missing +
                    result.codeResolutionSummary.employeeSubgroup.missing +
                    result.codeResolutionSummary.employeeSubgroup.mismatchedGroup +
                    result.codeResolutionSummary.workSchedulePattern.missing +
                    result.codeResolutionSummary.workSchedulePattern.inactive === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                )}>
                  {result.codeResolutionSummary.branch.missing +
                    result.codeResolutionSummary.branch.inactive +
                    result.codeResolutionSummary.employeeGroup.missing +
                    result.codeResolutionSummary.employeeSubgroup.missing +
                    result.codeResolutionSummary.employeeSubgroup.mismatchedGroup +
                    result.codeResolutionSummary.workSchedulePattern.missing +
                    result.codeResolutionSummary.workSchedulePattern.inactive === 0
                    ? "Kodlar çözüldü"
                    : "Kod sorunu var"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Lokasyon", result.codeResolutionSummary.branch],
                  ["Grup", result.codeResolutionSummary.employeeGroup],
                  ["Alt grup", result.codeResolutionSummary.employeeSubgroup],
                  ["Çalışma planı", result.codeResolutionSummary.workSchedulePattern],
                ].map(([label, bucket]) => {
                  const item = bucket as NonNullable<ImportResult["codeResolutionSummary"]>["branch"];
                  return (
                    <div key={String(label)} className="rounded-2xl border border-white bg-white/95 p-4 text-sm text-slate-700 shadow-sm">
                      <div className="font-semibold text-slate-900">{String(label)}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white px-3 py-2"><div className="text-slate-500">Gönderilen</div><div className="mt-1 font-semibold text-slate-900">{item.provided}</div></div>
                        <div className="rounded-xl bg-white px-3 py-2"><div className="text-slate-500">Çözülen</div><div className="mt-1 font-semibold text-emerald-700">{item.resolved}</div></div>
                        <div className="rounded-xl bg-white px-3 py-2"><div className="text-slate-500">Bulunamadı</div><div className="mt-1 font-semibold text-rose-700">{item.missing}</div></div>
                        <div className="rounded-xl bg-white px-3 py-2"><div className="text-slate-500">Pasif / uyumsuz</div><div className="mt-1 font-semibold text-amber-700">{item.inactive + item.mismatchedGroup}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showResultTechnical ? (
          <div
            ref={!result.applySummary && !result.codeResolutionSummary ? resultTechnicalSectionRef : undefined}
            className="rounded-[2rem] border border-slate-300 bg-slate-50/80 p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Kolon ve başlık kontrolü</div>
                <p className="mt-1 text-sm text-slate-600">
                  Başlık sözleşmesi sistem tarafından doğrulanır. Eksik zorunlu kolon, yinelenen kolon, tanımsız kolon ve boş başlıklar burada görünür.
                </p>
              </div>
              <div className={cx(
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                result.isTemplateValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              )}>
                {result.isTemplateValid ? "Header temiz" : "Header sorunu var"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["Gelen kolon", result.headerSummary.receivedHeaders.length],
                ["Eksik zorunlu", result.headerSummary.missingRequiredHeaders.length],
                ["Tanınmayan", result.headerSummary.unknownHeaders.length],
                ["Yinelenen", result.headerSummary.duplicateHeaders.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{String(value)}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Eksik zorunlu kolonlar</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.headerSummary.missingRequiredHeaders.length ? result.headerSummary.missingRequiredHeaders.map((field) => (
                    <span key={field} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                      {field}
                    </span>
                  )) : <span className="text-sm text-slate-500">Eksik zorunlu kolon yok.</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-white bg-white/95 p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Header sorunları</div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>
                    <span className="font-medium text-slate-900">Tanınmayan kolonlar:</span>{" "}
                    {result.headerSummary.unknownHeaders.length ? result.headerSummary.unknownHeaders.join(", ") : "Yok"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Yinelenen kolonlar:</span>{" "}
                    {result.headerSummary.duplicateHeaders.length ? result.headerSummary.duplicateHeaders.join(", ") : "Yok"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Boş başlık konumları:</span>{" "}
                    {result.headerSummary.emptyHeaderIndexes.length ? result.headerSummary.emptyHeaderIndexes.map((n) => `#${n}`).join(", ") : "Yok"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
          {showResultIssues && result.errors.length > 0 ? (
            <div ref={resultIssuesSectionRef} className="rounded-[2rem] border border-rose-200 bg-rose-50/55 p-5 shadow-sm">
              <div className="text-lg font-semibold text-rose-700">Düzeltilmesi gereken satırlar</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/90 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-rose-100 text-sm">
                  <thead className="bg-rose-50 text-left text-rose-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Kimlik</th>
                      <th className="px-3 py-2 font-semibold">Kod</th>
                      <th className="px-3 py-2 font-semibold">Alan</th>
                      <th className="px-3 py-2 font-semibold">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 bg-white">
                    {result.errors.map((item, idx) => (
                      <tr key={`${item.code}-${item.line}-${idx}`}>
                        <td className="px-3 py-2 text-slate-900">{issuePrimaryId(item)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-rose-700">{item.code}</td>
                        <td className="px-3 py-2 text-slate-600">{humanFieldLabel(item.field) ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-700">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {showResultIssues && result.warnings.length > 0 ? (
            <div
              ref={result.errors.length === 0 ? resultIssuesSectionRef : undefined}
              className="rounded-[2rem] border border-amber-200 bg-amber-50/55 p-5 shadow-sm"
            >
              <div className="text-lg font-semibold text-amber-700">Uyarılar</div>
              <div className="mt-4">
                <ImportWarningGroupList issues={result.warnings} />
              </div>
            </div>
          ) : null}

          {showResultPreviewRows && result.previewRows.length > 0 ? (
            <div ref={resultPreviewRowsSectionRef} className="rounded-[2rem] border border-slate-300 bg-slate-50/80 p-5 shadow-sm">
              <div className="text-lg font-semibold text-slate-900">Önizleme satırları</div>
              <p className="mt-1 text-sm text-slate-600">İlk 25 geçerli satır önizleme amaçlı gösterilir.</p>
              <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(226,232,240,1)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Satır</th>
                      {getEmployeeImportSheet(result.sheetKind).headers.map((field) => (
                        <th key={field} className="px-3 py-2 text-left font-semibold text-slate-700">
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {result.previewRows.map((row) => (
                      <tr key={`${row.employeeCode}-${row.line}-${row.scopeStartDate}`}>
                        <td className="px-3 py-2 text-slate-500">{row.line}</td>
                        {getEmployeeImportSheet(result.sheetKind).headers.map((field) => (
                          <td key={field} className="px-3 py-2 text-slate-700">
                            {row.values[field] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
        </>
      ) : null}

      {canReadHistory && activeView === "history" ? (
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">İçe Aktarım Sağlığı</div>
                <p className="mt-1 text-sm text-slate-600">
                  Kilit, açıkta kalan işlemler, yakın başarısızlıklar ve benzer içerik sinyalleri burada görünür. Bu panel salt okunur sağlık özeti verir.
                </p>
                {canRecoverOperations ? (
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Bayat veya sahipsiz sekme durumlarında güvenli operasyon düzeltmeleri bu panelden başlatılabilir.
                  </p>
                ) : null}
              </div>
              <div className={cx(
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                runHealthError
                  ? "bg-rose-100 text-rose-700"
                  : runHealthLoading && !runHealth
                    ? "bg-slate-100 text-slate-600"
                    : runHealth?.issues.length
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
              )}>
                {runHealthError
                  ? "Yüklenemedi"
                  : runHealthLoading && !runHealth
                    ? "Yükleniyor"
                    : runHealth?.issues.length
                      ? `${runHealth.issues.length} aktif başlık`
                      : "Sağlıklı"}
              </div>
            </div>

            {runHealthError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {runHealthError}
              </div>
            ) : null}

            {runHealthLoading && !runHealth ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                İçe aktarım sağlığı yükleniyor...
              </div>
            ) : null}

            {runHealth ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Bayat kilit", runHealth.counts.staleApplyLocks],
                    ["Sahipsiz kilit", runHealth.counts.orphanApplyLocks],
                    ["Bayat uygulama", runHealth.counts.staleRunningApplyRuns],
                    ["Bayat doğrulama", runHealth.counts.staleRunningDryRuns],
                    [`Son ${runHealth.recentFailureWindowDays} gün başarısız`, runHealth.counts.recentFailedRuns],
                    [`Son ${runHealth.duplicatePatternWindowDays} gün benzer`, runHealth.counts.recentDuplicateRuns],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{String(value)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Son sağlık hesaplama zamanı {formatRunDateTime(runHealth.generatedAt)}. Bayatlık eşiği {runHealth.staleThresholdMinutes} dakika üzerinden değerlendirilir.
                </div>

                {runHealth.issues.length ? (
                  <div className="mt-4 space-y-3">
                    {runHealth.issues.map((issue) => (
                      <div key={issue.code} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{issue.title}</div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{issue.message}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                            <span className={cx("rounded-full border px-2.5 py-1", runHealthSeverityTone(issue.severity))}>
                              {formatRunHealthSeverityLabel(issue.severity)}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                              {issue.count} kayıt
                            </span>
                          </div>
                        </div>

                        {issue.references.length ? (
                          <div className="mt-4 space-y-2">
                            {issue.references.map((reference) => (
                              <div
                                key={`${issue.code}-${reference.refType}-${reference.id}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">{reference.sheetTitle}</div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {reference.refType === "LOCK" ? "Kilit" : "İşlem"} · {formatRunHealthReferenceDate(reference)} · {reference.actorUserId}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                                    {reference.mode ? (
                                      <span className={cx("rounded-full border px-2.5 py-1", runModeTone(reference.mode))}>
                                        {formatRunModeLabel(reference.mode)}
                                      </span>
                                    ) : null}
                                    {reference.status ? (
                                      <span className={cx("rounded-full border px-2.5 py-1", runStatusTone(reference.status))}>
                                        {formatRunStatusLabel(reference.status)}
                                      </span>
                                    ) : null}
                                    {reference.outcome ? (
                                      <span className={cx("rounded-full border px-2.5 py-1", runOutcomeTone(reference.outcome))}>
                                        {formatRunOutcomeLabel(reference.outcome)}
                                      </span>
                                    ) : null}
                                    {reference.failedCode ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                                        {reference.failedCode}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {reference.refType === "RUN" ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void openRunDetail(reference.id)}
                                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                                    >
                                      İşlem kaydını aç
                                    </button>
                                    {canRecoverOperations && reference.recoveryAction && reference.recoverySheetKind ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleOperationalRecovery(reference.recoverySheetKind!)}
                                        disabled={recoverySheetKind === reference.recoverySheetKind}
                                        className="inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {recoverySheetKind === reference.recoverySheetKind
                                          ? "Düzeltiliyor..."
                                          : "Bu sekmeyi düzelt"}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : canRecoverOperations && reference.recoveryAction && reference.recoverySheetKind ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleOperationalRecovery(reference.recoverySheetKind!)}
                                    disabled={recoverySheetKind === reference.recoverySheetKind}
                                    className="mt-3 inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {recoverySheetKind === reference.recoverySheetKind
                                      ? "Düzeltiliyor..."
                                      : "Bu sekmeyi düzelt"}
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Şu an bayat veya sahipsiz import operasyon durumu görünmüyor. Yakın tarihli başarısız ve yinelenen içerik sinyali de bulunmuyor.
                  </div>
                )}
              </>
            ) : null}
          </div>

          {canRecoverOperations ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Saklama Bakımı</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Ana işlem kaydını silmeden, saklama süresi dolmuş önizleme ve anlık görüntü içeriklerini küçültür.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRetentionMaintenance()}
                  disabled={retentionMaintenanceRunning || retentionMaintenanceLoading}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retentionMaintenanceRunning ? "Bakım çalışıyor..." : "Süresi dolmuş içerikleri temizle"}
                </button>
              </div>

              {retentionMaintenanceError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {retentionMaintenanceError}
                </div>
              ) : null}

              {retentionMaintenanceLoading && !retentionMaintenanceSummary ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Saklama bakımı özeti yükleniyor...
                </div>
              ) : null}

              {retentionMaintenanceSummary ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      ["Önizleme adayı", retentionMaintenanceSummary.counts.previewPayloadCandidates],
                      ["Anlık görüntü adayı", retentionMaintenanceSummary.counts.snapshotPayloadCandidates],
                      ["Toplam kayıt", retentionMaintenanceSummary.counts.distinctCandidateRuns],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{String(value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">Önizleme saklama eşiği</div>
                      <div className="mt-1">{formatRunDateTime(retentionMaintenanceSummary.previewThresholdDate)}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Saklama süresi: {retentionMaintenanceSummary.previewRetentionDays} gün
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        En eski aday: {formatRunDateTime(retentionMaintenanceSummary.oldestPreviewFinishedAt)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">Anlık görüntü saklama eşiği</div>
                      <div className="mt-1">{formatRunDateTime(retentionMaintenanceSummary.snapshotThresholdDate)}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Saklama süresi: {retentionMaintenanceSummary.snapshotRetentionDays} gün
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        En eski aday: {formatRunDateTime(retentionMaintenanceSummary.oldestSnapshotFinishedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-900">
                    Bu bakım yalnızca süresi dolmuş detay içeriklerini temizler. İşlem kaydı kimliği, kullanıcı, mod, durum, sonuç ve zaman
                    bilgileri korunur.
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Son Import Çalıştırmaları</div>
                <p className="mt-1 text-sm text-slate-600">
                  Doğrulama ve uygulama kayıtları burada operasyon izi olarak görünür. Satıra tıklayarak detay panelini açabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshHistoryConsole()}
                disabled={historyConsoleLoading}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {historyConsoleLoading ? "Güncelleniyor..." : "Sağlığı ve listeyi yenile"}
              </button>
            </div>

            {runHistoryError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {runHistoryError}
              </div>
            ) : null}

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Arama ve filtreler</div>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    İşlem kimliği, kullanıcı, çalışan kodu, sonuç tipi ve tarih aralığına göre listeyi daraltabilirsiniz.
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {hasActiveHistoryFilters ? "Filtreler aktif" : "Tüm kayıtlar"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">İşlem kimliği</span>
                  <input
                    value={draftRunHistoryFilters.runId}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({ ...current, runId: event.target.value }))
                    }
                    placeholder="Örn. cm..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Çalıştıran</span>
                  <input
                    value={draftRunHistoryFilters.actor}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({ ...current, actor: event.target.value }))
                    }
                    placeholder="E-posta veya kullanıcı kimliği"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Çalışan kodu</span>
                  <input
                    value={draftRunHistoryFilters.employeeCode}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({ ...current, employeeCode: event.target.value }))
                    }
                    placeholder="Değişen çalışan kodu"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                  <span className="block text-[11px] leading-5 text-slate-500">
                    Arama, maskelenmiş değişen çalışan önizlemesi üzerinden yapılır.
                  </span>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Benzerlik bağlantısı</span>
                  <select
                    value={draftRunHistoryFilters.duplicateLinkage}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({
                        ...current,
                        duplicateLinkage: event.target.value as ImportRunHistoryFilters["duplicateLinkage"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Tümü</option>
                    <option value="DUPLICATE">{formatDuplicateLinkageLabel("DUPLICATE")}</option>
                    <option value="REFERENCE">{formatDuplicateLinkageLabel("REFERENCE")}</option>
                    <option value="ANY_LINKED">{formatDuplicateLinkageLabel("ANY_LINKED")}</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mod</span>
                  <select
                    value={draftRunHistoryFilters.mode}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({
                        ...current,
                        mode: event.target.value as ImportRunHistoryFilters["mode"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Tümü</option>
                    <option value="DRY_RUN">Doğrulama</option>
                    <option value="APPLY">Uygulama</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tab</span>
                  <select
                    value={draftRunHistoryFilters.sheetKind}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({
                        ...current,
                        sheetKind: event.target.value as ImportRunHistoryFilters["sheetKind"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Tümü</option>
                    {EMPLOYEE_IMPORT_SHEETS.filter((sheet) => sheet.kind !== "ALL_FIELDS").map((sheet) => (
                      <option key={sheet.kind} value={sheet.kind}>
                        {sheet.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Durum</span>
                  <select
                    value={draftRunHistoryFilters.status}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({
                        ...current,
                        status: event.target.value as ImportRunHistoryFilters["status"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Tümü</option>
                    <option value="RUNNING">Çalışıyor</option>
                    <option value="COMPLETED">Tamamlandı</option>
                    <option value="FAILED">Başarısız</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sonuç</span>
                  <select
                    value={draftRunHistoryFilters.outcome}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({
                        ...current,
                        outcome: event.target.value as ImportRunHistoryFilters["outcome"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Tümü</option>
                    <option value="CLEAN">Temiz</option>
                    <option value="WARNING">Uyarılı</option>
                    <option value="BLOCKING">Bloklayan</option>
                    <option value="PARTIAL">Kısmi</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Başlangıç tarihi</span>
                  <input
                    type="date"
                    value={draftRunHistoryFilters.startedAtFrom}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({ ...current, startedAtFrom: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bitiş tarihi</span>
                  <input
                    type="date"
                    value={draftRunHistoryFilters.startedAtTo}
                    onChange={(event) =>
                      setDraftRunHistoryFilters((current) => ({ ...current, startedAtTo: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyRunHistoryFilters}
                  disabled={runHistoryLoading}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ara
                </button>
                <button
                  type="button"
                  onClick={resetRunHistoryFilters}
                  disabled={runHistoryLoading}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Filtreleri temizle
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                <div>
                  Toplam <span className="font-semibold text-slate-900">{runHistoryState.total}</span> kayıt
                  {runHistoryState.totalPages > 0 ? (
                    <>
                      {" "}
                      · Sayfa <span className="font-semibold text-slate-900">{runHistoryState.page}</span> /{" "}
                      <span className="font-semibold text-slate-900">{runHistoryState.totalPages}</span>
                    </>
                  ) : null}
                </div>
                {hasActiveHistoryFilters ? (
                  <div className="text-xs text-slate-500">
                    Aktif filtreler uygulanıyor.
                  </div>
                ) : null}
              </div>

              {!runHistoryState.items.length && !runHistoryLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {hasActiveHistoryFilters
                    ? "Seçili filtrelerle eşleşen içe aktarım kaydı bulunamadı."
                    : "Henüz listelenecek içe aktarım kaydı yok."}
                </div>
              ) : null}

              {runHistoryState.items.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => void openRunDetail(run.id)}
                  className={cx(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedRunId === run.id
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className={cx("text-sm font-semibold", selectedRunId === run.id ? "text-white" : "text-slate-900")}>
                        {run.sheetTitle}
                      </div>
                      <div className={cx("mt-1 text-xs", selectedRunId === run.id ? "text-slate-300" : "text-slate-500")}>
                        {formatRunDateTime(run.startedAt)} · {actorPrimaryLabel(run.actor)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                      <span className={cx("rounded-full border px-2.5 py-1", runModeTone(run.mode))}>
                        {formatRunModeLabel(run.mode)}
                      </span>
                      <span className={cx("rounded-full border px-2.5 py-1", runStatusTone(run.status))}>
                        {formatRunStatusLabel(run.status)}
                      </span>
                      <span className={cx("rounded-full border px-2.5 py-1", runOutcomeTone(run.outcome))}>
                        {formatRunOutcomeLabel(run.outcome)}
                      </span>
                      {run.duplicateOf ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                          Önceki benzer kayıt var
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    {[ 
                      ["Tab", formatEmployeeImportSheetTitle(run.sheetKind, run.sheetTitle)],
                      ["İstenen", run.requestedCount],
                      ["Değişen", run.changedCount ?? 0],
                      ["Reddedilen", run.rejectedCount ?? 0],
                      ["Uyarı", run.warningCount ?? 0],
                    ].map(([label, value]) => (
                      <div
                        key={`${run.id}-${String(label)}`}
                        className={cx(
                          "rounded-2xl border px-3 py-2",
                          selectedRunId === run.id
                            ? "border-slate-700 bg-slate-800"
                            : "border-slate-200 bg-white"
                        )}
                      >
                        <div className={cx("text-[11px] font-semibold uppercase tracking-wide", selectedRunId === run.id ? "text-slate-400" : "text-slate-500")}>
                          {label}
                        </div>
                        <div className={cx("mt-1 text-sm font-semibold", selectedRunId === run.id ? "text-white" : "text-slate-900")}>
                          {String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              ))}

              {runHistoryState.totalPages > 1 ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-600">
                    Bu sayfada <span className="font-semibold text-slate-900">{runHistoryState.items.length}</span> kayıt gösteriliyor.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRunHistoryPage((current) => Math.max(1, current - 1))}
                      disabled={runHistoryLoading || runHistoryState.page <= 1}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Önceki sayfa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRunHistoryPage((current) => Math.min(runHistoryState.totalPages || current, current + 1))
                      }
                      disabled={runHistoryLoading || runHistoryState.page >= runHistoryState.totalPages}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sonraki sayfa
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {selectedRunId && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40">
          <button
            type="button"
            aria-label="İşlem kaydı detayını kapat"
            onClick={closeRunDetail}
            className="absolute inset-0 cursor-default"
          />
          <aside
            ref={runDetailScrollRef}
            className="relative z-10 h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">İşlem Kaydı Detayı</div>
                <div className="mt-1 text-sm text-slate-500">{selectedRunId}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCorrectionPackExport(selectedRunId)}
                  disabled={
                    !selectedRunId ||
                    exportingCorrectionRunId === selectedRunId ||
                    !selectedRunDetail ||
                    (selectedRunDetail.issueSummary.totalErrorCount === 0 && selectedRunDetail.issueSummary.totalWarningCount === 0)
                  }
                  className="inline-flex items-center justify-center rounded-2xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingCorrectionRunId === selectedRunId ? "İndiriliyor..." : "Düzeltme paketini indir"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSupportHandoffBundleExport(selectedRunId)}
                  disabled={!selectedRunId || exportingRunId === selectedRunId}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingRunId === selectedRunId ? "İndiriliyor..." : "Destek paketini indir"}
                </button>
                <button
                  type="button"
                  onClick={closeRunDetail}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {selectedRunLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  İşlem kaydı yükleniyor...
                </div>
              ) : null}

              {selectedRunError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {selectedRunError}
                </div>
              ) : null}

              {selectedRunDetail ? (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{selectedRunDetail.sheetTitle}</div>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatEmployeeImportSheetTitle(selectedRunDetail.sheetKind, selectedRunDetail.sheetTitle)} · {actorPrimaryLabel(selectedRunDetail.actor)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
                        <span className={cx("rounded-full border px-3 py-1", runModeTone(selectedRunDetail.mode))}>
                          {formatRunModeLabel(selectedRunDetail.mode)}
                        </span>
                        <span className={cx("rounded-full border px-3 py-1", runStatusTone(selectedRunDetail.status))}>
                          {formatRunStatusLabel(selectedRunDetail.status)}
                        </span>
                        <span className={cx("rounded-full border px-3 py-1", runOutcomeTone(selectedRunDetail.outcome))}>
                          {formatRunOutcomeLabel(selectedRunDetail.outcome)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      {[
                        ["Başlangıç", formatRunDateTime(selectedRunDetail.startedAt)],
                        ["Bitiş", formatRunDateTime(selectedRunDetail.finishedAt)],
                        ["İstenen", selectedRunDetail.requestedCount],
                        ["İşlenen", selectedRunDetail.processedCount ?? 0],
                        ["Değişen", selectedRunDetail.changedCount ?? 0],
                        ["Reddedilen", selectedRunDetail.rejectedCount ?? 0],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{String(value)}</div>
                        </div>
                      ))}
                    </div>

                    {selectedRunDetail.failedMessage ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {selectedRunDetail.failedCode ? `${selectedRunDetail.failedCode} · ` : ""}
                        {selectedRunDetail.failedMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      {(["summary", "warnings", "errors", "snapshots"] as ImportRunDrawerTab[]).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveRunDrawerTab(tab)}
                          className={cx(
                            "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition",
                            activeRunDrawerTab === tab
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                          )}
                        >
                          {formatDrawerTabLabel(tab)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeRunDrawerTab === "summary" ? (
                    <div className="space-y-4">
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">İşlem bilgileri</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Bu kayıt, içe aktarımı kimin çalıştırdığını ve aynı dosya içeriğiyle bağlantılı önceki kayıtları gösterir.
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-700">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <span className="font-medium text-slate-900">Çalıştıran:</span>{" "}
                              {actorPrimaryLabel(selectedRunDetail.actor)}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <span className="font-medium text-slate-900">Yetki rolü:</span>{" "}
                              {formatActorRoleLabel(selectedRunDetail.actor.role)}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <span className="font-medium text-slate-900">Benzer içerik kontrolü:</span>{" "}
                              <span className="text-xs">Yapıldı</span>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <span className="font-medium text-slate-900">Benzer kayıt sayısı:</span>{" "}
                              {selectedRunDetail.duplicateRunCount}
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-900">
                            {formatEmployeeImportInspectionSummary(selectedRunDetail.inspectionPolicy)}{" "}
                            {formatEmployeeImportInspectionLimitText(selectedRunDetail.inspectionPolicy)}
                          </div>

                          {selectedRunDetail.duplicateOf ? (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                              <div className="text-sm font-semibold text-amber-900">Önceki benzer kayıt</div>
                              <div className="mt-2 text-xs text-amber-800">
                                Aynı içerikle daha önce çalıştırılmış kayıt: {formatRunDateTime(selectedRunDetail.duplicateOf.startedAt)}
                              </div>
                              <div className="mt-2 break-all rounded-xl border border-amber-200 bg-white/70 px-3 py-2 font-mono text-[11px] text-amber-900">
                                {selectedRunDetail.duplicateOf.id}
                              </div>
                              <button
                                type="button"
                                onClick={() => void openRunDetail(selectedRunDetail.duplicateOf!.id)}
                                className="mt-3 inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                              >
                                Önceki kaydı aç
                              </button>
                            </div>
                          ) : null}

                          {selectedRunDetail.duplicateRunsPreview.length ? (
                            <div className="mt-4">
                              <div className="text-sm font-semibold text-slate-900">Bu kayıtla bağlantılı son işlemler</div>
                              <div className="mt-3 space-y-2">
                                {selectedRunDetail.duplicateRunsPreview.map((run) => (
                                  <button
                                    key={run.id}
                                    type="button"
                                    onClick={() => void openRunDetail(run.id)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
                                  >
                                    <div className="text-sm font-semibold text-slate-900">{run.id}</div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {formatRunDateTime(run.startedAt)} · {formatRunModeLabel(run.mode)} · {formatRunOutcomeLabel(run.outcome)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {selectedRunDetail.readinessSummary ? (
                          <ImportReadinessPanel
                            title="Hazırlık özeti"
                            summary={selectedRunDetail.readinessSummary}
                          />
                        ) : null}

                        {(selectedRunDetail.issueSummary.totalErrorCount > 0 || selectedRunDetail.issueSummary.totalWarningCount > 0) ? (
                          <ImportIssueSummaryPanel
                            title="Sorun özeti"
                            summary={selectedRunDetail.issueSummary}
                            emptyText={
                              selectedRunDetail.inspectionPolicy.previewsExpired
                                ? "Sorun önizlemeleri saklama süresi nedeniyle temizlenmiş."
                                : "Kayıtlı sorun önizlemesi bulunmuyor."
                            }
                          />
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">Değişen çalışanlar</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Uygulama sonrası değişiklik alan çalışanların sınırlı ve maskelenmiş listesi burada görünür.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedRunDetail.previews.changedEmployeeCodes.length ? (
                              selectedRunDetail.previews.changedEmployeeCodes.map((code) => (
                                <span key={code} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                  {code}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500">{getEmployeeImportPreviewEmptyText("changedEmployees")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeRunDrawerTab === "warnings" ? (
                    <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-amber-800">
                          {getEmployeeImportPreviewSectionTitle("warnings")}
                        </div>
                        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {selectedRunDetail.previews.warnings.length} kayıt
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                        {formatEmployeeImportPreviewPolicyText(selectedRunDetail.inspectionPolicy)}
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedRunDetail.previews.warnings.length ? (
                          <ImportWarningGroupList issues={selectedRunDetail.previews.warnings} />
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            {getEmployeeImportPreviewEmptyText("warnings")}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeRunDrawerTab === "errors" ? (
                    <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-rose-800">
                          {getEmployeeImportPreviewSectionTitle("errors")}
                        </div>
                        <div className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
                          {selectedRunDetail.previews.errors.length} kayıt
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                        {formatEmployeeImportErrorPreviewPolicyText(selectedRunDetail.inspectionPolicy)}
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedRunDetail.previews.errors.length ? (
                          selectedRunDetail.previews.errors.map((issue, idx) => (
                            <div key={`${issue.code}-${issue.line}-${idx}`} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                              <div className="font-semibold">
                                {issue.employeeCode || `Satır ${issue.line || "?"}`} · {issue.code}
                              </div>
                              <div className="mt-1">{issue.message || "Mesaj yok."}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            {getEmployeeImportPreviewEmptyText("errors")}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeRunDrawerTab === "snapshots" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-sm font-semibold text-slate-900">Anlık görüntü politikası</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {formatEmployeeImportSnapshotPolicyText(selectedRunDetail.inspectionPolicy)}
                        </p>
                      </div>
                      {[
                        [getEmployeeImportSnapshotLabel("headerSummary"), selectedRunDetail.snapshots.headerSummary],
                        [getEmployeeImportSnapshotLabel("codeResolution"), selectedRunDetail.snapshots.codeResolution],
                        [getEmployeeImportSnapshotLabel("applySummary"), selectedRunDetail.snapshots.applySummary],
                      ].map(([label, snapshot]) => (
                        <div key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">{String(label)}</div>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4">
                            <pre className="text-xs leading-6 text-slate-100">
                              {snapshot ? JSON.stringify(snapshot, null, 2) : "Kayıtlı anlık görüntü yok."}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </aside>
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}
