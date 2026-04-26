import { DateTime } from "luxon";
import type { PayrollPeriod, PayrollPeriodStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { buildMonthlyPuantajSummary } from "@/src/services/puantaj/buildMonthlyPuantajSummary";

export type PayrollPeriodReadinessIssueCode =
  | "BLOCKED_DAYS"
  | "REVIEW_REQUIRED"
  | "PENDING_REVIEW"
  | "REJECTED_REVIEW";

export type PayrollPeriodBlockingEmployee = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  blockedDays: number;
  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;
  issues: PayrollPeriodReadinessIssueCode[];
};

export type PayrollPeriodReadiness = {
  month: string;
  employeeCount: number;
  payrollReadyCount: number;
  blockedEmployeeCount: number;
  blockedDayCount: number;
  reviewRequiredDayCount: number;
  pendingReviewDayCount: number;
  rejectedReviewDayCount: number;
  isReadyToPreClose: boolean;
  isReadyToClose: boolean;
  topBlockingEmployees: PayrollPeriodBlockingEmployee[];
};

function assertValidMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("BAD_MONTH");
  }

  const [y, m] = month.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error("BAD_MONTH");
  }
}

function normalizeOptionalNote(note?: string | null) {
  const value = (note ?? "").trim();
  return value.length > 0 ? value : null;
}

function pickIssues(input: {
  blockedDays: number;
  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;
}): PayrollPeriodReadinessIssueCode[] {
  const issues: PayrollPeriodReadinessIssueCode[] = [];
  if (input.blockedDays > 0) issues.push("BLOCKED_DAYS");
  if (input.reviewRequiredDays > 0) issues.push("REVIEW_REQUIRED");
  if (input.pendingReviewDays > 0) issues.push("PENDING_REVIEW");
  if (input.rejectedReviewDays > 0) issues.push("REJECTED_REVIEW");
  return issues;
}

export async function getPayrollPeriod(companyId: string, month: string) {
  assertValidMonth(month);

  return prisma.payrollPeriod.findUnique({
    where: {
      companyId_month: {
        companyId,
        month,
      },
    },
    include: {
      preClosedByUser: {
        select: { id: true, email: true, role: true },
      },
      closedByUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}

export async function getOrCreatePayrollPeriod(companyId: string, month: string) {
  assertValidMonth(month);

  return prisma.payrollPeriod.upsert({
    where: {
      companyId_month: {
        companyId,
        month,
      },
    },
    update: {},
    create: {
      companyId,
      month,
      status: "OPEN",
    },
    include: {
      preClosedByUser: {
        select: { id: true, email: true, role: true },
      },
      closedByUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}

export async function evaluatePayrollPeriodReadiness(args: {
  companyId: string;
  month: string;
  tz: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
}): Promise<PayrollPeriodReadiness> {
  assertValidMonth(args.month);

  const items = await buildMonthlyPuantajSummary({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere,
  });

  const payrollReadyCount = items.filter((x) => x.isPayrollReady).length;
  const blockedEmployeeCount = items.filter((x) => x.blockedDays > 0).length;
  const blockedDayCount = items.reduce((sum, x) => sum + x.blockedDays, 0);
  const reviewRequiredDayCount = items.reduce((sum, x) => sum + x.reviewRequiredDays, 0);
  const pendingReviewDayCount = items.reduce((sum, x) => sum + x.pendingReviewDays, 0);
  const rejectedReviewDayCount = items.reduce((sum, x) => sum + x.rejectedReviewDays, 0);

  const topBlockingEmployees: PayrollPeriodBlockingEmployee[] = items
    .map((item) => ({
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      fullName: item.fullName,
      blockedDays: item.blockedDays,
      reviewRequiredDays: item.reviewRequiredDays,
      pendingReviewDays: item.pendingReviewDays,
      rejectedReviewDays: item.rejectedReviewDays,
      issues: pickIssues({
        blockedDays: item.blockedDays,
        reviewRequiredDays: item.reviewRequiredDays,
        pendingReviewDays: item.pendingReviewDays,
        rejectedReviewDays: item.rejectedReviewDays,
      }),
    }))
    .filter((item) => item.issues.length > 0)
    .sort((a, b) => {
      if (b.blockedDays !== a.blockedDays) return b.blockedDays - a.blockedDays;
      if (b.pendingReviewDays !== a.pendingReviewDays) return b.pendingReviewDays - a.pendingReviewDays;
      if (b.rejectedReviewDays !== a.rejectedReviewDays) return b.rejectedReviewDays - a.rejectedReviewDays;
      if (b.reviewRequiredDays !== a.reviewRequiredDays) return b.reviewRequiredDays - a.reviewRequiredDays;
      const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "tr");
      if (codeCompare !== 0) return codeCompare;
      return a.fullName.localeCompare(b.fullName, "tr");
    })
    .slice(0, 10);

  return {
    month: args.month,
    employeeCount: items.length,
    payrollReadyCount,
    blockedEmployeeCount,
    blockedDayCount,
    reviewRequiredDayCount,
    pendingReviewDayCount,
    rejectedReviewDayCount,
    isReadyToPreClose: true,
    isReadyToClose:
      blockedDayCount === 0 &&
      reviewRequiredDayCount === 0 &&
      pendingReviewDayCount === 0 &&
      rejectedReviewDayCount === 0,
    topBlockingEmployees,
  };
}

export async function setPayrollPeriodPreClosed(args: {
  companyId: string;
  month: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  assertValidMonth(args.month);

  await getOrCreatePayrollPeriod(args.companyId, args.month);

  return prisma.payrollPeriod.update({
    where: {
      companyId_month: {
        companyId: args.companyId,
        month: args.month,
      },
    },
    data: {
      status: "PRE_CLOSED",
      preClosedAt: new Date(),
      preClosedByUserId: args.actorUserId ?? null,
      note: normalizeOptionalNote(args.note),
    },
    include: {
      preClosedByUser: {
        select: { id: true, email: true, role: true },
      },
      closedByUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}

export async function setPayrollPeriodClosed(args: {
  companyId: string;
  month: string;
  tz: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
  actorUserId?: string | null;
  note?: string | null;
}) {
  assertValidMonth(args.month);

  const readiness = await evaluatePayrollPeriodReadiness({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere,
  });

  if (!readiness.isReadyToClose) {
    const error = new Error("PERIOD_NOT_READY_TO_CLOSE");
    (error as Error & { readiness?: PayrollPeriodReadiness }).readiness = readiness;
    throw error;
  }

  const existing = await getOrCreatePayrollPeriod(args.companyId, args.month);
  if (existing.status === "CLOSED") {
    return existing;
  }

  const now = new Date();

  return prisma.payrollPeriod.update({
    where: {
      companyId_month: {
        companyId: args.companyId,
        month: args.month,
      },
    },
    data: {
      status: "CLOSED",
      preClosedAt: existing.preClosedAt ?? now,
      preClosedByUserId: existing.preClosedByUserId ?? (args.actorUserId ?? null),
      closedAt: now,
      closedByUserId: args.actorUserId ?? null,
      note: normalizeOptionalNote(args.note) ?? existing.note ?? null,
    },
    include: {
      preClosedByUser: {
        select: { id: true, email: true, role: true },
      },
      closedByUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}