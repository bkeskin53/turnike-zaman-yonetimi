import { describe, expect, it } from "vitest";
import { buildEmployeeImportGuidedRemediationPlan } from "../employeeImportGuidedRemediation.service";
import { buildEmployeeImportIssueSummary } from "../employeeImportIssueTaxonomy.service";
import { buildEmployeeImportResultReadinessSummary } from "../employeeImportReadiness.service";

describe("employeeImportGuidedRemediation.service", () => {
  it("prioritizes issue review and correction pack for blocked dry-run results", () => {
    const readiness = buildEmployeeImportResultReadinessSummary({
      sheetKind: "FULL_DATA",
      actionableRowCount: 4,
      invalidRowCount: 2,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: [{ line: 4, code: "EMPLOYEE_NOT_FOUND", message: "missing employee" }],
        warnings: [],
      }),
      headerSummary: {
        receivedHeaders: ["employeeCode"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSummary: null,
    });

    const plan = buildEmployeeImportGuidedRemediationPlan({
      readinessSummary: readiness,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: [{ line: 4, code: "EMPLOYEE_NOT_FOUND", message: "missing employee" }],
        warnings: [],
      }),
      hasApplySummary: false,
      rejectedCount: 0,
      hasIssueDetails: true,
      hasPreviewRows: true,
      hasTechnicalDetails: true,
      hasRunRef: true,
      canReadHistory: true,
      canApply: true,
      applyEnabled: false,
    });

    expect(plan?.headline).toContain("duzeltmeleri");
    expect(plan?.actions.map((item) => item.key)).toEqual([
      "OPEN_ISSUES",
      "DOWNLOAD_CORRECTION_PACK",
      "OPEN_TECHNICAL",
    ]);
  });

  it("offers review-first guidance for warning-only readiness", () => {
    const issueSummary = buildEmployeeImportIssueSummary({
      errors: [],
      warnings: [{ line: 2, code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED", message: "duplicate" }],
    });
    const readiness = buildEmployeeImportResultReadinessSummary({
      sheetKind: "PERSONAL_DATA",
      actionableRowCount: 10,
      invalidRowCount: 0,
      issueSummary,
      headerSummary: {
        receivedHeaders: ["employeeCode", "scopeStartDate"],
        missingRequiredHeaders: [],
        unknownHeaders: [],
        duplicateHeaders: [],
        emptyHeaderIndexes: [],
      },
      codeResolutionSummary: null,
    });

    const plan = buildEmployeeImportGuidedRemediationPlan({
      readinessSummary: readiness,
      issueSummary,
      hasApplySummary: false,
      rejectedCount: 0,
      hasIssueDetails: true,
      hasPreviewRows: true,
      hasTechnicalDetails: false,
      hasRunRef: true,
      canReadHistory: true,
      canApply: true,
      applyEnabled: true,
    });

    expect(plan?.actions.map((item) => item.key)).toEqual([
      "OPEN_ISSUES",
      "OPEN_PREVIEW",
      "APPLY_NOW",
    ]);
  });

  it("returns null for clean apply results and follow-up plan for partial apply", () => {
    const cleanPlan = buildEmployeeImportGuidedRemediationPlan({
      readinessSummary: null,
      issueSummary: buildEmployeeImportIssueSummary({ errors: [], warnings: [] }),
      hasApplySummary: true,
      rejectedCount: 0,
      hasIssueDetails: false,
      hasPreviewRows: false,
      hasTechnicalDetails: false,
      hasRunRef: true,
      canReadHistory: true,
      canApply: true,
      applyEnabled: false,
    });

    expect(cleanPlan).toBeNull();

    const partialPlan = buildEmployeeImportGuidedRemediationPlan({
      readinessSummary: null,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: [{ line: 6, code: "CARD_NO_TAKEN", message: "card taken" }],
        warnings: [],
      }),
      hasApplySummary: true,
      rejectedCount: 2,
      hasIssueDetails: true,
      hasPreviewRows: false,
      hasTechnicalDetails: false,
      hasRunRef: true,
      canReadHistory: true,
      canApply: true,
      applyEnabled: false,
    });

    expect(partialPlan?.actions.map((item) => item.key)).toEqual([
      "DOWNLOAD_CORRECTION_PACK",
      "OPEN_ISSUES",
      "OPEN_RUN_DETAIL",
    ]);
  });
});
