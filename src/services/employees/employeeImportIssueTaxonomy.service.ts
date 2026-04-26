import { EMPLOYEE_IMPORT_FIELDS } from "@/src/features/employees/importTemplate";
import type { EmployeeImportFieldKey } from "@/src/features/employees/importTemplate";
import type { EmployeeImportValidationIssue } from "@/src/services/employees/importTemplateValidation.service";

type EmployeeImportIssueLike = {
  line: number;
  employeeCode?: string | null;
  code: string;
  message?: string | null;
  field?: string | null;
  value?: string | null;
};

export type EmployeeImportIssueSeverity = "error" | "warning";

export type EmployeeImportIssueGroupKey =
  | "HEADER_AND_LAYOUT"
  | "DUPLICATE_INPUT"
  | "REQUIRED_FIELDS"
  | "DATE_AND_SCOPE"
  | "EMPLOYMENT_CONTEXT"
  | "PROFILE_VALUES"
  | "EMPLOYEE_MATCHING"
  | "CARD_AND_IDENTITY"
  | "ORG_REFERENCES"
  | "WORK_REFERENCES"
  | "SYSTEM_AND_OPERATION";

export type EmployeeImportIssueGroupCodeBreakdown = {
  code: string;
  count: number;
};

export type EmployeeImportIssueGroupSummaryDto = {
  key: EmployeeImportIssueGroupKey;
  severity: EmployeeImportIssueSeverity;
  title: string;
  description: string;
  issueCount: number;
  lineCount: number;
  fields: string[];
  codeBreakdown: EmployeeImportIssueGroupCodeBreakdown[];
  sampleEmployeeCodes: string[];
  sampleLines: number[];
  previewLimited: boolean;
};

export type EmployeeImportIssueSummaryDto = {
  source: "FULL" | "PREVIEW";
  previewLimited: boolean;
  errorPreviewLimited: boolean;
  warningPreviewLimited: boolean;
  totalErrorCount: number;
  totalWarningCount: number;
  availableErrorCount: number;
  availableWarningCount: number;
  errorGroups: EmployeeImportIssueGroupSummaryDto[];
  warningGroups: EmployeeImportIssueGroupSummaryDto[];
};

const PREVIEW_SAMPLE_LIMIT = 4;

const HEADER_AND_LAYOUT_CODES = new Set([
  "EMPTY_HEADERS",
  "DUPLICATE_HEADERS",
  "UNKNOWN_HEADERS",
  "MISSING_REQUIRED_HEADERS",
  "ROW_HAS_EXTRA_COLUMNS",
  "NO_DATA_ROWS",
]);

const DUPLICATE_INPUT_CODES = new Set([
  "DUPLICATE_SCOPE_ROW",
  "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
]);

const DATE_AND_SCOPE_CODES = new Set([
  "SCOPE_END_BEFORE_START",
  "TERMINATION_BEFORE_HIRE",
  "SCOPE_START_AFTER_TERMINATION_DATE",
  "SCOPE_END_AFTER_TERMINATION_DATE",
  "SCOPE_START_BEFORE_HIRE_DATE",
]);

const EMPLOYMENT_CONTEXT_CODES = new Set([
  "INVALID_EMPLOYMENT_ACTION",
  "TERMINATION_DATE_REQUIRED_FOR_TERMINATE",
  "HIRE_DATE_REQUIRED_FOR_REHIRE",
  "EMPLOYMENT_ACTION_NOT_ALLOWED_FOR_CREATE",
  "IS_ACTIVE_DERIVED_IN_PATCH_8_8",
  "COMPANY_CODE_REFERENCE_ONLY_IN_PATCH_8_8",
  "HIRE_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8",
  "TERMINATION_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8",
  "HIRE_DATE_IGNORED_FOR_TERMINATE_IN_PATCH_8_8",
  "TERMINATION_DATE_IGNORED_FOR_HIRE_IN_PATCH_8_8",
  "TERMINATION_DATE_IGNORED_FOR_REHIRE_IN_PATCH_8_8",
  "TERMINATION_DATE_REFERENCE_ONLY_ON_CREATE_IN_PATCH_8_8",
]);

const PROFILE_VALUE_CODES = new Set([
  "INVALID_NATIONAL_ID",
  "PHONE_TOO_LONG",
  "INVALID_GENDER",
  "UNKNOWN_GENDER_VALUE",
  "INVALID_EMAIL_FORMAT",
  "FIRST_NAME_REQUIRED",
  "LAST_NAME_REQUIRED",
]);

const EMPLOYEE_MATCHING_CODES = new Set([
  "EMPLOYEE_NOT_FOUND",
  "EMPLOYEE_CODE_TAKEN",
]);

const CARD_AND_IDENTITY_CODES = new Set([
  "CARD_NO_DUPLICATE_IN_UPLOAD",
  "CARD_NO_TAKEN",
  "CARD_NO_MISMATCH",
  "CARD_NO_REFERENCE_ONLY",
]);

const ORG_REFERENCE_CODES = new Set([
  "BRANCH_CODE_NOT_FOUND",
  "BRANCH_INACTIVE",
  "BRANCH_CODE_INACTIVE",
  "EMPLOYEE_GROUP_CODE_NOT_FOUND",
  "EMPLOYEE_SUBGROUP_CODE_NOT_FOUND",
  "EMPLOYEE_SUBGROUP_GROUP_MISMATCH",
  "SUBGROUP_GROUP_MISMATCH",
  "NO_ORG_CODES_TO_RESOLVE",
]);

const WORK_REFERENCE_CODES = new Set([
  "WORK_SCHEDULE_PATTERN_CODE_NOT_FOUND",
  "WORK_SCHEDULE_PATTERN_INACTIVE",
  "NO_WORK_CODES_TO_RESOLVE",
]);

const PROFILE_FIELDS = new Set<EmployeeImportFieldKey>([
  "firstName",
  "lastName",
  "nationalId",
  "phone",
  "email",
  "gender",
]);

const DATE_AND_SCOPE_FIELDS = new Set<EmployeeImportFieldKey>([
  "scopeStartDate",
  "scopeEndDate",
  "hireDate",
  "terminationDate",
]);

const EMPLOYMENT_FIELDS = new Set<EmployeeImportFieldKey>([
  "employmentAction",
  "hireDate",
  "terminationDate",
  "isActive",
  "companyCode",
]);

const ORG_FIELDS = new Set<EmployeeImportFieldKey>([
  "branchCode",
  "employeeGroupCode",
  "employeeSubgroupCode",
]);

function isKnownEmployeeImportFieldKey(value: string | null | undefined): value is EmployeeImportFieldKey {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(EMPLOYEE_IMPORT_FIELDS, value);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
}

function uniqueNumberList(values: Iterable<number>): number[] {
  return Array.from(new Set(Array.from(values).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
}

function groupMeta(key: EmployeeImportIssueGroupKey): { title: string; description: string } {
  switch (key) {
    case "HEADER_AND_LAYOUT":
      return {
        title: "Dosya ve başlık sözleşmesi",
        description: "Sekme başlıkları, kolon düzeni ve temel dosya yapısı bu kümede toplanır.",
      };
    case "DUPLICATE_INPUT":
      return {
        title: "Tekrarlayan içerik ve kapsam",
        description: "Aynı kapsam satırı veya daha önce uygulanmış aynı içerik gibi tekrarlar burada görünür.",
      };
    case "REQUIRED_FIELDS":
      return {
        title: "Eksik zorunlu alanlar",
        description: "Uygulama öncesinde doldurulması gereken zorunlu hücreler eksik.",
      };
    case "DATE_AND_SCOPE":
      return {
        title: "Tarih ve kapsam kuralları",
        description: "scopeStartDate, scopeEndDate ve tarih sırası ile ilgili kural ihlalleri bu gruptadır.",
      };
    case "EMPLOYMENT_CONTEXT":
      return {
        title: "İstihdam bağlamı ve referans alanlar",
        description: "employmentAction, hireDate, terminationDate ve reference-only yaşam döngüsü alanları burada özetlenir.",
      };
    case "PROFILE_VALUES":
      return {
        title: "Kişisel alan doğrulamaları",
        description: "Ad, soyad, telefon, e-posta, TC kimlik ve cinsiyet alanlarındaki veri sorunları burada toplanır.",
      };
    case "EMPLOYEE_MATCHING":
      return {
        title: "Çalışan eşleştirme",
        description: "employeeCode ile çalışan bulma veya create sırasında kimlik çakışması sorunları burada görünür.",
      };
    case "CARD_AND_IDENTITY":
      return {
        title: "Kart ve kimlik çakışmaları",
        description: "Kart numarası çatışmaları ve referans kart kuralları bu grupta yer alır.",
      };
    case "ORG_REFERENCES":
      return {
        title: "Organizasyon kodları",
        description: "Lokasyon, grup ve alt grup referansları ile uyumsuzluklar bu kümede toplanır.",
      };
    case "WORK_REFERENCES":
      return {
        title: "Çalışma planı kodları",
        description: "workSchedulePatternCode çözümleme ve pattern erişim sorunları burada görünür.",
      };
    case "SYSTEM_AND_OPERATION":
    default:
      return {
        title: "Sistem ve operasyon durumu",
        description: "Beklenmeyen operasyon hataları ve genel import çalışma durumu bu grupta görünür.",
      };
  }
}

function resolveIssueGroupKey(issue: EmployeeImportIssueLike): EmployeeImportIssueGroupKey {
  const code = String(issue.code ?? "").trim().toUpperCase();
  const field = String(issue.field ?? "").trim();

  if (HEADER_AND_LAYOUT_CODES.has(code)) return "HEADER_AND_LAYOUT";
  if (DUPLICATE_INPUT_CODES.has(code)) return "DUPLICATE_INPUT";
  if (code.startsWith("MISSING_") && code !== "MISSING_REQUIRED_HEADERS") return "REQUIRED_FIELDS";
  if (DATE_AND_SCOPE_CODES.has(code) || code.startsWith("INVALID_SCOPE") || code.startsWith("INVALID_HIRE") || code.startsWith("INVALID_TERMINATION")) {
    return "DATE_AND_SCOPE";
  }
  if (
    EMPLOYMENT_CONTEXT_CODES.has(code) ||
    code.includes("EMPLOYMENT_ACTION") ||
    code.includes("TERMINATE") ||
    code.includes("REHIRE") ||
    code.includes("HIRE_DATE") ||
    code.includes("TERMINATION_DATE")
  ) {
    return "EMPLOYMENT_CONTEXT";
  }
  if (PROFILE_VALUE_CODES.has(code)) return "PROFILE_VALUES";
  if (EMPLOYEE_MATCHING_CODES.has(code)) return "EMPLOYEE_MATCHING";
  if (CARD_AND_IDENTITY_CODES.has(code)) return "CARD_AND_IDENTITY";
  if (ORG_REFERENCE_CODES.has(code)) return "ORG_REFERENCES";
  if (WORK_REFERENCE_CODES.has(code)) return "WORK_REFERENCES";
  if (code.endsWith("_FAILED") || code === "UNIQUE_CONSTRAINT") return "SYSTEM_AND_OPERATION";

  if (isKnownEmployeeImportFieldKey(field)) {
    if (PROFILE_FIELDS.has(field)) return "PROFILE_VALUES";
    if (DATE_AND_SCOPE_FIELDS.has(field)) return "DATE_AND_SCOPE";
    if (EMPLOYMENT_FIELDS.has(field)) return "EMPLOYMENT_CONTEXT";
    if (ORG_FIELDS.has(field)) return "ORG_REFERENCES";
    if (field === "employeeCode") return "EMPLOYEE_MATCHING";
    if (field === "cardNo") return "CARD_AND_IDENTITY";
    if (field === "workSchedulePatternCode") return "WORK_REFERENCES";
  }

  return "SYSTEM_AND_OPERATION";
}

export function describeEmployeeImportIssueTaxonomy(issue: EmployeeImportIssueLike): {
  key: EmployeeImportIssueGroupKey;
  title: string;
  description: string;
} {
  const key = resolveIssueGroupKey(issue);
  const meta = groupMeta(key);
  return {
    key,
    title: meta.title,
    description: meta.description,
  };
}

function buildIssueGroupSummaries(params: {
  issues: EmployeeImportIssueLike[];
  severity: EmployeeImportIssueSeverity;
  previewLimited: boolean;
}): EmployeeImportIssueGroupSummaryDto[] {
  const buckets = new Map<
    EmployeeImportIssueGroupKey,
    {
      issueCount: number;
      lines: Set<number>;
      fields: Set<string>;
      codeCounts: Map<string, number>;
      employeeCodes: Set<string>;
      sampleLines: Set<number>;
    }
  >();

  for (const issue of params.issues) {
    const key = resolveIssueGroupKey(issue);
    const bucket =
      buckets.get(key) ??
      {
        issueCount: 0,
        lines: new Set<number>(),
        fields: new Set<string>(),
        codeCounts: new Map<string, number>(),
        employeeCodes: new Set<string>(),
        sampleLines: new Set<number>(),
      };

    bucket.issueCount += 1;
    if (issue.line > 0) {
      bucket.lines.add(issue.line);
      if (bucket.sampleLines.size < PREVIEW_SAMPLE_LIMIT) bucket.sampleLines.add(issue.line);
    }

    const field = String(issue.field ?? "").trim();
    if (field) bucket.fields.add(field);

    const code = String(issue.code ?? "").trim().toUpperCase() || "UNKNOWN";
    bucket.codeCounts.set(code, (bucket.codeCounts.get(code) ?? 0) + 1);

    const employeeCode = String(issue.employeeCode ?? "").trim();
    if (employeeCode && bucket.employeeCodes.size < PREVIEW_SAMPLE_LIMIT) bucket.employeeCodes.add(employeeCode);

    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const meta = groupMeta(key);
      return {
        key,
        severity: params.severity,
        title: meta.title,
        description: meta.description,
        issueCount: bucket.issueCount,
        lineCount: bucket.lines.size,
        fields: uniqueSorted(bucket.fields),
        codeBreakdown: Array.from(bucket.codeCounts.entries())
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, "en")),
        sampleEmployeeCodes: uniqueSorted(bucket.employeeCodes).slice(0, PREVIEW_SAMPLE_LIMIT),
        sampleLines: uniqueNumberList(bucket.sampleLines).slice(0, PREVIEW_SAMPLE_LIMIT),
        previewLimited: params.previewLimited,
      } satisfies EmployeeImportIssueGroupSummaryDto;
    })
    .sort((a, b) => b.issueCount - a.issueCount || b.lineCount - a.lineCount || a.title.localeCompare(b.title, "tr"));
}

export function buildEmployeeImportIssueSummary(args: {
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
}): EmployeeImportIssueSummaryDto {
  return {
    source: "FULL",
    previewLimited: false,
    errorPreviewLimited: false,
    warningPreviewLimited: false,
    totalErrorCount: args.errors.length,
    totalWarningCount: args.warnings.length,
    availableErrorCount: args.errors.length,
    availableWarningCount: args.warnings.length,
    errorGroups: buildIssueGroupSummaries({
      issues: args.errors,
      severity: "error",
      previewLimited: false,
    }),
    warningGroups: buildIssueGroupSummaries({
      issues: args.warnings,
      severity: "warning",
      previewLimited: false,
    }),
  };
}

export function buildEmployeeImportIssuePreviewSummary(args: {
  errors: EmployeeImportIssueLike[];
  warnings: EmployeeImportIssueLike[];
  totalErrorCount?: number | null;
  totalWarningCount?: number | null;
}): EmployeeImportIssueSummaryDto {
  const totalErrorCount = Math.max(args.errors.length, Number(args.totalErrorCount ?? 0));
  const totalWarningCount = Math.max(args.warnings.length, Number(args.totalWarningCount ?? 0));
  const errorPreviewLimited = totalErrorCount > args.errors.length;
  const warningPreviewLimited = totalWarningCount > args.warnings.length;

  return {
    source: "PREVIEW",
    previewLimited: errorPreviewLimited || warningPreviewLimited,
    errorPreviewLimited,
    warningPreviewLimited,
    totalErrorCount,
    totalWarningCount,
    availableErrorCount: args.errors.length,
    availableWarningCount: args.warnings.length,
    errorGroups: buildIssueGroupSummaries({
      issues: args.errors,
      severity: "error",
      previewLimited: errorPreviewLimited,
    }),
    warningGroups: buildIssueGroupSummaries({
      issues: args.warnings,
      severity: "warning",
      previewLimited: warningPreviewLimited,
    }),
  };
}
