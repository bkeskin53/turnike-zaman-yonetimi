import { describe, expect, it } from "vitest";
import { projectPayrollQuantity } from "../payrollQuantityProjection";

describe("projectPayrollQuantity", () => {
  it("returns worked minutes for WORKED_MINUTES", () => {
    expect(
      projectPayrollQuantity({
        unit: "MINUTES",
        quantityStrategy: "WORKED_MINUTES",
        fixedQuantity: null,
        workedMinutes: 480,
        overtimeMinutes: 120,
      })
    ).toBe(480);
  });

  it("returns overtime minutes for OVERTIME_MINUTES", () => {
    expect(
      projectPayrollQuantity({
        unit: "MINUTES",
        quantityStrategy: "OVERTIME_MINUTES",
        fixedQuantity: null,
        workedMinutes: 480,
        overtimeMinutes: 120,
      })
    ).toBe(120);
  });

  it("returns fixed quantity for FIXED_QUANTITY", () => {
    expect(
      projectPayrollQuantity({
        unit: "DAYS",
        quantityStrategy: "FIXED_QUANTITY",
        fixedQuantity: 1,
        workedMinutes: 480,
        overtimeMinutes: 120,
      })
    ).toBe(1);
  });

  it("supports fractional fixed quantity", () => {
    expect(
      projectPayrollQuantity({
        unit: "DAYS",
        quantityStrategy: "FIXED_QUANTITY",
        fixedQuantity: 0.5,
        workedMinutes: 480,
        overtimeMinutes: 120,
      })
    ).toBe(0.5);
  });
});