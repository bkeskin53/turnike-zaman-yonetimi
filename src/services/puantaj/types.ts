import type { AttendanceReviewStatus, DailyStatus, LeaveType, Prisma } from "@prisma/client";

export type PuantajState = "READY" | "BLOCKED";

export type PuantajBlockReasonCode =
  | "REVIEW_REQUIRED"
  | "REVIEW_PENDING"
  | "REVIEW_REJECTED";

export type PuantajCode =
  | "NORMAL_WORK"
  | "OVERTIME"
  | "OFF_DAY"
  | "ABSENCE"
  | "LEAVE_ANNUAL"
  | "LEAVE_SICK"
  | "LEAVE_EXCUSED"
  | "LEAVE_UNPAID"
  | "LEAVE_UNKNOWN";

export interface PuantajBlockReason {
  code: PuantajBlockReasonCode;
  detail: string;
}

export interface PuantajDailyRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;

  dayKey: string;

  status: DailyStatus;
  leaveType: LeaveType | null;

  firstIn: string | null;
  lastOut: string | null;

  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;

  anomalies: string[];

  requiresReview: boolean;
  reviewStatus: AttendanceReviewStatus;
  reviewReasons: string[];
  reviewedAt: string | null;
  reviewNote: string | null;

  manualAdjustmentApplied: boolean;
  adjustmentNote: string | null;

  puantajState: PuantajState;
  puantajBlockReasons: PuantajBlockReason[];
  puantajCodes: PuantajCode[];
}

export interface PuantajMonthlyEmployeeSummary {
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

  puantajCodes: PuantajCode[];
  isPayrollReady: boolean;
}

export type PuantajPayrollQuantityUnit = "MINUTES" | "DAYS" | "COUNT";
export type PuantajPayrollQuantityStrategy = "WORKED_MINUTES" | "OVERTIME_MINUTES" | "FIXED_QUANTITY";

export interface PuantajPayrollCodeSummaryRow {
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
}

export interface BuildDailyPuantajRowsParams {
  companyId: string;
  month: string; // YYYY-MM
  tz: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
  payrollMappingProfile?: string;
}