import { describe, expect, it } from "vitest";
import { evaluatePayrollRuleEngine, PAYROLL_RULE_ENGINE_VERSION, PAYROLL_RULE_PASS_ORDER } from "../payrollRuleEngine";
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

describe("evaluatePayrollRuleEngine", () => {
  it("returns deterministic diagnostics with the expected pass order", () => {
    const result = evaluatePayrollRuleEngine(createRow());

    expect(result.diagnostics.version).toBe(PAYROLL_RULE_ENGINE_VERSION);
    expect(result.diagnostics.orderedPasses).toEqual(PAYROLL_RULE_PASS_ORDER);
    expect(result.diagnostics.employeeId).toBe("emp_1");
    expect(result.diagnostics.employeeCode).toBe("1001");
    expect(result.diagnostics.dayKey).toBe("2026-03-01");
    expect(result.diagnostics.context).toEqual({
      isHoliday: false,
      holidayName: null,
      nightMinutes: 0,
      nightWindowLabel: null,
    });
  });

  it("emits NORMAL_WORK line for present rows with worked minutes", () => {
    const result = evaluatePayrollRuleEngine(createRow());

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
      employeeId: "emp_1",
      employeeCode: "1001",
      fullName: "Test Personel",
      dayKey: "2026-03-01",
      code: "NORMAL_WORK",
      source: "ATTENDANCE",
      minutes: 540,
      quantityHint: null,
      meta: expect.objectContaining({
            rulePass: "BASE_WORK",
          }),
        }),
      ])
    )
  });

  it("does not emit NORMAL_WORK for OFF days", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({ status: "OFF", workedMinutes: 0, overtimeEarlyMinutes: 0, overtimeLateMinutes: 0 })
    );
    expect(result.lines).toEqual([]);
  });

  it("keeps legacy puantaj codes visible for transition period", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        puantajCodes: ["LEAVE_ANNUAL"],
      })
    );

    expect(result.diagnostics.legacyPuantajCodes).toEqual(["LEAVE_ANNUAL"]);
  });

  it("does not emit NORMAL_WORK when worked minutes is zero", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({ workedMinutes: 0, overtimeEarlyMinutes: 0, overtimeLateMinutes: 0 })
    );
    expect(result.lines).toEqual([]);
  });

  it("emits OVERTIME_EARLY line when overtimeEarlyMinutes exists", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        overtimeEarlyMinutes: 45,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OVERTIME_EARLY",
          source: "OVERTIME",
          minutes: 45,
          meta: expect.objectContaining({
            rulePass: "OVERTIME_SPLIT",
          }),
        }),
      ])
    );
  });

  it("emits OVERTIME_LATE line when overtimeLateMinutes exists", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 90,
      })
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OVERTIME_LATE",
          source: "OVERTIME",
          minutes: 90,
          meta: expect.objectContaining({
            rulePass: "OVERTIME_SPLIT",
          }),
        }),
      ])
    );
  });

  it("emits both overtime split lines when both early and late overtime exist", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        overtimeEarlyMinutes: 30,
        overtimeLateMinutes: 60,
      })
    );

    expect(result.lines.map((x) => x.code)).toEqual([
      "NORMAL_WORK",
      "OVERTIME_EARLY",
      "OVERTIME_LATE",
    ]);
  });

  it("emits PAID_LEAVE for ANNUAL leave", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        status: "LEAVE",
        leaveType: "ANNUAL",
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PAID_LEAVE",
          source: "LEAVE",
          minutes: 0,
          quantityHint: 1,
          meta: expect.objectContaining({
            rulePass: "LEAVE_TRANSFORM",
          }),
        }),
      ])
    );
  });

  it("emits PAID_LEAVE for SICK and EXCUSED leave types", () => {
    const sick = evaluatePayrollRuleEngine(
      createRow({
        status: "LEAVE",
        leaveType: "SICK",
        workedMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    const excused = evaluatePayrollRuleEngine(
      createRow({
        status: "LEAVE",
        leaveType: "EXCUSED",
        workedMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(sick.lines.map((x) => x.code)).toContain("PAID_LEAVE");
    expect(excused.lines.map((x) => x.code)).toContain("PAID_LEAVE");
  });

  it("emits UNPAID_LEAVE for unpaid leave", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        status: "LEAVE",
        leaveType: "UNPAID",
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNPAID_LEAVE",
          source: "LEAVE",
          minutes: 0,
          quantityHint: 1,
          meta: expect.objectContaining({
            rulePass: "LEAVE_TRANSFORM",
          }),
        }),
      ])
    );
  });

  it("does not emit leave line when status is LEAVE but leaveType is null", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        status: "LEAVE",
        leaveType: null,
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual([]);
  });

  it("emits OFF_DAY_WORK when OFF day has worked minutes", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        status: "OFF",
        workedMinutes: 240,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OFF_DAY_WORK",
          source: "ATTENDANCE",
          minutes: 240,
          meta: expect.objectContaining({
            rulePass: "HOLIDAY_OVERRIDE",
          }),
        }),
      ])
    );
  });

  it("does not emit OFF_DAY_WORK when OFF day has zero worked minutes", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        status: "OFF",
        workedMinutes: 0,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      })
    );

    expect(result.lines).toEqual([]);
  });

  it("emits HOLIDAY_WORK when holiday context exists and worked minutes is positive", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 480,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      }),
      {
        isHoliday: true,
        holidayName: "Ulusal Bayram",
      }
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HOLIDAY_WORK",
          source: "HOLIDAY",
          minutes: 480,
          meta: expect.objectContaining({
            rulePass: "HOLIDAY_OVERRIDE",
          }),
        }),
      ])
    );
  });

  it("emits HOLIDAY_OT when holiday context exists and overtime split minutes are positive", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 600,
        overtimeMinutes: 120,
        overtimeEarlyMinutes: 30,
        overtimeLateMinutes: 90,
      }),
      {
        isHoliday: true,
        holidayName: "Resmi Tatil",
      }
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HOLIDAY_OT",
          source: "HOLIDAY",
          minutes: 120,
          meta: expect.objectContaining({
            rulePass: "HOLIDAY_OVERRIDE",
          }),
        }),
      ])
    );
  });

  it("does not emit holiday lines when holiday context is absent", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 480,
        overtimeMinutes: 60,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 60,
      })
    );

    expect(result.lines.map((x) => x.code)).not.toContain("HOLIDAY_WORK");
    expect(result.lines.map((x) => x.code)).not.toContain("HOLIDAY_OT");
  });

  it("emits NIGHT_PREMIUM when context.nightMinutes is positive", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 480,
        overtimeMinutes: 0,
        overtimeEarlyMinutes: 0,
        overtimeLateMinutes: 0,
      }),
      {
        nightMinutes: 210,
        nightWindowLabel: "22:00-06:00",
      }
    );

    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "NIGHT_PREMIUM",
          source: "NIGHT",
          minutes: 210,
          meta: expect.objectContaining({
            rulePass: "NIGHT_PREMIUM",
          }),
        }),
      ])
    );
  });

  it("does not emit NIGHT_PREMIUM when context.nightMinutes is zero", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 480,
      }),
      {
        nightMinutes: 0,
      }
    );

    expect(result.lines.map((x) => x.code)).not.toContain("NIGHT_PREMIUM");
  });

  it("does not emit NIGHT_PREMIUM when context is absent", () => {
    const result = evaluatePayrollRuleEngine(
      createRow({
        workedMinutes: 480,
      })
    );

    expect(result.lines.map((x) => x.code)).not.toContain("NIGHT_PREMIUM");
  });

  it("keeps diagnostics night context visible", () => {
    const result = evaluatePayrollRuleEngine(createRow(), {
      nightMinutes: 120,
      nightWindowLabel: "22:00-06:00",
    });

    expect(result.diagnostics.context).toEqual({
      isHoliday: false,
      holidayName: null,
      nightMinutes: 120,
      nightWindowLabel: "22:00-06:00",
    });
  });
});