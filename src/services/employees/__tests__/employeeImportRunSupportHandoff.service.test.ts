import { describe, expect, it } from "vitest";
import { buildEmployeeImportRunSupportHandoffBundle } from "../employeeImportRunSupportHandoff.service";
import { buildEmployeeImportIssuePreviewSummary } from "../employeeImportIssueTaxonomy.service";
import { buildEmployeeImportResultReadinessSummary } from "../employeeImportReadiness.service";
import type { EmployeeImportRunDetailDto } from "../employeeImportRunQuery.service";

function buildDetail(): EmployeeImportRunDetailDto {
  const issueSummary = buildEmployeeImportIssuePreviewSummary({
    warnings: [
      {
        line: 4,
        employeeCode: "EM***01",
        code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
        message: "Benzer icerik bulundu.",
        field: "employeeCode",
        value: "EM***01",
      },
    ],
    errors: [
      {
        line: 9,
        employeeCode: "EM***09",
        code: "EMPLOYEE_NOT_FOUND",
        message: "Calisan bulunamadi.",
        field: "employeeCode",
        value: "EM***09",
      },
    ],
    totalWarningCount: 1,
    totalErrorCount: 1,
  });

  return {
    id: "run_guide_1",
    companyId: "company_1",
    mode: "DRY_RUN",
    sheetKind: "FULL_DATA",
    sheetTitle: "Tam Toplu Aktarim",
    status: "COMPLETED",
    outcome: "BLOCKING",
    contentHash: "hash_guide_1",
    actor: {
      userId: "user_1",
      email: "op***@company.com",
      role: "HR_OPERATOR",
      isActive: true,
    },
    requestedCount: 25,
    processedCount: 25,
    foundCount: 20,
    changedCount: 0,
    unchangedCount: 0,
    rejectedCount: 5,
    warningCount: 1,
    errorCount: 1,
    failedCode: null,
    failedMessage: null,
    startedAt: new Date("2026-04-08T09:00:00.000Z"),
    finishedAt: new Date("2026-04-08T09:02:00.000Z"),
    duplicateOf: null,
    duplicateRunsPreview: [],
    duplicateRunCount: 0,
    snapshots: {
      headerSummary: {
        receivedHeaders: ["employeeCode", "scopeStartDate"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolution: { branch: { provided: 10, resolved: 8, missing: 2, inactive: 0, mismatchedGroup: 0 } },
      applySummary: null,
    },
    previews: {
      warnings: [
        {
          line: 4,
          employeeCode: "EM***01",
          code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
          message: "Benzer icerik bulundu.",
          field: "employeeCode",
          value: "EM***01",
        },
      ],
      errors: [
        {
          line: 9,
          employeeCode: "EM***09",
          code: "EMPLOYEE_NOT_FOUND",
          message: "Calisan bulunamadi.",
          field: "employeeCode",
          value: "EM***09",
        },
      ],
      changedEmployeeCodes: [],
    },
    issueSummary,
    readinessSummary: buildEmployeeImportResultReadinessSummary({
      sheetKind: "FULL_DATA",
      actionableRowCount: 20,
      invalidRowCount: 5,
      issueSummary,
      headerSummary: {
        receivedHeaders: ["employeeCode", "scopeStartDate"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSummary: {
        branch: { provided: 10, resolved: 8, missing: 2, inactive: 0, mismatchedGroup: 0 },
        employeeGroup: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
        employeeSubgroup: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
        workSchedulePattern: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
      },
    }),
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

describe("employeeImportRunSupportHandoff.service", () => {
  it("builds a bounded support handoff bundle with support and remediation sections", () => {
    const exportFile = buildEmployeeImportRunSupportHandoffBundle(buildDetail());

    expect(exportFile.filename).toBe("import-run-support-handoff-full-data-run-guide-1.txt");
    expect(exportFile.contentType).toBe("text/plain; charset=utf-8");
    expect(exportFile.content).toContain("Import Run Support Handoff Bundle");
    expect(exportFile.content).toContain("Import Run Support Summary");
    expect(exportFile.content).toContain("## Gruplanmis Issue Ozeti");
    expect(exportFile.content).toContain("## Hazirlik Ozeti");
    expect(exportFile.content).toContain("## Onerilen Sonraki Adimlar");
    expect(exportFile.content).toContain("Duzeltme paketini indir");
    expect(exportFile.content).toContain("EM***09");
    expect(exportFile.content).not.toContain("EMP-009");
  });
});
