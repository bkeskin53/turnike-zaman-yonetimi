import type { BuildDailyPuantajRowsParams, PuantajCode, PuantajDailyRow, PuantajMonthlyEmployeeSummary } from "@/src/services/puantaj/types";
import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";
import { buildResolvedPayrollLinesForDailyRow } from "@/src/services/puantaj/buildResolvedPayrollLinesForDailyRow";
import type { PayrollRuleLine } from "@/src/services/puantaj/payrollRuleEngine";

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

function collectResolvedSummaryCodes(row: PuantajDailyRow): PuantajCode[] {
  const resolved = buildResolvedPayrollLinesForDailyRow(row);

  if (resolved.lines.length > 0) {
    return Array.from(
      new Set(
        resolved.lines
          .map((line) => mapPayrollRuleLineToLegacyPuantajCode(row, line))
          .filter((code): code is PuantajCode => !!code)
      )
    );
  }

  return row.puantajCodes;
}

type SummaryAccumulator = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  month: string;

  dayCount: number;

  presentDays: number;
  absentDays: number;
  offDays: number;
  leaveDays: number;

  annualLeaveDays: number;
  sickLeaveDays: number;
  excusedLeaveDays: number;
  unpaidLeaveDays: number;
  unknownLeaveDays: number;

  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;

  blockedDays: number;
  readyDays: number;

  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;

  manualAdjustmentDays: number;
  anomalyDays: number;

  puantajCodes: Set<PuantajCode>;
};

function createAccumulator(row: PuantajDailyRow, month: string): SummaryAccumulator {
  return {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    month,

    dayCount: 0,

    presentDays: 0,
    absentDays: 0,
    offDays: 0,
    leaveDays: 0,

    annualLeaveDays: 0,
    sickLeaveDays: 0,
    excusedLeaveDays: 0,
    unpaidLeaveDays: 0,
    unknownLeaveDays: 0,

    workedMinutes: 0,
    overtimeMinutes: 0,
    overtimeEarlyMinutes: 0,
    overtimeLateMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,

    blockedDays: 0,
    readyDays: 0,

    reviewRequiredDays: 0,
    pendingReviewDays: 0,
    rejectedReviewDays: 0,

    manualAdjustmentDays: 0,
    anomalyDays: 0,

    puantajCodes: new Set<PuantajCode>(),
  };
}

function applyRow(acc: SummaryAccumulator, row: PuantajDailyRow) {
  acc.dayCount += 1;

  if (row.status === "PRESENT") acc.presentDays += 1;
  if (row.status === "ABSENT") acc.absentDays += 1;
  if (row.status === "OFF") acc.offDays += 1;
  if (row.status === "LEAVE") {
    acc.leaveDays += 1;

    switch (row.leaveType) {
      case "ANNUAL":
        acc.annualLeaveDays += 1;
        break;
      case "SICK":
        acc.sickLeaveDays += 1;
        break;
      case "EXCUSED":
        acc.excusedLeaveDays += 1;
        break;
      case "UNPAID":
        acc.unpaidLeaveDays += 1;
        break;
      default:
        acc.unknownLeaveDays += 1;
        break;
    }
  }

  acc.workedMinutes += row.workedMinutes;
  acc.overtimeMinutes += row.overtimeMinutes;
  acc.overtimeEarlyMinutes += row.overtimeEarlyMinutes;
  acc.overtimeLateMinutes += row.overtimeLateMinutes;
  acc.lateMinutes += row.lateMinutes;
  acc.earlyLeaveMinutes += row.earlyLeaveMinutes;

  if (row.puantajState === "BLOCKED") acc.blockedDays += 1;
  else acc.readyDays += 1;

  if (row.requiresReview && row.reviewStatus === "NONE") acc.reviewRequiredDays += 1;
  if (row.reviewStatus === "PENDING") acc.pendingReviewDays += 1;
  if (row.reviewStatus === "REJECTED") acc.rejectedReviewDays += 1;

  if (row.manualAdjustmentApplied) acc.manualAdjustmentDays += 1;
  if (row.anomalies.length > 0) acc.anomalyDays += 1;

  const resolvedSummaryCodes = collectResolvedSummaryCodes(row);

  for (const code of resolvedSummaryCodes) {
    acc.puantajCodes.add(code);
  }
}

function finalizeAccumulator(acc: SummaryAccumulator): PuantajMonthlyEmployeeSummary {
  return {
    ...acc,
    puantajCodes: Array.from(acc.puantajCodes).sort((a, b) => a.localeCompare(b, "tr")),
    isPayrollReady: acc.blockedDays === 0,
  };
}

export async function buildMonthlyPuantajSummary(
  params: BuildDailyPuantajRowsParams
): Promise<PuantajMonthlyEmployeeSummary[]> {
  const rows = await buildDailyPuantajRows(params);
  const byEmployee = new Map<string, SummaryAccumulator>();

  for (const row of rows) {
    const key = row.employeeId;
    let acc = byEmployee.get(key);
    if (!acc) {
      acc = createAccumulator(row, params.month);
      byEmployee.set(key, acc);
    }
    applyRow(acc, row);
  }

  return Array.from(byEmployee.values())
    .map(finalizeAccumulator)
    .sort((a, b) => {
      const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "tr");
      if (codeCompare !== 0) return codeCompare;
      return a.fullName.localeCompare(b.fullName, "tr");
    });
}