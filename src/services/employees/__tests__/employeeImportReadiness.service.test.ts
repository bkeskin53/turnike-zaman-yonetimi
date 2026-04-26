import { describe, expect, it } from "vitest";
import { buildEmployeeImportIssuePreviewSummary, buildEmployeeImportIssueSummary } from "../employeeImportIssueTaxonomy.service";
import {
  buildEmployeeImportResultReadinessSummary,
  buildEmployeeImportRunReadinessSummary,
} from "../employeeImportReadiness.service";

describe("employeeImportReadiness.service", () => {
  it("marks import results as blocked when validation errors remain", () => {
    const summary = buildEmployeeImportResultReadinessSummary({
      sheetKind: "FULL_DATA",
      actionableRowCount: 4,
      invalidRowCount: 3,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: [
          { line: 1, code: "MISSING_REQUIRED_HEADERS", message: "missing" },
          { line: 8, code: "EMPLOYEE_GROUP_CODE_NOT_FOUND", message: "group", field: "employeeGroupCode" as never },
        ],
        warnings: [],
      }),
      headerSummary: {
        receivedHeaders: ["employeeCode", "employeeGroupCode"],
        missingRequiredHeaders: ["scopeStartDate"],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSummary: {
        branch: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
        employeeGroup: { provided: 1, resolved: 0, missing: 1, inactive: 0, mismatchedGroup: 0 },
        employeeSubgroup: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
        workSchedulePattern: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
      },
    });

    expect(summary.status).toBe("BLOCKED");
    expect(summary.headline).toContain("hazir degil");
    expect(summary.checks.find((check) => check.key === "HEADER_CONTRACT")?.status).toBe("BLOCKED");
    expect(summary.checks.find((check) => check.key === "CODE_RESOLUTION")?.status).toBe("BLOCKED");
  });

  it("marks clean dry-run results with warnings as review", () => {
    const summary = buildEmployeeImportResultReadinessSummary({
      sheetKind: "PERSONAL_DATA",
      actionableRowCount: 12,
      invalidRowCount: 0,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: [],
        warnings: [
          { line: 2, code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED", message: "duplicate" },
        ],
      }),
      headerSummary: {
        receivedHeaders: ["employeeCode", "scopeStartDate", "firstName"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSummary: null,
    });

    expect(summary.status).toBe("REVIEW");
    expect(summary.checks.find((check) => check.key === "OPERATIONAL_SIGNALS")?.status).toBe("REVIEW");
    expect(summary.checks.find((check) => check.key === "ACTIONABLE_ROWS")?.status).toBe("OK");
  });

  it("derives run detail readiness only for dry-run runs", () => {
    const previewSummary = buildEmployeeImportIssuePreviewSummary({
      warnings: [],
      errors: [
        {
          line: 8,
          code: "EMPLOYEE_NOT_FOUND",
          message: "employee",
          employeeCode: "EM***08",
        },
      ],
      totalErrorCount: 4,
      totalWarningCount: 0,
    });

    const detailSummary = buildEmployeeImportRunReadinessSummary({
      mode: "DRY_RUN",
      sheetKind: "FULL_DATA",
      requestedCount: 10,
      processedCount: 6,
      rejectedCount: 4,
      issueSummary: previewSummary,
      headerSummarySnapshot: {
        receivedHeaders: ["employeeCode", "scopeStartDate"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSnapshot: {
        branch: { provided: 3, resolved: 3, missing: 0, inactive: 0, mismatchedGroup: 0 },
        employeeGroup: { provided: 2, resolved: 2, missing: 0, inactive: 0, mismatchedGroup: 0 },
        employeeSubgroup: { provided: 2, resolved: 1, missing: 0, inactive: 0, mismatchedGroup: 1 },
        workSchedulePattern: { provided: 0, resolved: 0, missing: 0, inactive: 0, mismatchedGroup: 0 },
      },
    });

    expect(detailSummary?.status).toBe("BLOCKED");
    expect(detailSummary?.previewLimited).toBe(true);
    expect(detailSummary?.checks.find((check) => check.key === "ACTIONABLE_ROWS")?.status).toBe("REVIEW");
    expect(buildEmployeeImportRunReadinessSummary({
      mode: "APPLY",
      sheetKind: "FULL_DATA",
      requestedCount: 10,
      processedCount: 10,
      rejectedCount: 0,
      issueSummary: previewSummary,
      headerSummarySnapshot: null,
      codeResolutionSnapshot: null,
    })).toBeNull();
  });
});
