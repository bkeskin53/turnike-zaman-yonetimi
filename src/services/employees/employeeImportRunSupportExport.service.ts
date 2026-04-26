import { formatEmployeeImportSheetTitle } from "@/src/features/employees/importTemplate";
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
import type {
  EmployeeImportRunDetailDto,
  EmployeeImportRunIssuePreviewDto,
  EmployeeImportRunReferenceDto,
} from "@/src/services/employees/employeeImportRunQuery.service";

export type EmployeeImportRunSupportSummaryExport = {
  filename: string;
  contentType: string;
  content: string;
};

function formatExportDateTime(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

function formatRunModeLabel(mode: EmployeeImportRunDetailDto["mode"]) {
  return mode === "DRY_RUN" ? "Dogrulama" : "Uygulama";
}

function formatRunStatusLabel(status: EmployeeImportRunDetailDto["status"]) {
  if (status === "RUNNING") return "Calisiyor";
  if (status === "FAILED") return "Basarisiz";
  return "Tamamlandi";
}

function formatRunOutcomeLabel(outcome: EmployeeImportRunDetailDto["outcome"]) {
  if (outcome === "CLEAN") return "Temiz";
  if (outcome === "WARNING") return "Uyarili";
  if (outcome === "BLOCKING") return "Bloklayan";
  if (outcome === "PARTIAL") return "Kismi";
  return "Belirtilmedi";
}

function actorPrimaryLabel(detail: EmployeeImportRunDetailDto) {
  return detail.actor.email || detail.actor.userId;
}

function sanitizeFilenamePart(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatReference(reference: EmployeeImportRunReferenceDto | null | undefined) {
  if (!reference) return "-";
  return `${reference.id} | ${formatEmployeeImportSheetTitle(reference.sheetKind, reference.sheetTitle)} | ${formatExportDateTime(reference.startedAt)}`;
}

function formatIssuePreviewLines(issues: EmployeeImportRunIssuePreviewDto[]) {
  if (!issues.length) return ["- " + getEmployeeImportPreviewEmptyText("errors")];

  return issues.map((issue) => {
    const parts = [
      issue.employeeCode || `Satir ${issue.line || "?"}`,
      issue.code,
      issue.message || "Mesaj yok.",
    ];

    if (issue.field) parts.push(`Alan: ${issue.field}`);
    if (issue.value) parts.push(`Deger: ${issue.value}`);

    return `- ${parts.join(" | ")}`;
  });
}

function formatWarningPreviewLines(issues: EmployeeImportRunIssuePreviewDto[]) {
  if (!issues.length) return ["- " + getEmployeeImportPreviewEmptyText("warnings")];

  return issues.map((issue) => {
    const parts = [
      issue.employeeCode || `Satir ${issue.line || "?"}`,
      issue.code,
      issue.message || "Mesaj yok.",
    ];

    if (issue.field) parts.push(`Alan: ${issue.field}`);
    if (issue.value) parts.push(`Deger: ${issue.value}`);

    return `- ${parts.join(" | ")}`;
  });
}

function formatChangedEmployeeLines(employeeCodes: string[]) {
  if (!employeeCodes.length) return ["- " + getEmployeeImportPreviewEmptyText("changedEmployees")];
  return employeeCodes.map((employeeCode) => `- ${employeeCode}`);
}

function formatSnapshotBlock(label: string, snapshot: Record<string, unknown> | null) {
  const lines = [`## ${label}`];
  lines.push(snapshot ? JSON.stringify(snapshot, null, 2) : "Kayitli snapshot yok.");
  return lines;
}

export function buildEmployeeImportRunSupportSummaryExport(
  detail: EmployeeImportRunDetailDto,
): EmployeeImportRunSupportSummaryExport {
  const lines: string[] = [];

  lines.push("Import Run Support Summary");
  lines.push("");
  lines.push(`Run ID: ${detail.id}`);
  lines.push(`Tab: ${formatEmployeeImportSheetTitle(detail.sheetKind, detail.sheetTitle)}`);
  lines.push(`Mod: ${formatRunModeLabel(detail.mode)}`);
  lines.push(`Durum: ${formatRunStatusLabel(detail.status)}`);
  lines.push(`Sonuc: ${formatRunOutcomeLabel(detail.outcome)}`);
  lines.push(`Baslangic: ${formatExportDateTime(detail.startedAt)}`);
  lines.push(`Bitis: ${formatExportDateTime(detail.finishedAt)}`);
  lines.push(`Calistiran: ${actorPrimaryLabel(detail)}`);
  lines.push(`Rol: ${detail.actor.role || "Belirtilmedi"}`);
  lines.push(`Icerik hash: ${detail.contentHash}`);
  lines.push("");

  lines.push("## Sayaclar");
  lines.push(`- Istenen: ${detail.requestedCount}`);
  lines.push(`- Islenen: ${detail.processedCount ?? 0}`);
  lines.push(`- Bulunan: ${detail.foundCount ?? 0}`);
  lines.push(`- Degisen: ${detail.changedCount ?? 0}`);
  lines.push(`- Degismeyen: ${detail.unchangedCount ?? 0}`);
  lines.push(`- Reddedilen: ${detail.rejectedCount ?? 0}`);
  lines.push(`- Uyari: ${detail.warningCount ?? 0}`);
  lines.push(`- Hata: ${detail.errorCount ?? 0}`);
  lines.push("");

  lines.push("## Duplicate Baglantisi");
  lines.push(`- Referans run: ${formatReference(detail.duplicateOf)}`);
  lines.push(`- Bagli duplicate sayisi: ${detail.duplicateRunCount}`);
  if (detail.duplicateRunsPreview.length) {
    lines.push("- Son bagli kosular:");
    for (const run of detail.duplicateRunsPreview) {
      lines.push(`  - ${formatReference(run)}`);
    }
  }
  lines.push("");

  lines.push("## Inspection Politikasi");
  lines.push(`- ${formatEmployeeImportInspectionSummary(detail.inspectionPolicy)}`);
  lines.push(`- ${formatEmployeeImportInspectionLimitText(detail.inspectionPolicy)}`);
  lines.push(`- ${formatEmployeeImportPreviewPolicyText(detail.inspectionPolicy)}`);
  lines.push(`- ${formatEmployeeImportErrorPreviewPolicyText(detail.inspectionPolicy)}`);
  lines.push(`- ${formatEmployeeImportSnapshotPolicyText(detail.inspectionPolicy)}`);
  lines.push("");

  lines.push(`## ${getEmployeeImportPreviewSectionTitle("warnings")}`);
  lines.push(...formatWarningPreviewLines(detail.previews.warnings));
  lines.push("");

  lines.push(`## ${getEmployeeImportPreviewSectionTitle("errors")}`);
  lines.push(...formatIssuePreviewLines(detail.previews.errors));
  lines.push("");

  lines.push(`## ${getEmployeeImportPreviewSectionTitle("changedEmployees")}`);
  lines.push(...formatChangedEmployeeLines(detail.previews.changedEmployeeCodes));
  lines.push("");

  lines.push(...formatSnapshotBlock(getEmployeeImportSnapshotLabel("headerSummary"), detail.snapshots.headerSummary));
  lines.push("");
  lines.push(...formatSnapshotBlock(getEmployeeImportSnapshotLabel("codeResolution"), detail.snapshots.codeResolution));
  lines.push("");
  lines.push(...formatSnapshotBlock(getEmployeeImportSnapshotLabel("applySummary"), detail.snapshots.applySummary));
  lines.push("");

  if (detail.failedMessage) {
    lines.push("## Basarisizlik Bilgisi");
    lines.push(detail.failedCode ? `${detail.failedCode} | ${detail.failedMessage}` : detail.failedMessage);
    lines.push("");
  }

  const filename = [
    "import-run-support-summary",
    sanitizeFilenamePart(detail.sheetKind),
    sanitizeFilenamePart(detail.id),
  ]
    .filter(Boolean)
    .join("-");

  return {
    filename: `${filename || "import-run-support-summary"}.txt`,
    contentType: "text/plain; charset=utf-8",
    content: lines.join("\n"),
  };
}
