import { describe, expect, it } from "vitest";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { buildAppendEmployeeProfileVersionPlan } from "../employeeMasterProfileVersionedEdit.service";

function row(args: { id: string; validFrom: string; validTo?: string | null }) {
  return {
    id: args.id,
    validFrom: dbDateFromDayKey(args.validFrom),
    validTo: args.validTo ? dbDateFromDayKey(args.validTo) : null,
  };
}

describe("buildAppendEmployeeProfileVersionPlan", () => {
  it("does not request a same-day update when a version already starts on the effective day", () => {
    const plan = buildAppendEmployeeProfileVersionPlan({
      effectiveDayKey: "2026-04-10",
      rows: [row({ id: "profile_a", validFrom: "2026-04-10" })],
    });

    expect(plan).toEqual({ createValidToDayKey: null });
  });

  it("caps the appended version before the next future version", () => {
    const plan = buildAppendEmployeeProfileVersionPlan({
      effectiveDayKey: "2026-04-10",
      rows: [
        row({ id: "profile_a", validFrom: "2026-04-01" }),
        row({ id: "profile_b", validFrom: "2026-04-20" }),
      ],
    });

    expect(plan).toEqual({ createValidToDayKey: "2026-04-19" });
  });
});
