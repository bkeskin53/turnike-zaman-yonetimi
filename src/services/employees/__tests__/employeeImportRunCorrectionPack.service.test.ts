import { describe, expect, it } from "vitest";
import { buildEmployeeImportIssuePreviewSummary } from "../employeeImportIssueTaxonomy.service";
import { buildEmployeeImportRunCorrectionPackExport } from "../employeeImportRunCorrectionPack.service";
import type { EmployeeImportRunDetailDto } from "../employeeImportRunQuery.service";

function buildDetail(): EmployeeImportRunDetailDto {
  return {
    id: "run_456",
    companyId: "company_1",
    mode: "DRY_RUN",
    sheetKind: "FULL_DATA",
    sheetTitle: "Tam Toplu Aktarim",
    status: "COMPLETED",
    outcome: "BLOCKING",
    contentHash: "hash_456",
    actor: {
      userId: "user_1",
      email: "op***@company.com",
      role: "HR_OPERATOR",
      isActive: true,
    },
    requestedCount: 20,
    processedCount: 18,
    foundCount: 0,
    changedCount: 0,
    unchangedCount: 0,
    rejectedCount: 2,
    warningCount: 1,
    errorCount: 3,
    failedCode: null,
    failedMessage: null,
    startedAt: new Date("2026-04-08T09:00:00.000Z"),
    finishedAt: new Date("2026-04-08T09:01:00.000Z"),
    duplicateOf: null,
    duplicateRunsPreview: [],
    duplicateRunCount: 0,
    snapshots: {
      headerSummary: null,
      codeResolution: null,
      applySummary: null,
    },
    previews: {
      warnings: [
        {
          line: 3,
          employeeCode: "EM***03",
          code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
          message: "Benzer icerik daha once uygulanmis.",
          field: null,
          value: "run_123",
        },
      ],
      errors: [
        {
          line: 8,
          employeeCode: "EM***08",
          code: "EMPLOYEE_GROUP_CODE_NOT_FOUND",
          message: "Grup kodu bulunamadi.",
          field: "employeeGroupCode",
          value: "GR***01",
        },
        {
          line: 9,
          employeeCode: "EM***09",
          code: "CARD_NO_TAKEN",
          message: "Kart baskasi tarafindan kullaniliyor.",
          field: "cardNo",
          value: "@CA***09",
        },
      ],
      changedEmployeeCodes: [],
    },
    issueSummary: buildEmployeeImportIssuePreviewSummary({
      warnings: [
        {
          line: 3,
          employeeCode: "EM***03",
          code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
          message: "Benzer icerik daha once uygulanmis.",
          field: null,
          value: "run_123",
        },
      ],
      errors: [
        {
          line: 8,
          employeeCode: "EM***08",
          code: "EMPLOYEE_GROUP_CODE_NOT_FOUND",
          message: "Grup kodu bulunamadi.",
          field: "employeeGroupCode",
          value: "GR***01",
        },
        {
          line: 9,
          employeeCode: "EM***09",
          code: "CARD_NO_TAKEN",
          message: "Kart baskasi tarafindan kullaniliyor.",
          field: "cardNo",
          value: "@CA***09",
        },
      ],
      totalErrorCount: 5,
      totalWarningCount: 1,
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

describe("employeeImportRunCorrectionPack.service", () => {
  it("builds a bounded csv correction pack from masked issue previews", () => {
    const exportFile = buildEmployeeImportRunCorrectionPackExport(buildDetail());

    expect(exportFile.filename).toBe("import-correction-pack-full-data-run-456.csv");
    expect(exportFile.contentType).toBe("text/csv; charset=utf-8");
    expect(exportFile.content).toContain("Sekme");
    expect(exportFile.content).toContain("Tam Toplu Aktarım");
    expect(exportFile.content).toContain("EMPLOYEE_GROUP_CODE_NOT_FOUND");
    expect(exportFile.content).toContain("Organizasyon kodları");
    expect(exportFile.content).toContain("Kart ve kimlik çakışmaları");
    expect(exportFile.content).toContain("EVET");
    expect(exportFile.content).toContain("'@CA***09");
    expect(exportFile.content).not.toContain("EMP-009");
  });
});
