import { describe, expect, it } from "vitest";
import {
  buildAppendEmployeeWorkScheduleAssignmentPlan,
  buildEmployeeWorkScheduleAssignmentMutationPlan,
} from "../employeeWorkScheduleAssignmentMutation.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

function row(args: {
  id: string;
  validFrom: string | null;
  validTo?: string | null;
  patternId: string;
}) {
  return {
    id: args.id,
    validFrom: args.validFrom ? dbDateFromDayKey(args.validFrom) : null,
    validTo: args.validTo ? dbDateFromDayKey(args.validTo) : null,
    createdAt: dbDateFromDayKey("2026-04-01"),
    updatedAt: dbDateFromDayKey("2026-04-01"),
    patternId: args.patternId,
  };
}

describe("buildEmployeeWorkScheduleAssignmentMutationPlan", () => {
  it("returns NO_OP when the same pattern already covers the effective day", () => {
    const plan = buildEmployeeWorkScheduleAssignmentMutationPlan({
      rows: [
        row({
          id: "ws_1",
          validFrom: "2026-04-01",
          validTo: null,
          patternId: "pattern_norm",
        }),
      ],
      effectiveDayKey: "2026-04-10",
      patternId: "pattern_norm",
    });

    expect(plan).toEqual({
      kind: "NO_OP",
      assignmentId: "ws_1",
      createValidToDayKey: null,
    });
  });

  it("returns UPDATE_SAME_DAY when the active row starts on the same day", () => {
    const plan = buildEmployeeWorkScheduleAssignmentMutationPlan({
      rows: [
        row({
          id: "ws_1",
          validFrom: "2026-04-10",
          validTo: null,
          patternId: "pattern_norm",
        }),
      ],
      effectiveDayKey: "2026-04-10",
      patternId: "pattern_norp",
    });

    expect(plan).toEqual({
      kind: "UPDATE_SAME_DAY",
      assignmentId: "ws_1",
      createValidToDayKey: null,
    });
  });

  it("returns SPLIT when a different pattern covers the effective day", () => {
    const plan = buildEmployeeWorkScheduleAssignmentMutationPlan({
      rows: [
        row({
          id: "ws_1",
          validFrom: "2026-04-01",
          validTo: null,
          patternId: "pattern_norm",
        }),
      ],
      effectiveDayKey: "2026-04-10",
      patternId: "pattern_norp",
    });

    expect(plan).toEqual({
      kind: "SPLIT",
      assignmentId: "ws_1",
      createValidToDayKey: null,
    });
  });

  it("keeps future rows intact by capping the inserted row before the next row", () => {
    const plan = buildEmployeeWorkScheduleAssignmentMutationPlan({
      rows: [
        row({
          id: "ws_1",
          validFrom: "2026-04-20",
          validTo: null,
          patternId: "pattern_gece",
        }),
      ],
      effectiveDayKey: "2026-04-10",
      patternId: "pattern_norm",
    });

    expect(plan).toEqual({
      kind: "INSERT_GAP",
      assignmentId: null,
      createValidToDayKey: "2026-04-19",
    });
  });
});

describe("buildAppendEmployeeWorkScheduleAssignmentPlan", () => {
  it("allows another work schedule assignment version on the same effective day", () => {
    const plan = buildAppendEmployeeWorkScheduleAssignmentPlan({
      effectiveDayKey: "2026-04-10",
      rows: [row({ id: "ws_1", validFrom: "2026-04-10", patternId: "pattern_norm" })],
    });

    expect(plan).toEqual({ createValidToDayKey: null });
  });

  it("caps the appended work schedule assignment before a future assignment", () => {
    const plan = buildAppendEmployeeWorkScheduleAssignmentPlan({
      effectiveDayKey: "2026-04-10",
      rows: [
        row({ id: "ws_1", validFrom: "2026-04-01", patternId: "pattern_norm" }),
        row({ id: "ws_2", validFrom: "2026-04-20", patternId: "pattern_gece" }),
      ],
    });

    expect(plan).toEqual({ createValidToDayKey: "2026-04-19" });
  });
});
