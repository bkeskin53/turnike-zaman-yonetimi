import type { PuantajDailyRow } from "@/src/services/puantaj/types";
import {
  evaluatePayrollRuleEngine,
  type PayrollRuleCode,
  type PayrollRuleEngineContext,
  type PayrollRuleLine,
} from "@/src/services/puantaj/payrollRuleEngine";

export interface ResolvedPayrollLinesResult {
  lines: PayrollRuleLine[];
  source: "ENGINE" | "LEGACY";
  diagnostics: {
    engineVersion: string;
    engineLineCount: number;
    legacyCodeCount: number;
  };
}

function legacyCodeToLine(
  row: PuantajDailyRow,
  code: string
): PayrollRuleLine | null {
  const normalized = code as PayrollRuleCode;

  switch (normalized) {
    case "NORMAL_WORK":
      return {
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        dayKey: row.dayKey,
        code: "NORMAL_WORK",
        source: "SYSTEM",
        minutes: row.workedMinutes,
        quantityHint: null,
        meta: {
          rulePass: "BASE_WORK",
          note: "Legacy fallback from puantajCodes.",
        },
      };

    case "OVERTIME":
      return {
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        dayKey: row.dayKey,
        code: "OVERTIME",
        source: "SYSTEM",
        minutes: row.overtimeMinutes,
        quantityHint: null,
        meta: {
          rulePass: "OVERTIME_SPLIT",
          note: "Legacy fallback from puantajCodes.",
        },
      };

    case "PAID_LEAVE":
    case "UNPAID_LEAVE":
    case "OFF_DAY_WORK":
    case "HOLIDAY_WORK":
    case "HOLIDAY_OT":
    case "NIGHT_PREMIUM":
    case "OVERTIME_EARLY":
    case "OVERTIME_LATE":
      return {
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        dayKey: row.dayKey,
        code: normalized,
        source: "SYSTEM",
        minutes: 0,
        quantityHint: 1,
        meta: {
          rulePass: "LEAVE_TRANSFORM",
          note: "Legacy fallback from puantajCodes.",
        },
      };

    default:
      return null;
  }
}

export function buildResolvedPayrollLinesForDailyRow(
  row: PuantajDailyRow,
  context?: PayrollRuleEngineContext
): ResolvedPayrollLinesResult {
  const engine = evaluatePayrollRuleEngine(row, context);

  if (engine.lines.length > 0) {
    return {
      lines: engine.lines,
      source: "ENGINE",
      diagnostics: {
        engineVersion: engine.diagnostics.version,
        engineLineCount: engine.lines.length,
        legacyCodeCount: row.puantajCodes.length,
      },
    };
  }

  const legacyLines = row.puantajCodes
    .map((code) => legacyCodeToLine(row, code))
    .filter((x): x is PayrollRuleLine => !!x)
    .filter((line) => {
      if (line.code === "NORMAL_WORK") return line.minutes > 0;
      if (line.code === "OVERTIME") return line.minutes > 0;
      return true;
    });

  return {
    lines: legacyLines,
    source: "LEGACY",
    diagnostics: {
      engineVersion: engine.diagnostics.version,
      engineLineCount: engine.lines.length,
      legacyCodeCount: row.puantajCodes.length,
    },
  };
}