import { describe, expect, it } from "vitest";
import { buildEmployeeImportRunSupportSummaryExport } from "../employeeImportRunSupportExport.service";
import { buildEmployeeImportIssuePreviewSummary } from "../employeeImportIssueTaxonomy.service";
import type { EmployeeImportRunDetailDto } from "../employeeImportRunQuery.service";

function buildDetail(): EmployeeImportRunDetailDto {
  return {
    id: "run_123",
    companyId: "company_1",
    mode: "APPLY",
    sheetKind: "FULL_DATA",
    sheetTitle: "Tam Toplu Aktarım",
    status: "COMPLETED",
    outcome: "PARTIAL",
    contentHash: "hash_123",
    actor: {
      userId: "user_1",
      email: "op***@company.com",
      role: "HR_OPERATOR",
      isActive: true,
    },
    requestedCount: 25,
    processedCount: 24,
    foundCount: 20,
    changedCount: 12,
    unchangedCount: 8,
    rejectedCount: 4,
    warningCount: 3,
    errorCount: 1,
    failedCode: null,
    failedMessage: null,
    startedAt: new Date("2026-04-08T09:00:00.000Z"),
    finishedAt: new Date("2026-04-08T09:02:00.000Z"),
    duplicateOf: {
      id: "run_ref",
      mode: "APPLY",
      sheetKind: "FULL_DATA",
      sheetTitle: "Tam Toplu Aktarım",
      status: "COMPLETED",
      outcome: "CLEAN",
      startedAt: new Date("2026-04-07T09:00:00.000Z"),
      finishedAt: new Date("2026-04-07T09:01:00.000Z"),
    },
    duplicateRunsPreview: [
      {
        id: "run_dup_1",
        mode: "APPLY",
        sheetKind: "FULL_DATA",
        sheetTitle: "Tam Toplu Aktarım",
        status: "COMPLETED",
        outcome: "WARNING",
        startedAt: new Date("2026-04-08T10:00:00.000Z"),
        finishedAt: new Date("2026-04-08T10:01:00.000Z"),
      },
    ],
    duplicateRunCount: 1,
    snapshots: {
      headerSummary: { missingRequiredHeaders: [] },
      codeResolution: { branch: { resolved: 10 } },
      applySummary: { changed: 12, rejected: 4 },
    },
    previews: {
      warnings: [
        {
          line: 4,
          employeeCode: "EM***01",
          code: "DUPLICATE_CONTENT",
          message: "Benzer içerik bulundu.",
          field: "employeeCode",
          value: "EM***01",
        },
      ],
      errors: [
        {
          line: 9,
          employeeCode: "EM***09",
          code: "INVALID_GROUP",
          message: "Grup bulunamadı.",
          field: "employeeGroupCode",
          value: "GR***09",
        },
      ],
      changedEmployeeCodes: ["EM***01", "EM***02"],
    },
    issueSummary: buildEmployeeImportIssuePreviewSummary({
      warnings: [
        {
          line: 4,
          employeeCode: "EM***01",
          code: "DUPLICATE_CONTENT",
          message: "Benzer iÃ§erik bulundu.",
          field: "employeeCode",
          value: "EM***01",
        },
      ],
      errors: [
        {
          line: 9,
          employeeCode: "EM***09",
          code: "INVALID_GROUP",
          message: "Grup bulunamadÄ±.",
          field: "employeeGroupCode",
          value: "GR***09",
        },
      ],
      totalWarningCount: 1,
      totalErrorCount: 1,
    }),
    readinessSummary: null,
    inspectionPolicy: {
      actorMasked: true,
      previewValuesMasked: true,
      previewRetentionDays: 90,
      snapshotRetentionDays: 180,
      issuePreviewLimit: 50,
      changedEmployeePreviewLimit: 100,
      previewsExpired: false,
      snapshotsExpired: false,
    },
  };
}

describe("employeeImportRunSupportExport.service", () => {
  it("builds a bounded support summary export from masked run detail data", () => {
    const exportFile = buildEmployeeImportRunSupportSummaryExport(buildDetail());

    expect(exportFile.filename).toBe("import-run-support-summary-full-data-run-123.txt");
    expect(exportFile.contentType).toBe("text/plain; charset=utf-8");
    expect(exportFile.content).toContain("Import Run Support Summary");
    expect(exportFile.content).toContain("Run ID: run_123");
    expect(exportFile.content).toContain("Calistiran: op***@company.com");
    expect(exportFile.content).toContain("EM***01");
    expect(exportFile.content).toContain("EM***09");
    expect(exportFile.content).toContain("## Uygulama Özeti");
    expect(exportFile.content).toContain('"changed": 12');
    expect(exportFile.content).toContain("Kullanıcı e-postası");
    expect(exportFile.content).not.toContain("EMP-001");
  });
});
