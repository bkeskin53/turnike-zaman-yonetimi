import { describe, expect, it } from "vitest";
import {
  buildEmployeeImportIssuePreviewSummary,
  buildEmployeeImportIssueSummary,
} from "../employeeImportIssueTaxonomy.service";

describe("employeeImportIssueTaxonomy.service", () => {
  it("groups current validation and apply issues by existing taxonomy buckets", () => {
    const summary = buildEmployeeImportIssueSummary({
      errors: [
        { line: 1, code: "MISSING_REQUIRED_HEADERS", message: "missing" },
        { line: 3, code: "MISSING_SCOPESTARTDATE", message: "missing", field: "scopeStartDate" as never },
        { line: 4, code: "EMPLOYEE_NOT_FOUND", message: "missing employee", employeeCode: "EMP-001" },
        { line: 5, code: "CARD_NO_TAKEN", message: "card taken", employeeCode: "EMP-002", field: "cardNo" as never },
        { line: 6, code: "WORK_SCHEDULE_PATTERN_CODE_NOT_FOUND", message: "pattern", field: "workSchedulePatternCode" as never },
      ],
      warnings: [
        { line: 8, code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED", message: "duplicate" },
        { line: 9, code: "NO_WORK_CODES_TO_RESOLVE", message: "no work" },
      ],
    });

    expect(summary.source).toBe("FULL");
    expect(summary.totalErrorCount).toBe(5);
    expect(summary.previewLimited).toBe(false);
    expect(summary.errorGroups.map((group) => group.key)).toEqual(
      expect.arrayContaining([
        "HEADER_AND_LAYOUT",
        "REQUIRED_FIELDS",
        "EMPLOYEE_MATCHING",
        "CARD_AND_IDENTITY",
        "WORK_REFERENCES",
      ]),
    );
    expect(summary.warningGroups.map((group) => group.key)).toEqual(
      expect.arrayContaining(["DUPLICATE_INPUT", "WORK_REFERENCES"]),
    );
  });

  it("uses field fallback mapping for profile, org and date issues", () => {
    const summary = buildEmployeeImportIssueSummary({
      errors: [
        { line: 3, code: "UNKNOWN_ERROR_A", message: "profile", field: "email" as never },
        { line: 4, code: "UNKNOWN_ERROR_B", message: "org", field: "branchCode" as never },
        { line: 5, code: "UNKNOWN_ERROR_C", message: "date", field: "scopeEndDate" as never },
      ],
      warnings: [],
    });

    expect(summary.errorGroups.find((group) => group.key === "PROFILE_VALUES")?.issueCount).toBe(1);
    expect(summary.errorGroups.find((group) => group.key === "ORG_REFERENCES")?.issueCount).toBe(1);
    expect(summary.errorGroups.find((group) => group.key === "DATE_AND_SCOPE")?.issueCount).toBe(1);
  });

  it("marks preview summaries as limited when total counts exceed stored previews", () => {
    const summary = buildEmployeeImportIssuePreviewSummary({
      errors: [{ line: 4, code: "EMPLOYEE_NOT_FOUND", message: "missing employee", employeeCode: "EM***01" }],
      warnings: [{ line: 6, code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED", message: "duplicate" }],
      totalErrorCount: 4,
      totalWarningCount: 1,
    });

    expect(summary.source).toBe("PREVIEW");
    expect(summary.previewLimited).toBe(true);
    expect(summary.errorPreviewLimited).toBe(true);
    expect(summary.warningPreviewLimited).toBe(false);
    expect(summary.availableErrorCount).toBe(1);
    expect(summary.totalErrorCount).toBe(4);
    expect(summary.errorGroups[0]?.previewLimited).toBe(true);
  });
});
