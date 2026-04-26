import { describe, expect, it } from "vitest";
import {
  buildEmployeeImportContentHash,
  buildEmployeeImportDuplicateWarning,
  deriveEmployeeImportRunOutcomeFromCompletedApply,
  deriveEmployeeImportRunOutcomeFromDryRun,
  planEmployeeImportApplyOperationalGuard,
} from "../employeeImportRun.service";

describe("employeeImportRun.service", () => {
  it("builds the same content hash for comma and tab versions of the same sheet payload", () => {
    const commaHash = buildEmployeeImportContentHash({
      sheetKind: "PERSONAL_DATA",
      csvText: [
        "employeeCode,cardNo,scopeStartDate,scopeEndDate,firstName,lastName",
        "E001,CARD-1,2026-04-01,,Ayse,Yilmaz",
      ].join("\n"),
    });

    const tabHash = buildEmployeeImportContentHash({
      sheetKind: "PERSONAL_DATA",
      csvText: [
        "employeeCode\tcardNo\tscopeStartDate\tscopeEndDate\tfirstName\tlastName",
        "E001\tCARD-1\t2026-04-01\t\tAyse\tYilmaz",
      ].join("\n"),
    });

    expect(commaHash).toBe(tabHash);
  });

  it("includes the previous run id in duplicate content warnings", () => {
    const warning = buildEmployeeImportDuplicateWarning({
      sheetKind: "WORK_DATA",
      duplicateRunId: "run_123",
    });

    expect(warning.code).toBe("DUPLICATE_CONTENT_PREVIOUSLY_APPLIED");
    expect(warning.message).toContain("WORK_DATA");
    expect(warning.message).toContain("run_123");
    expect(warning.value).toBe("run_123");
  });

  it("marks completed apply runs with rejects as PARTIAL outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromCompletedApply({
      summary: { rejected: 2 },
      warnings: [],
      errors: [
        {
          line: 3,
          code: "ROW_REJECTED",
          message: "row rejected",
        },
      ],
    });

    expect(outcome).toBe("PARTIAL");
  });

  it("marks completed apply runs with warnings and no rejects as WARNING outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromCompletedApply({
      summary: { rejected: 0 },
      warnings: [
        {
          line: 1,
          code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
          message: "warn",
        },
      ],
      errors: [],
    });

    expect(outcome).toBe("WARNING");
  });

  it("marks completed apply runs with no rejects or warnings as CLEAN outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromCompletedApply({
      summary: { rejected: 0 },
      warnings: [],
      errors: [],
    });

    expect(outcome).toBe("CLEAN");
  });

  it("marks dry-run results with validation errors as BLOCKING outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromDryRun({
      warnings: [],
      errors: [
        {
          line: 4,
          code: "SUBGROUP_MISMATCH",
          message: "blocking",
        },
      ],
    });

    expect(outcome).toBe("BLOCKING");
  });

  it("marks dry-run results with warnings and no errors as WARNING outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromDryRun({
      warnings: [
        {
          line: 1,
          code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
          message: "warn",
        },
      ],
      errors: [],
    });

    expect(outcome).toBe("WARNING");
  });

  it("marks dry-run results with no warnings or errors as CLEAN outcome", () => {
    const outcome = deriveEmployeeImportRunOutcomeFromDryRun({
      warnings: [],
      errors: [],
    });

    expect(outcome).toBe("CLEAN");
  });

  it("blocks when a fresh apply lock exists for the same sheet", () => {
    const threshold = new Date("2026-04-08T10:00:00.000Z");
    const plan = planEmployeeImportApplyOperationalGuard({
      existingLock: {
        id: "lock_1",
        actorUserId: "user_1",
        acquiredAt: new Date("2026-04-08T10:05:00.000Z"),
      },
      runningApplyRuns: [],
      staleThresholdDate: threshold,
    });

    expect(plan.blockReason).toBe("ACTIVE_LOCK");
    expect(plan.shouldDeleteStaleLock).toBe(false);
    expect(plan.staleRunningRunIds).toEqual([]);
    expect(plan.blockingLock?.id).toBe("lock_1");
  });

  it("recovers stale lock and stale running apply rows without blocking", () => {
    const threshold = new Date("2026-04-08T10:00:00.000Z");
    const plan = planEmployeeImportApplyOperationalGuard({
      existingLock: {
        id: "lock_old",
        actorUserId: "user_old",
        acquiredAt: new Date("2026-04-08T09:30:00.000Z"),
      },
      runningApplyRuns: [
        {
          id: "run_old",
          actorUserId: "user_old",
          startedAt: new Date("2026-04-08T09:20:00.000Z"),
        },
      ],
      staleThresholdDate: threshold,
    });

    expect(plan.blockReason).toBeNull();
    expect(plan.shouldDeleteStaleLock).toBe(true);
    expect(plan.staleRunningRunIds).toEqual(["run_old"]);
  });

  it("blocks when a fresh RUNNING apply run exists without a lock", () => {
    const threshold = new Date("2026-04-08T10:00:00.000Z");
    const plan = planEmployeeImportApplyOperationalGuard({
      existingLock: null,
      runningApplyRuns: [
        {
          id: "run_live",
          actorUserId: "user_live",
          startedAt: new Date("2026-04-08T10:15:00.000Z"),
        },
      ],
      staleThresholdDate: threshold,
    });

    expect(plan.blockReason).toBe("RUNNING_APPLY_WITHOUT_LOCK");
    expect(plan.blockingRunningRun?.id).toBe("run_live");
    expect(plan.shouldDeleteStaleLock).toBe(false);
  });

  it("allows a fresh acquire after only stale running runs are present", () => {
    const threshold = new Date("2026-04-08T10:00:00.000Z");
    const plan = planEmployeeImportApplyOperationalGuard({
      existingLock: null,
      runningApplyRuns: [
        {
          id: "run_stale",
          actorUserId: "user_stale",
          startedAt: new Date("2026-04-08T09:40:00.000Z"),
        },
      ],
      staleThresholdDate: threshold,
    });

    expect(plan.blockReason).toBeNull();
    expect(plan.staleRunningRunIds).toEqual(["run_stale"]);
    expect(plan.shouldDeleteStaleLock).toBe(false);
  });
});
