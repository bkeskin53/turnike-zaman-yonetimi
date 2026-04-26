import { describe, expect, it } from "vitest";
import { buildResolvedPayrollLinesForDailyRow } from "../buildResolvedPayrollLinesForDailyRow";
import type { PuantajDailyRow } from "../types";

function createRow(partial?: Partial<PuantajDailyRow>): PuantajDailyRow {
  return {
    employeeId: "emp_1",
    employeeCode: "1001",
    fullName: "Test Personel",
    dayKey: "2026-03-01",
    status: "PRESENT",
    leaveType: null,
    firstIn: "2026-03-01T09:00:00+03:00",
    lastOut: "2026-03-01T18:00:00+03:00",
    workedMinutes: 540,
    overtimeMinutes: 60,
    overtimeEarlyMinutes: 0,
    overtimeLateMinutes: 60,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    anomalies: [],
    requiresReview: false,
    reviewStatus: "NONE",
    reviewReasons: [],
    reviewedAt: null,
    reviewNote: null,
    manualAdjustmentApplied: false,
    adjustmentNote: null,
    puantajState: "READY",
    puantajBlockReasons: [],
    puantajCodes: ["NORMAL_WORK", "OVERTIME"],
    ...partial,
  };
}

describe("buildResolvedPayrollLinesForDailyRow", () => {
  it("prefers ENGINE lines when engine produces output", () => {
    const result = buildResolvedPayrollLinesForDailyRow(createRow());

    expect(result.source).toBe("ENGINE");
    expect(result.lines.map((x) => x.code)).toEqual(["NORMAL_WORK", "OVERTIME_LATE"]);
    expect(result.diagnostics.engineLineCount).toBeGreaterThan(0);
  });

  it("falls back to LEGACY when engine produces no lines", () => {
    const result = buildResolvedPayrollLinesForDailyRow(
      createRow({
        status: "ABSENT",
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        puantajCodes: ["PAID_LEAVE"] as unknown as PuantajDailyRow["puantajCodes"],
      })
    );

    expect(result.source).toBe("LEGACY");
    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PAID_LEAVE",
          source: "SYSTEM",
          quantityHint: 1,
        }),
      ])
    );
  });

  it("filters useless legacy NORMAL_WORK and OVERTIME zero-minute lines", () => {
    const result = buildResolvedPayrollLinesForDailyRow(
      createRow({
        status: "ABSENT",
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
        puantajCodes: ["NORMAL_WORK", "OVERTIME"],
      })
    );

    expect(result.source).toBe("LEGACY");
    expect(result.lines).toEqual([]);
  });

  it("passes holiday context into engine", () => {
    const result = buildResolvedPayrollLinesForDailyRow(createRow(), {
      isHoliday: true,
      holidayName: "Resmi Tatil",
    });

    expect(result.source).toBe("ENGINE");
    expect(result.lines.map((x) => x.code)).toContain("HOLIDAY_WORK");
  });

  it("passes night context into engine", () => {
    const result = buildResolvedPayrollLinesForDailyRow(createRow(), {
      nightMinutes: 120,
      nightWindowLabel: "22:00-06:00",
    });

    expect(result.source).toBe("ENGINE");
    expect(result.lines.map((x) => x.code)).toContain("NIGHT_PREMIUM");
  });
});