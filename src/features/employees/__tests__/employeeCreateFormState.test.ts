import { describe, expect, it } from "vitest";
import {
  createInitialEmployeeCreateForm,
  createResetEmployeeCreateForm,
  resolveEmployeeCodeInputModeForPrefill,
} from "../employeeCreateFormState";

describe("employeeCreateFormState", () => {
  it("creates the initial create form with prefilled employee code and empty start date", () => {
    expect(
      createInitialEmployeeCreateForm({
        employeeCode: "00000042",
      }),
    ).toEqual({
      employeeCode: "00000042",
      firstName: "",
      lastName: "",
      nationalId: "",
      gender: "",
      email: "",
      phone: "",
      cardNo: "",
      deviceUserId: "",
      branchId: "",
      workSchedulePatternId: "",
      employeeGroupId: "",
      employeeSubgroupId: "",
      employmentStartDate: "",
      employmentReason: "",
    });
  });

  it("creates the reset/success form with the next employee code and canonical today day key", () => {
    expect(
      createResetEmployeeCreateForm({
        employeeCode: "00000043",
        todayDayKey: "2026-04-18",
      }),
    ).toEqual({
      employeeCode: "00000043",
      firstName: "",
      lastName: "",
      nationalId: "",
      gender: "",
      email: "",
      phone: "",
      cardNo: "",
      deviceUserId: "",
      branchId: "",
      workSchedulePatternId: "",
      employeeGroupId: "",
      employeeSubgroupId: "",
      employmentStartDate: "2026-04-18",
      employmentReason: "",
    });
  });

  it("returns AUTO only when a prefilled employee code exists", () => {
    expect(resolveEmployeeCodeInputModeForPrefill("00000001")).toBe("AUTO");
    expect(resolveEmployeeCodeInputModeForPrefill("   00000009   ")).toBe("AUTO");
    expect(resolveEmployeeCodeInputModeForPrefill("")).toBe("MANUAL");
    expect(resolveEmployeeCodeInputModeForPrefill("   ")).toBe("MANUAL");
  });
});