import { describe, expect, it } from "vitest";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { buildEmployeeEmploymentLifecycleMutationPlan } from "../employeeEmploymentLifecycleMutation.service";

function period(args: {
  id: string;
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
}) {
  return {
    id: args.id,
    startDate: dbDateFromDayKey(args.startDate),
    endDate: args.endDate ? dbDateFromDayKey(args.endDate) : null,
    reason: args.reason ?? null,
  };
}

describe("buildEmployeeEmploymentLifecycleMutationPlan", () => {
  it("creates the first employment period for HIRE when no history exists", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "HIRE",
      effectiveDayKey: "2026-04-01",
      periods: [],
    });

    expect(plan).toEqual({
      kind: "CREATE_PERIOD",
      action: "HIRE",
      effectiveDayKey: "2026-04-01",
    });
  });

  it("returns NO_OP when HIRE is repeated for the same initial open period", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "HIRE",
      effectiveDayKey: "2026-04-01",
      periods: [
        period({
          id: "emp_1",
          startDate: "2026-04-01",
          endDate: null,
        }),
      ],
    });

    expect(plan).toEqual({
      kind: "NO_OP",
      action: "HIRE",
      effectiveDayKey: "2026-04-01",
      periodId: "emp_1",
    });
  });

  it("closes the current open period for TERMINATE", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "TERMINATE",
      effectiveDayKey: "2026-04-10",
      periods: [
        period({
          id: "emp_1",
          startDate: "2026-04-01",
          endDate: null,
        }),
      ],
    });

    expect(plan).toEqual({
      kind: "CLOSE_OPEN_PERIOD",
      action: "TERMINATE",
      effectiveDayKey: "2026-04-10",
      openPeriod: {
        id: "emp_1",
        startDayKey: "2026-04-01",
        endDayKey: null,
        reason: null,
      },
    });
  });

  it("returns NO_OP when TERMINATE is repeated for the same closed latest period", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "TERMINATE",
      effectiveDayKey: "2026-04-10",
      periods: [
        period({
          id: "emp_1",
          startDate: "2026-04-01",
          endDate: "2026-04-10",
        }),
      ],
    });

    expect(plan).toEqual({
      kind: "NO_OP",
      action: "TERMINATE",
      effectiveDayKey: "2026-04-10",
      periodId: "emp_1",
    });
  });

  it("creates a new open period for REHIRE after a closed history", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "REHIRE",
      effectiveDayKey: "2026-04-20",
      periods: [
        period({
          id: "emp_1",
          startDate: "2026-04-01",
          endDate: "2026-04-10",
        }),
      ],
    });

    expect(plan).toEqual({
      kind: "CREATE_PERIOD",
      action: "REHIRE",
      effectiveDayKey: "2026-04-20",
    });
  });

  it("rejects REHIRE when a future period would overlap the new open interval", () => {
    const plan = buildEmployeeEmploymentLifecycleMutationPlan({
      action: "REHIRE",
      effectiveDayKey: "2026-04-20",
      periods: [
        period({
          id: "emp_1",
          startDate: "2026-04-25",
          endDate: "2026-04-30",
        }),
      ],
    });

    expect(plan).toEqual({
      kind: "REJECTED",
      action: "REHIRE",
      effectiveDayKey: "2026-04-20",
      code: "EMPLOYMENT_OVERLAP",
      message:
        "REHIRE tarihi mevcut ya da ileri tarihli istihdam donemleriyle cakisiyor. Overlap olusmadan duzeltme gerekir.",
      meta: {
        overlapPeriodId: "emp_1",
        overlapPeriodStartDayKey: "2026-04-25",
        overlapPeriodEndDayKey: "2026-04-30",
      },
    });
  });
});
