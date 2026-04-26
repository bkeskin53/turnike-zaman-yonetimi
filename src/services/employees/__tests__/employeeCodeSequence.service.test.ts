import { describe, expect, it, vi } from "vitest";
import {
  EmployeeCodeSequenceError,
  formatEmployeeCodeSequenceValue,
  isEmployeeCodeSequenceCandidate,
  parseEmployeeCodeSequenceValue,
  resolveNextEmployeeCode,
  resolveNextEmployeeCodeFromValues,
} from "../employeeCodeSequence.service";

describe("employeeCodeSequence", () => {
  it("starts from 00000001 when no employee exists", () => {
    expect(resolveNextEmployeeCodeFromValues([])).toBe("00000001");
  });

  it("returns max + 1 for numeric employee codes within 8 digits", () => {
    expect(
      resolveNextEmployeeCodeFromValues([
        "00000001",
        "00000009",
        "00000010",
        "00000125",
      ]),
    ).toBe("00000126");
  });

  it("ignores non-sequence legacy values", () => {
    expect(
      resolveNextEmployeeCodeFromValues([
        "00000007",
        "ABC001",
        "EMP-99",
        "  ",
        null,
        undefined,
        "123456789",
      ]),
    ).toBe("00000008");
  });

  it("treats short numeric values as valid sequence members", () => {
    expect(parseEmployeeCodeSequenceValue("7")).toBe(7);
    expect(parseEmployeeCodeSequenceValue("00000007")).toBe(7);
    expect(resolveNextEmployeeCodeFromValues(["7", "00000009"])).toBe(
      "00000010",
    );
  });

  it("keeps leading zero formatting at 8 digits", () => {
    expect(formatEmployeeCodeSequenceValue(1)).toBe("00000001");
    expect(formatEmployeeCodeSequenceValue(42)).toBe("00000042");
    expect(formatEmployeeCodeSequenceValue(99999999)).toBe("99999999");
  });

  it("rejects overflow beyond 8 digits", () => {
    expect(() =>
      resolveNextEmployeeCodeFromValues(["99999999"]),
    ).toThrowError(EmployeeCodeSequenceError);
    expect(() =>
      resolveNextEmployeeCodeFromValues(["99999999"]),
    ).toThrow("Employee code sequence exceeded the supported 8-digit range.");
  });

  it("filters candidates correctly", () => {
    expect(isEmployeeCodeSequenceCandidate("00000001")).toBe(true);
    expect(isEmployeeCodeSequenceCandidate("1")).toBe(true);
    expect(isEmployeeCodeSequenceCandidate("000000001")).toBe(false);
    expect(isEmployeeCodeSequenceCandidate("EMP001")).toBe(false);
    expect(isEmployeeCodeSequenceCandidate("")).toBe(false);
  });

  it("reads employee codes from the company scope only once", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { employeeCode: "00000003" },
      { employeeCode: "00000011" },
      { employeeCode: "LEGACY-A" },
    ]);

    const nextCode = await resolveNextEmployeeCode({
      companyId: "company_1",
      db: {
        employee: {
          findMany,
        },
      },
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        companyId: "company_1",
      },
      select: {
        employeeCode: true,
      },
    });
    expect(nextCode).toBe("00000012");
  });
});