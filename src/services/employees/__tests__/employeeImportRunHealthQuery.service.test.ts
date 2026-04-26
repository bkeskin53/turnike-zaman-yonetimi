import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEmployeeImportRunHealthSummary } from "../employeeImportRunHealthQuery.service";

const NOW = new Date("2026-04-08T12:00:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function makeLock(args: { id: string; sheetKind: string; actorUserId?: string; acquiredAt: Date }) {
  return {
    id: args.id,
    sheetKind: args.sheetKind,
    actorUserId: args.actorUserId ?? "user_lock",
    acquiredAt: args.acquiredAt,
  };
}

function makeRun(args: {
  id: string;
  sheetKind: string;
  mode: EmployeeImportRunMode;
  status: EmployeeImportRunStatus;
  startedAt: Date;
  finishedAt?: Date | null;
  outcome?: EmployeeImportRunOutcome | null;
  duplicateOfRunId?: string | null;
  failedCode?: string | null;
  failedMessage?: string | null;
  actorUserId?: string;
  sheetTitle?: string;
}) {
  return {
    id: args.id,
    sheetKind: args.sheetKind,
    sheetTitle: args.sheetTitle ?? args.sheetKind,
    actorUserId: args.actorUserId ?? "user_run",
    mode: args.mode,
    status: args.status,
    outcome: args.outcome ?? null,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt ?? null,
    duplicateOfRunId: args.duplicateOfRunId ?? null,
    failedCode: args.failedCode ?? null,
    failedMessage: args.failedMessage ?? null,
  };
}

describe("employeeImportRunHealthQuery.service", () => {
  it("returns a clean summary when there are no health issues", () => {
    const summary = buildEmployeeImportRunHealthSummary({
      locks: [],
      runs: [],
      now: NOW,
    });

    expect(summary.issues).toEqual([]);
    expect(summary.counts).toEqual({
      activeApplyLocks: 0,
      runningApplyRuns: 0,
      runningDryRuns: 0,
      staleApplyLocks: 0,
      orphanApplyLocks: 0,
      staleRunningApplyRuns: 0,
      staleRunningDryRuns: 0,
      recentFailedRuns: 0,
      recentDuplicateRuns: 0,
    });
  });

  it("detects stale locks, orphan locks and stale running runs", () => {
    const summary = buildEmployeeImportRunHealthSummary({
      locks: [makeLock({ id: "lock_1", sheetKind: "FULL_DATA", acquiredAt: minutesAgo(45) })],
      runs: [
        makeRun({
          id: "run_apply_stale",
          sheetKind: "ORG_DATA",
          mode: EmployeeImportRunMode.APPLY,
          status: EmployeeImportRunStatus.RUNNING,
          startedAt: minutesAgo(50),
        }),
        makeRun({
          id: "run_dry_stale",
          sheetKind: "PERSONAL_DATA",
          mode: EmployeeImportRunMode.DRY_RUN,
          status: EmployeeImportRunStatus.RUNNING,
          startedAt: minutesAgo(55),
        }),
      ],
      now: NOW,
    });

    expect(summary.counts.staleApplyLocks).toBe(1);
    expect(summary.counts.orphanApplyLocks).toBe(1);
    expect(summary.counts.staleRunningApplyRuns).toBe(1);
    expect(summary.counts.staleRunningDryRuns).toBe(1);
    expect(summary.issues.map((item) => item.code)).toEqual([
      "STALE_APPLY_LOCK",
      "ORPHAN_APPLY_LOCK",
      "STALE_RUNNING_APPLY_RUN",
      "STALE_RUNNING_DRY_RUN",
    ]);
    expect(summary.issues[0]?.references[0]?.recoveryAction).toBe("NORMALIZE_STALE_SHEET_STATE");
    expect(summary.issues[2]?.references[0]?.recoverySheetKind).toBe("ORG_DATA");
  });

  it("does not mark a stale lock as orphan when a matching running apply exists", () => {
    const summary = buildEmployeeImportRunHealthSummary({
      locks: [makeLock({ id: "lock_1", sheetKind: "WORK_DATA", acquiredAt: minutesAgo(40) })],
      runs: [
        makeRun({
          id: "run_apply_stale",
          sheetKind: "WORK_DATA",
          mode: EmployeeImportRunMode.APPLY,
          status: EmployeeImportRunStatus.RUNNING,
          startedAt: minutesAgo(42),
        }),
      ],
      now: NOW,
    });

    expect(summary.counts.staleApplyLocks).toBe(1);
    expect(summary.counts.orphanApplyLocks).toBe(0);
  });

  it("tracks recent failed and duplicate-content patterns within bounded windows", () => {
    const summary = buildEmployeeImportRunHealthSummary({
      locks: [],
      runs: [
        makeRun({
          id: "run_failed_recent",
          sheetKind: "FULL_DATA",
          mode: EmployeeImportRunMode.APPLY,
          status: EmployeeImportRunStatus.FAILED,
          startedAt: daysAgo(3),
          finishedAt: daysAgo(2),
          outcome: EmployeeImportRunOutcome.BLOCKING,
          failedCode: "IMPORT_FAILED",
        }),
        makeRun({
          id: "run_failed_old",
          sheetKind: "ORG_DATA",
          mode: EmployeeImportRunMode.APPLY,
          status: EmployeeImportRunStatus.FAILED,
          startedAt: daysAgo(20),
          finishedAt: daysAgo(19),
          outcome: EmployeeImportRunOutcome.BLOCKING,
          failedCode: "IMPORT_FAILED",
        }),
        makeRun({
          id: "run_dup_recent",
          sheetKind: "PERSONAL_DATA",
          mode: EmployeeImportRunMode.DRY_RUN,
          status: EmployeeImportRunStatus.COMPLETED,
          startedAt: daysAgo(2),
          finishedAt: daysAgo(1),
          outcome: EmployeeImportRunOutcome.WARNING,
          duplicateOfRunId: "run_previous",
        }),
        makeRun({
          id: "run_dup_old",
          sheetKind: "WORK_DATA",
          mode: EmployeeImportRunMode.APPLY,
          status: EmployeeImportRunStatus.COMPLETED,
          startedAt: daysAgo(12),
          finishedAt: daysAgo(11),
          outcome: EmployeeImportRunOutcome.CLEAN,
          duplicateOfRunId: "run_previous_old",
        }),
      ],
      now: NOW,
    });

    expect(summary.counts.recentFailedRuns).toBe(1);
    expect(summary.counts.recentDuplicateRuns).toBe(1);
    expect(summary.issues.map((item) => item.code)).toEqual([
      "RECENT_FAILED_RUN",
      "RECENT_DUPLICATE_PATTERN",
    ]);
    expect(summary.issues[0]?.references[0]?.failedCode).toBe("IMPORT_FAILED");
    expect(summary.issues[1]?.references[0]?.duplicateOfRunId).toBe("run_previous");
  });
});
