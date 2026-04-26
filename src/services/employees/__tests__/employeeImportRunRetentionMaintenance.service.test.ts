import { describe, expect, it } from "vitest";
import {
  buildEmployeeImportRunRetentionMaintenanceBatchPlan,
  buildEmployeeImportRunRetentionMaintenanceSummary,
  hasEmployeeImportRunPreviewPayload,
  hasEmployeeImportRunSnapshotPayload,
} from "../employeeImportRunRetentionMaintenance.service";

describe("employeeImportRunRetentionMaintenance.service", () => {
  it("detects preview and snapshot payload presence safely", () => {
    expect(
      hasEmployeeImportRunPreviewPayload({
        changedEmployeeCodesPreview: [],
        warningsPreview: null,
        errorsPreview: null,
      }),
    ).toBe(false);

    expect(
      hasEmployeeImportRunPreviewPayload({
        changedEmployeeCodesPreview: ["EM***01"],
        warningsPreview: null,
        errorsPreview: null,
      }),
    ).toBe(true);

    expect(
      hasEmployeeImportRunSnapshotPayload({
        headerSummarySnapshot: null,
        codeResolutionSnapshot: null,
        applySummarySnapshot: null,
      }),
    ).toBe(false);

    expect(
      hasEmployeeImportRunSnapshotPayload({
        headerSummarySnapshot: { missing: [] },
        codeResolutionSnapshot: null,
        applySummarySnapshot: null,
      }),
    ).toBe(true);
  });

  it("builds a bounded maintenance batch plan from aged runs", () => {
    const previewThresholdDate = new Date("2026-01-08T00:00:00.000Z");
    const snapshotThresholdDate = new Date("2025-10-10T00:00:00.000Z");

    const plan = buildEmployeeImportRunRetentionMaintenanceBatchPlan({
      previewThresholdDate,
      snapshotThresholdDate,
      runs: [
        {
          id: "run_preview",
          finishedAt: new Date("2025-12-01T00:00:00.000Z"),
          changedEmployeeCodesPreview: ["EM***01"],
          warningsPreview: null,
          errorsPreview: null,
          headerSummarySnapshot: null,
          codeResolutionSnapshot: null,
          applySummarySnapshot: null,
        },
        {
          id: "run_snapshot",
          finishedAt: new Date("2025-09-01T00:00:00.000Z"),
          changedEmployeeCodesPreview: [],
          warningsPreview: null,
          errorsPreview: null,
          headerSummarySnapshot: { ok: true },
          codeResolutionSnapshot: null,
          applySummarySnapshot: null,
        },
        {
          id: "run_clean",
          finishedAt: new Date("2025-12-01T00:00:00.000Z"),
          changedEmployeeCodesPreview: [],
          warningsPreview: null,
          errorsPreview: null,
          headerSummarySnapshot: null,
          codeResolutionSnapshot: null,
          applySummarySnapshot: null,
        },
      ],
    });

    expect(plan.previewRunIds).toEqual(["run_preview"]);
    expect(plan.snapshotRunIds).toEqual(["run_snapshot"]);
  });

  it("summarizes aged payload candidates with distinct counts", () => {
    const previewThresholdDate = new Date("2026-01-08T00:00:00.000Z");
    const snapshotThresholdDate = new Date("2025-10-10T00:00:00.000Z");

    const summary = buildEmployeeImportRunRetentionMaintenanceSummary({
      generatedAt: new Date("2026-04-08T00:00:00.000Z"),
      previewThresholdDate,
      snapshotThresholdDate,
      runs: [
        {
          id: "run_both",
          finishedAt: new Date("2025-09-01T00:00:00.000Z"),
          changedEmployeeCodesPreview: ["EM***01"],
          warningsPreview: null,
          errorsPreview: null,
          headerSummarySnapshot: { ok: true },
          codeResolutionSnapshot: null,
          applySummarySnapshot: null,
        },
        {
          id: "run_preview_only",
          finishedAt: new Date("2025-12-01T00:00:00.000Z"),
          changedEmployeeCodesPreview: [],
          warningsPreview: [{ code: "WARN" }],
          errorsPreview: null,
          headerSummarySnapshot: null,
          codeResolutionSnapshot: null,
          applySummarySnapshot: null,
        },
      ],
    });

    expect(summary.counts.previewPayloadCandidates).toBe(2);
    expect(summary.counts.snapshotPayloadCandidates).toBe(1);
    expect(summary.counts.distinctCandidateRuns).toBe(2);
    expect(summary.oldestPreviewFinishedAt?.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(summary.oldestSnapshotFinishedAt?.toISOString()).toBe("2025-09-01T00:00:00.000Z");
  });
});
