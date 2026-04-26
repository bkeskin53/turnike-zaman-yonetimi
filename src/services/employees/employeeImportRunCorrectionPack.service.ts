import { EMPLOYEE_IMPORT_FIELDS, formatEmployeeImportSheetTitle } from "@/src/features/employees/importTemplate";
import { describeEmployeeImportIssueTaxonomy } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import type {
  EmployeeImportRunDetailDto,
  EmployeeImportRunIssuePreviewDto,
} from "@/src/services/employees/employeeImportRunQuery.service";

export type EmployeeImportRunCorrectionPackExport = {
  filename: string;
  contentType: string;
  content: string;
};

function sanitizeFilenamePart(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function csvSafeValue(value: string | null | undefined) {
  const text = String(value ?? "");
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const formulaRisk = /^[=+\-@]/.test(normalized);
  const safe = formulaRisk ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, "\"\"")}"`;
}

function toCsvRow(values: Array<string | null | undefined>) {
  return values.map((value) => csvSafeValue(value)).join(";");
}

function formatFieldLabel(field: string | null) {
  if (!field) return "";
  if (Object.prototype.hasOwnProperty.call(EMPLOYEE_IMPORT_FIELDS, field)) {
    return EMPLOYEE_IMPORT_FIELDS[field as keyof typeof EMPLOYEE_IMPORT_FIELDS].label;
  }
  return field;
}

function buildIssueRows(args: {
  detail: EmployeeImportRunDetailDto;
  severity: "error" | "warning";
  issues: EmployeeImportRunIssuePreviewDto[];
  previewLimited: boolean;
}): string[] {
  return args.issues.map((issue) => {
    const taxonomy = describeEmployeeImportIssueTaxonomy(issue);
    return toCsvRow([
      args.detail.id,
      formatEmployeeImportSheetTitle(args.detail.sheetKind, args.detail.sheetTitle),
      args.detail.mode,
      args.detail.status,
      args.detail.outcome ?? "",
      args.severity === "error" ? "HATA" : "UYARI",
      taxonomy.title,
      issue.code,
      issue.line > 0 ? String(issue.line) : "",
      issue.employeeCode ?? "",
      formatFieldLabel(issue.field),
      issue.message ?? "",
      issue.value ?? "",
      args.previewLimited ? "EVET" : "HAYIR",
    ]);
  });
}

export function buildEmployeeImportRunCorrectionPackExport(
  detail: EmployeeImportRunDetailDto,
): EmployeeImportRunCorrectionPackExport {
  const rows: string[] = [];
  rows.push("\uFEFFsep=;");
  rows.push(
    toCsvRow([
      "Run ID",
      "Sekme",
      "Mod",
      "Durum",
      "Sonuc",
      "Seviye",
      "Sorun Kumesi",
      "Issue Kodu",
      "Satir",
      "Calisan Kodu",
      "Alan",
      "Kullanici Aciklamasi",
      "Masked Referans Degeri",
      "Preview Siniri",
    ]),
  );

  rows.push(
    ...buildIssueRows({
      detail,
      severity: "error",
      issues: detail.previews.errors,
      previewLimited: detail.issueSummary.errorPreviewLimited,
    }),
  );
  rows.push(
    ...buildIssueRows({
      detail,
      severity: "warning",
      issues: detail.previews.warnings,
      previewLimited: detail.issueSummary.warningPreviewLimited,
    }),
  );

  const filename = [
    "import-correction-pack",
    sanitizeFilenamePart(detail.sheetKind),
    sanitizeFilenamePart(detail.id),
  ]
    .filter(Boolean)
    .join("-");

  return {
    filename: `${filename || "import-correction-pack"}.csv`,
    contentType: "text/csv; charset=utf-8",
    content: rows.join("\n"),
  };
}
