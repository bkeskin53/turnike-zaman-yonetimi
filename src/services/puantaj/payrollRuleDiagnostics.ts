import type {
  PuantajCode,
  PuantajDailyRow,
  PuantajPayrollCodeSummaryRow,
} from "@/src/services/puantaj/types";
import { buildResolvedPayrollLinesForDailyRow } from "@/src/services/puantaj/buildResolvedPayrollLinesForDailyRow";

export type PayrollRuleDiagnosticsSummary = {
  ruleEngineVersion: string;
  dailyRowCount: number;
  engineRowCount: number;
  legacyRowCount: number;
  engineLineCount: number;
  legacyLineCount: number;
  hasLegacyFallbackRows: boolean;
  generatedRuleCodes: string[];
  generatedPuantajCodes: PuantajCode[];
};

export function summarizePayrollRuleDiagnostics(args: {
  rows: PuantajDailyRow[];
  codeItems?: Pick<PuantajPayrollCodeSummaryRow, "code">[] | null;
}): PayrollRuleDiagnosticsSummary {
  const generatedRuleCodes = new Set<string>();
  const generatedPuantajCodes = new Set<PuantajCode>();

  let ruleEngineVersion = "unknown";
  let engineRowCount = 0;
  let legacyRowCount = 0;
  let engineLineCount = 0;
  let legacyLineCount = 0;

  for (const row of args.rows) {
    const resolved = buildResolvedPayrollLinesForDailyRow(row);

    ruleEngineVersion = resolved.diagnostics.engineVersion;

    if (resolved.source === "ENGINE") {
      engineRowCount += 1;
      engineLineCount += resolved.lines.length;
    } else {
      legacyRowCount += 1;
      legacyLineCount += resolved.lines.length;
    }

    for (const line of resolved.lines) {
      generatedRuleCodes.add(line.code);
    }
  }

  if (args.codeItems?.length) {
    for (const item of args.codeItems) {
      generatedPuantajCodes.add(item.code);
    }
  } else {
    for (const row of args.rows) {
      for (const code of row.puantajCodes) {
        generatedPuantajCodes.add(code);
      }
    }
  }

  return {
    ruleEngineVersion,
    dailyRowCount: args.rows.length,
    engineRowCount,
    legacyRowCount,
    engineLineCount,
    legacyLineCount,
    hasLegacyFallbackRows: legacyRowCount > 0,
    generatedRuleCodes: Array.from(generatedRuleCodes).sort((a, b) =>
      a.localeCompare(b, "tr")
    ),
    generatedPuantajCodes: Array.from(generatedPuantajCodes).sort((a, b) =>
      a.localeCompare(b, "tr")
    ),
  };
}