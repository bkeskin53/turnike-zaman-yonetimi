import { describe, expect, it } from "vitest";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { buildFiniteRangeMutationPlan } from "../finiteRangeHistoryMutation.util";

function row(args: {
  validFrom: string;
  validTo?: string | null;
  payload: string;
}) {
  return {
    validFrom: dbDateFromDayKey(args.validFrom),
    validTo: args.validTo ? dbDateFromDayKey(args.validTo) : null,
    payload: args.payload,
  };
}

describe("buildFiniteRangeMutationPlan", () => {
  it("splits an open row and restores the previous payload after the bounded interval", () => {
    const plan = buildFiniteRangeMutationPlan({
      rows: [row({ validFrom: "2026-01-01", validTo: null, payload: "A" })],
      startDayKey: "2026-03-01",
      endDayKey: "2026-03-31",
      payload: "B",
      samePayload: (left, right) => left === right,
    });

    expect(plan.changed).toBe(true);
    expect(plan.desiredSegments).toEqual([
      { validFromDayKey: "2026-01-01", validToDayKey: "2026-02-28", payload: "A" },
      { validFromDayKey: "2026-03-01", validToDayKey: "2026-03-31", payload: "B" },
      { validFromDayKey: "2026-04-01", validToDayKey: null, payload: "A" },
    ]);
  });

  it("keeps future rows intact while inserting the bounded interval and restore gap", () => {
    const plan = buildFiniteRangeMutationPlan({
      rows: [
        row({ validFrom: "2026-01-01", validTo: "2026-04-30", payload: "A" }),
        row({ validFrom: "2026-05-01", validTo: null, payload: "C" }),
      ],
      startDayKey: "2026-03-01",
      endDayKey: "2026-03-31",
      payload: "B",
      samePayload: (left, right) => left === right,
    });

    expect(plan.desiredSegments).toEqual([
      { validFromDayKey: "2026-01-01", validToDayKey: "2026-02-28", payload: "A" },
      { validFromDayKey: "2026-03-01", validToDayKey: "2026-03-31", payload: "B" },
      { validFromDayKey: "2026-04-01", validToDayKey: "2026-04-30", payload: "A" },
      { validFromDayKey: "2026-05-01", validToDayKey: null, payload: "C" },
    ]);
  });

  it("returns no change when the same bounded interval and payload already exist", () => {
    const plan = buildFiniteRangeMutationPlan({
      rows: [
        row({ validFrom: "2026-01-01", validTo: "2026-02-28", payload: "A" }),
        row({ validFrom: "2026-03-01", validTo: "2026-03-31", payload: "B" }),
        row({ validFrom: "2026-04-01", validTo: null, payload: "A" }),
      ],
      startDayKey: "2026-03-01",
      endDayKey: "2026-03-31",
      payload: "B",
      samePayload: (left, right) => left === right,
    });

    expect(plan.changed).toBe(false);
  });

  it("merges adjacent equal payload segments after filling the bounded gap", () => {
    const plan = buildFiniteRangeMutationPlan({
      rows: [
        row({ validFrom: "2026-01-01", validTo: "2026-02-28", payload: "A" }),
        row({ validFrom: "2026-04-01", validTo: null, payload: "A" }),
      ],
      startDayKey: "2026-03-01",
      endDayKey: "2026-03-31",
      payload: "A",
      samePayload: (left, right) => left === right,
    });

    expect(plan.changed).toBe(true);
    expect(plan.desiredSegments).toEqual([
      { validFromDayKey: "2026-01-01", validToDayKey: null, payload: "A" },
    ]);
  });
});
