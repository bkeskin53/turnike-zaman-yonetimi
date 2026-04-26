import { describe, expect, it } from "vitest";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { buildAppendEmployeeOrgAssignmentPlan } from "@/src/services/employeeOrgAssignmentMutation.service";

function row(args: { id: string; validFrom: string }) {
  return {
    id: args.id,
    validFrom: dbDateFromDayKey(args.validFrom),
  };
}

describe("buildAppendEmployeeOrgAssignmentPlan", () => {
  it("allows another assignment version on the same effective day without update semantics", () => {
    const plan = buildAppendEmployeeOrgAssignmentPlan({
      effectiveDayKey: "2026-04-10",
      rows: [row({ id: "org_a", validFrom: "2026-04-10" })],
    });

    expect(plan).toEqual({ createValidToDayKey: null });
  });

  it("caps the appended assignment before a future assignment version", () => {
    const plan = buildAppendEmployeeOrgAssignmentPlan({
      effectiveDayKey: "2026-04-10",
      rows: [
        row({ id: "org_a", validFrom: "2026-04-01" }),
        row({ id: "org_b", validFrom: "2026-04-20" }),
      ],
    });

    expect(plan).toEqual({ createValidToDayKey: "2026-04-19" });
  });
});
