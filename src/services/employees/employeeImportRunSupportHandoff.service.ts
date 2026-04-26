import {
  buildEmployeeImportGuidedRemediationPlan,
  type EmployeeImportGuidedRemediationPlanDto,
} from "@/src/services/employees/employeeImportGuidedRemediation.service";
import type {
  EmployeeImportIssueGroupSummaryDto,
  EmployeeImportIssueSummaryDto,
} from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import type { EmployeeImportReadinessSummaryDto } from "@/src/services/employees/employeeImportReadiness.service";
import {
  buildEmployeeImportRunSupportSummaryExport,
  type EmployeeImportRunSupportSummaryExport,
} from "@/src/services/employees/employeeImportRunSupportExport.service";
import type { EmployeeImportRunDetailDto } from "@/src/services/employees/employeeImportRunQuery.service";

export type EmployeeImportRunSupportHandoffBundle = EmployeeImportRunSupportSummaryExport;

function sanitizeFilenamePart(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatReadinessStatusLabel(status: EmployeeImportReadinessSummaryDto["status"]) {
  if (status === "READY") return "Hazir";
  if (status === "REVIEW") return "Gozden gecir";
  return "Bloklayan";
}

function formatCheckStatusLabel(status: EmployeeImportReadinessSummaryDto["checks"][number]["status"]) {
  if (status === "OK") return "Temiz";
  if (status === "REVIEW") return "Gozden gecir";
  return "Bloklayan";
}

function formatIssueGroupLines(title: string, groups: EmployeeImportIssueGroupSummaryDto[]) {
  const lines = [`### ${title}`];
  if (!groups.length) {
    lines.push("- Kayitli issue grubu yok.");
    return lines;
  }

  for (const group of groups) {
    const codeSummary = group.codeBreakdown.slice(0, 3).map((item) => `${item.code} (${item.count})`).join(", ");
    const fieldSummary = group.fields.slice(0, 3).join(", ");
    const sampleLines = group.sampleLines.slice(0, 4).map((line) => `#${line}`).join(", ");
    lines.push(
      [
        `- ${group.title}: ${group.issueCount} issue / ${group.lineCount} satir`,
        group.previewLimited ? "preview siniri var" : null,
        codeSummary ? `Kodlar: ${codeSummary}` : null,
        fieldSummary ? `Alanlar: ${fieldSummary}` : null,
        sampleLines ? `Ornek satirlar: ${sampleLines}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  return lines;
}

function formatIssueSummaryLines(summary: EmployeeImportIssueSummaryDto) {
  const lines = ["## Gruplanmis Issue Ozeti"];
  lines.push(`- Ozet kaynagi: ${summary.source === "FULL" ? "Tam issue ozeti" : "Preview bazli issue ozeti"}`);
  lines.push(`- Hata: ${summary.totalErrorCount}`);
  lines.push(`- Uyari: ${summary.totalWarningCount}`);
  lines.push(`- Preview siniri: ${summary.previewLimited ? "Var" : "Yok"}`);
  lines.push("");
  lines.push(...formatIssueGroupLines("Hata Kumeleri", summary.errorGroups));
  lines.push("");
  lines.push(...formatIssueGroupLines("Uyari Kumeleri", summary.warningGroups));
  return lines;
}

function formatReadinessLines(summary: EmployeeImportReadinessSummaryDto | null) {
  const lines = ["## Hazirlik Ozeti"];
  if (!summary) {
    lines.push("- Bu kosu icin kayitli dry-run hazirlik ozeti yok.");
    return lines;
  }

  lines.push(`- Durum: ${formatReadinessStatusLabel(summary.status)}`);
  lines.push(`- Baslik: ${summary.headline}`);
  lines.push(`- Aciklama: ${summary.supportText}`);
  lines.push(`- Uygulanabilir satir: ${summary.actionableRowCount}`);
  lines.push(`- Gecersiz satir: ${summary.invalidRowCount}`);
  lines.push(`- Preview siniri: ${summary.previewLimited ? "Var" : "Yok"}`);
  lines.push("");
  lines.push("### Kontroller");
  for (const check of summary.checks) {
    lines.push(`- ${check.title}: ${formatCheckStatusLabel(check.status)} | ${check.summary}`);
  }

  lines.push("");
  lines.push("### Ust Sorunlar");
  if (!summary.topConcerns.length) {
    lines.push("- Kayitli ust sorun yok.");
  } else {
    for (const concern of summary.topConcerns) {
      lines.push(
        [
          `- ${concern.title}: ${concern.issueCount} issue / ${concern.lineCount} satir`,
          concern.severity === "error" ? "Hata agirligi" : "Uyari agirligi",
          concern.previewLimited ? "preview siniri var" : null,
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
  }

  return lines;
}

function buildHandoffPlan(detail: EmployeeImportRunDetailDto): EmployeeImportGuidedRemediationPlanDto | null {
  return buildEmployeeImportGuidedRemediationPlan({
    readinessSummary: detail.readinessSummary,
    issueSummary: detail.issueSummary,
    hasApplySummary: detail.mode === "APPLY" || Boolean(detail.snapshots.applySummary),
    rejectedCount: detail.rejectedCount ?? 0,
    hasIssueDetails: detail.issueSummary.totalErrorCount > 0 || detail.issueSummary.totalWarningCount > 0,
    hasPreviewRows: false,
    hasTechnicalDetails:
      Boolean(detail.snapshots.headerSummary) ||
      Boolean(detail.snapshots.codeResolution) ||
      Boolean(detail.snapshots.applySummary),
    hasRunRef: true,
    canReadHistory: true,
    canApply: detail.mode === "DRY_RUN" && detail.status === "COMPLETED",
    applyEnabled: detail.mode === "DRY_RUN" && detail.status === "COMPLETED" && detail.outcome !== "BLOCKING",
  });
}

function formatPlanLines(plan: EmployeeImportGuidedRemediationPlanDto | null, detail: EmployeeImportRunDetailDto) {
  const lines = ["## Onerilen Sonraki Adimlar"];
  if (!plan) {
    lines.push(
      detail.rejectedCount && detail.rejectedCount > 0
        ? "- Bu kosu icin ek guided remediation plani uretilmedi. Gerekirse correction pack ve run detayini birlikte kullanin."
        : "- Bu kosu icin ek guided remediation adimi gerekmiyor.",
    );
    return lines;
  }

  lines.push(`- Baslik: ${plan.headline}`);
  lines.push(`- Aciklama: ${plan.supportText}`);
  if (plan.topConcernTitles.length) {
    lines.push(`- Ust sorunlar: ${plan.topConcernTitles.join(", ")}`);
  }
  lines.push("");
  lines.push("### Adimlar");
  for (const action of plan.actions) {
    lines.push(
      `- ${action.title} (${action.emphasis === "primary" ? "Oncelikli" : "Destekleyici"}): ${action.description}`,
    );
  }

  const hasCorrectionPack = detail.issueSummary.totalErrorCount > 0 || detail.issueSummary.totalWarningCount > 0;
  lines.push("");
  lines.push(`- Correction pack mevcut: ${hasCorrectionPack ? "Evet" : "Hayir"}`);
  lines.push("- Ham workbook veya otomatik duzeltilmis dosya bu pakete dahil edilmez.");
  return lines;
}

export function buildEmployeeImportRunSupportHandoffBundle(
  detail: EmployeeImportRunDetailDto,
): EmployeeImportRunSupportHandoffBundle {
  const supportSummary = buildEmployeeImportRunSupportSummaryExport(detail);
  const supportSummaryLines = supportSummary.content.split("\n");
  const plan = buildHandoffPlan(detail);
  const lines: string[] = [];

  lines.push("Import Run Support Handoff Bundle");
  lines.push("");
  lines.push("Bu paket bounded support ozeti ile remediation ozetini birlikte sunar.");
  lines.push("Ham workbook, tum satir dump'i veya auto-fix ciktisi icermez.");
  lines.push("");
  lines.push(...supportSummaryLines);
  lines.push("");
  lines.push(...formatIssueSummaryLines(detail.issueSummary));
  lines.push("");
  lines.push(...formatReadinessLines(detail.readinessSummary));
  lines.push("");
  lines.push(...formatPlanLines(plan, detail));
  lines.push("");

  const filename = [
    "import-run-support-handoff",
    sanitizeFilenamePart(detail.sheetKind),
    sanitizeFilenamePart(detail.id),
  ]
    .filter(Boolean)
    .join("-");

  return {
    filename: `${filename || "import-run-support-handoff"}.txt`,
    contentType: "text/plain; charset=utf-8",
    content: lines.join("\n"),
  };
}
