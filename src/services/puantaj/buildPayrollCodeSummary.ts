import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";
import { buildResolvedPayrollLinesForDailyRow } from "@/src/services/puantaj/buildResolvedPayrollLinesForDailyRow";
import { projectPayrollQuantity } from "@/src/services/puantaj/payrollQuantityProjection";
import { resolvePayrollCodeMappingItemsIndex } from "@/src/services/puantaj/payrollCodeMappingResolver.service";
import type {
  BuildDailyPuantajRowsParams,
  PuantajCode,
  PuantajDailyRow,
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
  PuantajPayrollCodeSummaryRow,
} from "@/src/services/puantaj/types";
import type { PayrollRuleLine } from "@/src/services/puantaj/payrollRuleEngine";

export type PayrollCodeSummaryRowMeta = {
  ruleSource: "ENGINE" | "LEGACY";
  ruleEngineVersion: string;
  originRuleCodes: string[];
  originLegacyCodes: PuantajCode[];
};

export type EnrichedPuantajPayrollCodeSummaryRow =
  PuantajPayrollCodeSummaryRow & {
    meta: PayrollCodeSummaryRowMeta;
  };

type Acc = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  month: string;
  code: PuantajCode;
  payrollCode: string;
  payrollLabel: string;
  unit: PuantajPayrollQuantityUnit;
  quantityStrategy: PuantajPayrollQuantityStrategy;
  fixedQuantity: number | null;
  quantity: number;
  dayCount: number;
  totalMinutes: number;
  meta: {
    ruleSource: "ENGINE" | "LEGACY";
    ruleEngineVersion: string;
    originRuleCodes: Set<string>;
    originLegacyCodes: Set<PuantajCode>;
  };
};

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function mapLeaveTypeToLegacyPuantajCode(row: PuantajDailyRow): PuantajCode | null {
  switch (row.leaveType) {
    case "ANNUAL":
      return "LEAVE_ANNUAL";
    case "SICK":
      return "LEAVE_SICK";
    case "EXCUSED":
      return "LEAVE_EXCUSED";
    case "UNPAID":
      return "LEAVE_UNPAID";
    case null:
      return "LEAVE_UNKNOWN";
    default:
      return "LEAVE_UNKNOWN";
  }
}

function mapPayrollRuleLineToLegacyPuantajCode(
  row: PuantajDailyRow,
  line: PayrollRuleLine
): PuantajCode | null {
  switch (line.code) {
    case "NORMAL_WORK":
      return "NORMAL_WORK";

    case "OVERTIME":
    case "OVERTIME_EARLY":
    case "OVERTIME_LATE":
    case "HOLIDAY_OT":
      return "OVERTIME";

    case "OFF_DAY_WORK":
    case "HOLIDAY_WORK":
      return "OFF_DAY";

    case "PAID_LEAVE":
    case "UNPAID_LEAVE":
      return mapLeaveTypeToLegacyPuantajCode(row);

    case "NIGHT_PREMIUM":
      return null;
    default:
      return null;
  }
}

function resolveLegacyCodeMinutes(args: {
  legacyCode: PuantajCode;
  line: PayrollRuleLine;
}): { workedMinutesOverride: number; overtimeMinutesOverride: number; totalMinutes: number } {
  switch (args.legacyCode) {
    case "NORMAL_WORK":
      return {
        workedMinutesOverride: args.line.minutes,
        overtimeMinutesOverride: 0,
        totalMinutes: args.line.minutes,
      };

    case "OVERTIME":
      return {
        workedMinutesOverride: 0,
        overtimeMinutesOverride: args.line.minutes,
        totalMinutes: args.line.minutes,
      };

    case "OFF_DAY":
      return {
        workedMinutesOverride: args.line.minutes,
        overtimeMinutesOverride: 0,
        totalMinutes: args.line.minutes,
      };

    case "LEAVE_ANNUAL":
    case "LEAVE_SICK":
    case "LEAVE_EXCUSED":
    case "LEAVE_UNPAID":
    case "LEAVE_UNKNOWN":
      return {
        workedMinutesOverride: 0,
        overtimeMinutesOverride: 0,
        totalMinutes: 0,
      };

    case "ABSENCE":
      return {
        workedMinutesOverride: 0,
        overtimeMinutesOverride: 0,
        totalMinutes: 0,
      };
  }
}

function toSortedArray<T extends string>(value: Set<T>): T[] {
  return Array.from(value).sort((a, b) => a.localeCompare(b, "tr"));
}

export async function buildPayrollCodeSummary(
  params: BuildDailyPuantajRowsParams
): Promise<EnrichedPuantajPayrollCodeSummaryRow[]> {
  const rows = await buildDailyPuantajRows(params);
  const resolvedMapping = await resolvePayrollCodeMappingItemsIndex({
    companyId: params.companyId,
    code: params.payrollMappingProfile ?? null,
    autoSeedDefault: true,
  });
  const map = new Map<string, Acc>();

  for (const row of rows) {
    const resolved = buildResolvedPayrollLinesForDailyRow(row);

    for (const line of resolved.lines) {
      const code = mapPayrollRuleLineToLegacyPuantajCode(row, line);
      if (!code) continue;

      const mapping = resolvedMapping.itemsByCode.get(code);
      if (!mapping) continue;
      const originLegacyCodes =
        resolved.source === "ENGINE"
          ? [code]
          : row.puantajCodes.filter((x): x is PuantajCode => x === code);
      const originRuleCode = line.code;

      const minutes = resolveLegacyCodeMinutes({
        legacyCode: code,
        line,
      });

      const key = [row.employeeId, params.month, code].join("__");
      const payrollCode = mapping.payrollCode;
      const payrollLabel = mapping.payrollLabel;
      const unit = mapping.unit;
      const quantityStrategy = mapping.quantityStrategy;
      const fixedQuantity = mapping.fixedQuantity;
      const quantity = projectPayrollQuantity({
        unit,
        quantityStrategy,
        fixedQuantity,
        workedMinutes: row.workedMinutes,
        overtimeMinutes: row.overtimeMinutes,
      workedMinutesOverride: minutes.workedMinutesOverride,
        overtimeMinutesOverride: minutes.overtimeMinutesOverride,
      });
      const totalMinutes = minutes.totalMinutes;

      let acc = map.get(key);
      if (!acc) {
        acc = {
          employeeId: row.employeeId,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          month: params.month,
          code,
          payrollCode,
          payrollLabel,
          unit,
          quantityStrategy,
          fixedQuantity,
          quantity: 0,
          dayCount: 0,
          totalMinutes: 0,
          meta: {
            ruleSource: resolved.source,
            ruleEngineVersion: resolved.diagnostics.engineVersion,
            originRuleCodes: new Set<string>(),
            originLegacyCodes: new Set<PuantajCode>(),
          },
        };
        map.set(key, acc);
      }

      acc.dayCount += 1;
      acc.quantity += quantity;
      acc.totalMinutes += totalMinutes;
      acc.meta.ruleSource =
        acc.meta.ruleSource === "LEGACY" || resolved.source === "LEGACY"
          ? "LEGACY"
          : "ENGINE";
      acc.meta.ruleEngineVersion = resolved.diagnostics.engineVersion;
      acc.meta.originRuleCodes.add(originRuleCode);
      for (const legacyCode of originLegacyCodes) {
        acc.meta.originLegacyCodes.add(legacyCode);
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "tr");
      if (codeCompare !== 0) return codeCompare;
      return a.code.localeCompare(b.code, "tr");
    })
    .map((x) => ({
      employeeId: x.employeeId,
      employeeCode: x.employeeCode,
      fullName: x.fullName,
      month: x.month,
      code: x.code,
      payrollCode: x.payrollCode,
      payrollLabel: x.payrollLabel,
      unit: x.unit,
      quantityStrategy: x.quantityStrategy,
      fixedQuantity: x.fixedQuantity,
      quantity: roundQuantity(x.quantity),
      dayCount: x.dayCount,
      totalMinutes: x.totalMinutes,
      meta: {
        ruleSource: x.meta.ruleSource,
        ruleEngineVersion: x.meta.ruleEngineVersion,
        originRuleCodes: toSortedArray(x.meta.originRuleCodes),
        originLegacyCodes: toSortedArray(x.meta.originLegacyCodes),
      },
    }));
}