import type { PuantajDailyRow, PuantajMonthlyEmployeeSummary, PuantajPayrollCodeSummaryRow } from "@/src/services/puantaj/types";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[\r\n",;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function boolLabel(value: boolean): string {
  return value ? "EVET" : "HAYIR";
}

export function renderMonthlyPuantajSummaryCsv(items: PuantajMonthlyEmployeeSummary[]): string {
  const header = [
    "Employee Code",
    "Full Name",
    "Month",
    "Day Count",
    "Present Days",
    "Absent Days",
    "Off Days",
    "Leave Days",
    "Annual Leave Days",
    "Sick Leave Days",
    "Excused Leave Days",
    "Unpaid Leave Days",
    "Unknown Leave Days",
    "Worked Minutes",
    "Overtime Minutes",
    "Overtime Early Minutes",
    "Overtime Late Minutes",
    "Late Minutes",
    "Early Leave Minutes",
    "Blocked Days",
    "Ready Days",
    "Review Required Days",
    "Pending Review Days",
    "Rejected Review Days",
    "Manual Adjustment Days",
    "Anomaly Days",
    "Payroll Ready",
    "Puantaj Codes",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        item.month,
        item.dayCount,
        item.presentDays,
        item.absentDays,
        item.offDays,
        item.leaveDays,
        item.annualLeaveDays,
        item.sickLeaveDays,
        item.excusedLeaveDays,
        item.unpaidLeaveDays,
        item.unknownLeaveDays,
        item.workedMinutes,
        item.overtimeMinutes,
        item.overtimeEarlyMinutes,
        item.overtimeLateMinutes,
        item.lateMinutes,
        item.earlyLeaveMinutes,
        item.blockedDays,
        item.readyDays,
        item.reviewRequiredDays,
        item.pendingReviewDays,
        item.rejectedReviewDays,
        item.manualAdjustmentDays,
        item.anomalyDays,
        boolLabel(item.isPayrollReady),
        item.puantajCodes.join(", "),
      ].map(csvCell).join(";")
    );
  }

  return lines.join("\n");
}

export function renderDailyPuantajRowsCsv(items: PuantajDailyRow[]): string {
  const header = [
    "Employee Code",
    "Full Name",
    "Day",
    "Status",
    "Leave Type",
    "First In",
    "Last Out",
    "Worked Minutes",
    "Overtime Minutes",
    "Overtime Early Minutes",
    "Overtime Late Minutes",
    "Late Minutes",
    "Early Leave Minutes",
    "Requires Review",
    "Review Status",
    "Review Reasons",
    "Reviewed At",
    "Review Note",
    "Manual Adjustment Applied",
    "Adjustment Note",
    "Puantaj State",
    "Puantaj Block Reasons",
    "Anomalies",
    "Puantaj Codes",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        item.dayKey,
        item.status,
        item.leaveType ?? "",
        item.firstIn ?? "",
        item.lastOut ?? "",
        item.workedMinutes,
        item.overtimeMinutes,
        item.overtimeEarlyMinutes,
        item.overtimeLateMinutes,
        item.lateMinutes,
        item.earlyLeaveMinutes,
        boolLabel(item.requiresReview),
        item.reviewStatus,
        item.reviewReasons.join(", "),
        item.reviewedAt ?? "",
        item.reviewNote ?? "",
        boolLabel(item.manualAdjustmentApplied),
        item.adjustmentNote ?? "",
        item.puantajState,
        item.puantajBlockReasons.map((x) => `${x.code}: ${x.detail}`).join(" | "),
        item.anomalies.join(", "),
        item.puantajCodes.join(", "),
      ]
        .map(csvCell)
        .join(";")
    );
  }

  return lines.join("\n");
}

export function renderPayrollCodeSummaryCsv(items: PuantajPayrollCodeSummaryRow[]): string {
  const header = [
    "Employee Code",
    "Full Name",
    "Month",
    "Code",
    "Payroll Code",
    "Payroll Label",
    "Unit",
    "Quantity",
    "Day Count",
    "Total Minutes",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        item.month,
        item.code,
        item.payrollCode,
        item.payrollLabel,
        item.unit,
        item.quantity,
        item.dayCount,
        item.totalMinutes,
      ]
        .map(csvCell)
        .join(";")
    );
  }

  return lines.join("\n");
}