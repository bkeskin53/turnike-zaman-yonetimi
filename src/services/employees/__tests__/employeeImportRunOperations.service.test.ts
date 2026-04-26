import { describe, expect, it } from "vitest";
import { planEmployeeImportOperationalRecovery } from "../employeeImportRunOperations.service";

const NOW = new Date("2026-04-08T12:00:00.000Z");
const STALE_THRESHOLD = new Date("2026-04-08T11:30:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

describe("employeeImportRunOperations.service", () => {
  it("plans stale lock and stale run recovery when only stale state exists", () => {
    const plan = planEmployeeImportOperationalRecovery({
      existingLock: {
        id: "lock_1",
        actorUserId: "user_lock",
        acquiredAt: minutesAgo(45),
      },
      runningApplyRuns: [
        {
          id: "run_apply_stale",
          actorUserId: "user_apply",
          startedAt: minutesAgo(40),
        },
      ],
      runningDryRuns: [
        {
          id: "run_dry_stale",
          actorUserId: "user_dry",
          startedAt: minutesAgo(35),
        },
      ],
      staleThresholdDate: STALE_THRESHOLD,
    });

    expect(plan.blockReason).toBeNull();
    expect(plan.staleLockId).toBe("lock_1");
    expect(plan.staleApplyRunIds).toEqual(["run_apply_stale"]);
    expect(plan.staleDryRunIds).toEqual(["run_dry_stale"]);
  });

  it("blocks recovery when a fresh apply lock is still active", () => {
    const plan = planEmployeeImportOperationalRecovery({
      existingLock: {
        id: "lock_active",
        actorUserId: "user_lock",
        acquiredAt: minutesAgo(5),
      },
      runningApplyRuns: [],
      runningDryRuns: [],
      staleThresholdDate: STALE_THRESHOLD,
    });

    expect(plan.blockReason).toBe("ACTIVE_LOCK");
    expect(plan.staleLockId).toBeNull();
  });

  it("blocks recovery when a fresh running apply exists without a lock", () => {
    const plan = planEmployeeImportOperationalRecovery({
      existingLock: null,
      runningApplyRuns: [
        {
          id: "run_apply_fresh",
          actorUserId: "user_apply",
          startedAt: minutesAgo(8),
        },
      ],
      runningDryRuns: [],
      staleThresholdDate: STALE_THRESHOLD,
    });

    expect(plan.blockReason).toBe("RUNNING_APPLY_WITHOUT_LOCK");
    expect(plan.activeApplyRunIds).toEqual(["run_apply_fresh"]);
  });

  it("blocks recovery when a stale lock coexists with a fresh running apply", () => {
    const plan = planEmployeeImportOperationalRecovery({
      existingLock: {
        id: "lock_stale",
        actorUserId: "user_lock",
        acquiredAt: minutesAgo(45),
      },
      runningApplyRuns: [
        {
          id: "run_apply_fresh",
          actorUserId: "user_apply",
          startedAt: minutesAgo(4),
        },
      ],
      runningDryRuns: [],
      staleThresholdDate: STALE_THRESHOLD,
    });

    expect(plan.blockReason).toBe("FRESH_RUNNING_APPLY_PRESENT");
    expect(plan.staleLockId).toBeNull();
    expect(plan.activeApplyRunIds).toEqual(["run_apply_fresh"]);
  });
});
