export const EMPLOYEE_IMPORT_RUN_ISSUE_PREVIEW_LIMIT = 50;
export const EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT = 100;
export const EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS = 90;
export const EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS = 180;

export type EmployeeImportInspectionPolicyMeta = {
  actorMasked: boolean;
  previewValuesMasked: boolean;
  previewRetentionDays: number;
  snapshotRetentionDays: number;
  issuePreviewLimit: number;
  changedEmployeePreviewLimit: number;
  previewsExpired: boolean;
  snapshotsExpired: boolean;
};

type ImportRunIssuePreviewLike = {
  line: number;
  employeeCode?: string | null;
  code: string;
  message?: string | null;
  field?: string | null;
  value?: string | null;
};

function maskWithVisibleEdges(value: string, visiblePrefix: number, visibleSuffix: number, maskChar = "*"): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const totalVisible = visiblePrefix + visibleSuffix;
  if (normalized.length <= totalVisible) {
    return `${maskChar.repeat(Math.max(1, normalized.length - 1))}${normalized.slice(-1)}`;
  }

  const prefix = normalized.slice(0, visiblePrefix);
  const suffix = normalized.slice(normalized.length - visibleSuffix);
  const hiddenCount = Math.max(2, normalized.length - totalVisible);
  return `${prefix}${maskChar.repeat(hiddenCount)}${suffix}`;
}

export function maskEmployeeImportRunEmail(email: string | null | undefined): string | null {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return maskWithVisibleEdges(normalized, 2, 1);

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  const maskedLocal = `${visibleLocal}${"*".repeat(Math.max(3, local.length - visibleLocal.length))}`;
  return `${maskedLocal}@${domain}`;
}

export function maskEmployeeImportRunIdentifier(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return maskWithVisibleEdges(normalized, Math.min(2, normalized.length), Math.min(2, Math.max(1, normalized.length - 2)));
}

function maskLastFour(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length <= 4) return `${"*".repeat(Math.max(1, normalized.length - 1))}${normalized.slice(-1)}`;
  return `${"*".repeat(normalized.length - 4)}${normalized.slice(-4)}`;
}

function maskName(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return `${normalized.slice(0, 1)}${"*".repeat(Math.max(2, normalized.length - 1))}`;
}

export function maskEmployeeImportIssueValue(field: string | null | undefined, value: string | null | undefined): string | null {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return null;

  const normalizedField = String(field ?? "").trim();

  if (normalizedField === "email") return maskEmployeeImportRunEmail(normalizedValue);
  if (normalizedField === "nationalId") return maskLastFour(normalizedValue);
  if (normalizedField === "phone") return maskLastFour(normalizedValue);
  if (normalizedField === "cardNo") return maskLastFour(normalizedValue);
  if (normalizedField === "deviceUserId") return maskLastFour(normalizedValue);
  if (normalizedField === "employeeCode") return maskEmployeeImportRunIdentifier(normalizedValue);
  if (normalizedField === "firstName" || normalizedField === "lastName") return maskName(normalizedValue);

  return normalizedValue;
}

export function sanitizeEmployeeImportRunIssuePreview<T extends ImportRunIssuePreviewLike>(issue: T): T {
  return {
    ...issue,
    employeeCode: maskEmployeeImportRunIdentifier(issue.employeeCode ?? null),
    value: maskEmployeeImportIssueValue(issue.field ?? null, issue.value ?? null),
  };
}

export function sanitizeEmployeeImportRunIssuePreviewList<T extends ImportRunIssuePreviewLike>(issues: T[]): T[] {
  return issues.map((issue) => sanitizeEmployeeImportRunIssuePreview(issue));
}

export function sanitizeEmployeeImportRunChangedEmployeeCodesPreview(employeeCodes: string[]): string[] {
  return Array.from(
    new Set(
      employeeCodes
        .map((code) => maskEmployeeImportRunIdentifier(code))
        .filter((code): code is string => Boolean(code)),
    ),
  ).slice(0, EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function isEmployeeImportRunPreviewExpired(finishedAt: Date | null | undefined): boolean {
  if (!finishedAt) return false;
  return finishedAt < daysAgo(EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS);
}

export function isEmployeeImportRunSnapshotExpired(finishedAt: Date | null | undefined): boolean {
  if (!finishedAt) return false;
  return finishedAt < daysAgo(EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS);
}

export function employeeImportRunPreviewRetentionThresholdDate(): Date {
  return daysAgo(EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS);
}

export function employeeImportRunSnapshotRetentionThresholdDate(): Date {
  return daysAgo(EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS);
}

export function formatEmployeeImportInspectionSummary(policy: EmployeeImportInspectionPolicyMeta): string {
  return policy.actorMasked
    ? "Kullanıcı e-postası ve çalışan önizlemeleri maskelenmiş gösterilir."
    : "Bu işlem için kimlik maskelemesi uygulanmıyor.";
}

export function formatEmployeeImportInspectionLimitText(policy: EmployeeImportInspectionPolicyMeta): string {
  return `Uyarı ve hata önizlemeleri ilk ${policy.issuePreviewLimit} kayıt, değişen çalışan önizlemesi ise ilk ${policy.changedEmployeePreviewLimit} kayıt ile sınırlıdır.`;
}

export function formatEmployeeImportPreviewPolicyText(policy: EmployeeImportInspectionPolicyMeta): string {
  if (policy.previewsExpired) {
    return `Bu işlem için önizleme alanları ${policy.previewRetentionDays} günlük saklama süresi dolduğu için temizlenmiştir.`;
  }
  return "Önizleme alanları maskelenmiş saklanır; ham kişisel veri aynen gösterilmez.";
}

export function formatEmployeeImportErrorPreviewPolicyText(policy: EmployeeImportInspectionPolicyMeta): string {
  if (policy.previewsExpired) {
    return `Bu işlem için önizleme alanları ${policy.previewRetentionDays} günlük saklama süresi dolduğu için temizlenmiştir.`;
  }
  if (policy.previewValuesMasked) {
    return "Hata önizlemelerinde çalışan kodu ve alan değeri maskelenmiş gösterilir.";
  }
  return "Hata önizlemeleri bu işlem için olduğu gibi gösterilir.";
}

export function formatEmployeeImportSnapshotPolicyText(policy: EmployeeImportInspectionPolicyMeta): string {
  if (policy.snapshotsExpired) {
    return `Bu işlem için anlık görüntü alanları ${policy.snapshotRetentionDays} günlük saklama süresi dolduğu için temizlenmiştir.`;
  }
  return `Anlık görüntü alanları ${policy.snapshotRetentionDays} gün boyunca inceleme için tutulur.`;
}

export function getEmployeeImportPreviewSectionTitle(kind: "warnings" | "errors" | "changedEmployees"): string {
  if (kind === "warnings") return "Uyarı önizlemesi";
  if (kind === "errors") return "Hata önizlemesi";
  return "Değişen çalışan önizlemesi";
}

export function getEmployeeImportPreviewEmptyText(kind: "warnings" | "errors" | "changedEmployees"): string {
  if (kind === "warnings") return "Kayıtlı uyarı önizlemesi yok.";
  if (kind === "errors") return "Kayıtlı hata önizlemesi yok.";
  return "Kayıtlı çalışan önizlemesi yok.";
}

export function getEmployeeImportSnapshotLabel(kind: "headerSummary" | "codeResolution" | "applySummary"): string {
  if (kind === "headerSummary") return "Başlık özeti";
  if (kind === "codeResolution") return "Kod çözümleme özeti";
  return "Uygulama özeti";
}
