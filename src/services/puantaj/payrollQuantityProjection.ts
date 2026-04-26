import type { PuantajPayrollQuantityStrategy, PuantajPayrollQuantityUnit } from "@/src/services/puantaj/types";

export type PayrollQuantityProjectionInput = {
  unit: PuantajPayrollQuantityUnit;
  quantityStrategy: PuantajPayrollQuantityStrategy;
  fixedQuantity: number | null;
  workedMinutes: number;
  overtimeMinutes: number;
  workedMinutesOverride?: number | null;
  overtimeMinutesOverride?: number | null;
};

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function toSafeNumber(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function projectPayrollQuantity(input: PayrollQuantityProjectionInput): number {
  const workedMinutes =
    input.workedMinutesOverride == null
      ? toSafeNumber(input.workedMinutes)
      : toSafeNumber(input.workedMinutesOverride);

  const overtimeMinutes =
    input.overtimeMinutesOverride == null
      ? toSafeNumber(input.overtimeMinutes)
      : toSafeNumber(input.overtimeMinutesOverride);

  switch (input.quantityStrategy) {
    case "WORKED_MINUTES": {
      if (input.unit !== "MINUTES") {
        throw new Error("INVALID_QUANTITY_STRATEGY_UNIT_COMBINATION");
      }
      return roundQuantity(workedMinutes);
    }

    case "OVERTIME_MINUTES": {
      if (input.unit !== "MINUTES") {
        throw new Error("INVALID_QUANTITY_STRATEGY_UNIT_COMBINATION");
      }
      return roundQuantity(overtimeMinutes);
    }

    case "FIXED_QUANTITY": {
      const value = input.fixedQuantity == null ? 0 : toSafeNumber(input.fixedQuantity);
      return roundQuantity(value);
    }

    default: {
      const exhaustive: never = input.quantityStrategy;
      return exhaustive;
    }
  }
}