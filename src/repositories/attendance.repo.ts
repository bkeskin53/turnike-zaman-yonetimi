import { prisma } from "@/src/repositories/prisma";
import { AttendanceReviewStatus, DailyStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

export async function upsertDailyAttendance(input: {
  companyId: string;
  employeeId: string;
  workDate: Date;

  firstIn: Date | null;
  lastOut: Date | null;

  workedMinutes: number;
  scheduledWorkedMinutes?: number;
  unscheduledWorkedMinutes?: number;
  overtimeMinutes: number;
  scheduledOvertimeMinutes?: number;
  unscheduledOvertimeMinutes?: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakCount?: number;
  otBreakDeductMinutes?: number;

  lateMinutes: number;
  earlyLeaveMinutes: number;

  status: DailyStatus;
  anomalies: string[];
  anomalyMeta?: Prisma.InputJsonValue | null;
  requiresReview?: boolean;
  reviewReasons?: string[];
  reviewStatus?: AttendanceReviewStatus;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
  reviewNote?: string | null;

  shiftSource?: string | null;
  shiftSignature?: string | null;
  shiftStartMinute?: number | null;
  shiftEndMinute?: number | null;
  shiftSpansMidnight?: boolean | null;

  computedAt: Date;
}) {
  return prisma.dailyAttendance.upsert({
    where: {
      companyId_employeeId_workDate: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        workDate: input.workDate,
      },
    },
    update: {
      firstIn: input.firstIn,
      lastOut: input.lastOut,
      workedMinutes: input.workedMinutes,
      scheduledWorkedMinutes: input.scheduledWorkedMinutes ?? 0,
      unscheduledWorkedMinutes: input.unscheduledWorkedMinutes ?? 0,
      overtimeMinutes: input.overtimeMinutes,
      scheduledOvertimeMinutes: input.scheduledOvertimeMinutes ?? 0,
      unscheduledOvertimeMinutes: input.unscheduledOvertimeMinutes ?? 0,
      overtimeEarlyMinutes: input.overtimeEarlyMinutes,
      overtimeLateMinutes: input.overtimeLateMinutes,
      otBreakCount: input.otBreakCount ?? 0,
      otBreakDeductMinutes: input.otBreakDeductMinutes ?? 0,
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,
      anomalyMeta: input.anomalyMeta ?? Prisma.JsonNull,
      requiresReview: input.requiresReview ?? false,
      reviewReasons: input.reviewReasons ?? [],
      reviewStatus: input.reviewStatus ?? (input.requiresReview ? "PENDING" : "NONE"),
      reviewedAt: input.reviewedAt ?? null,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewNote: input.reviewNote ?? null,

      shiftSource: input.shiftSource ?? null,
      shiftSignature: input.shiftSignature ?? null,
      shiftStartMinute: input.shiftStartMinute ?? null,
      shiftEndMinute: input.shiftEndMinute ?? null,
      shiftSpansMidnight: input.shiftSpansMidnight ?? null,
      computedAt: input.computedAt,
    },
    create: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      workDate: input.workDate,
      firstIn: input.firstIn,
      lastOut: input.lastOut,
      workedMinutes: input.workedMinutes,
      scheduledWorkedMinutes: input.scheduledWorkedMinutes ?? 0,
      unscheduledWorkedMinutes: input.unscheduledWorkedMinutes ?? 0,
      overtimeMinutes: input.overtimeMinutes,
      scheduledOvertimeMinutes: input.scheduledOvertimeMinutes ?? 0,
      unscheduledOvertimeMinutes: input.unscheduledOvertimeMinutes ?? 0,
      overtimeEarlyMinutes: input.overtimeEarlyMinutes,
      overtimeLateMinutes: input.overtimeLateMinutes,
      otBreakCount: input.otBreakCount ?? 0,
      otBreakDeductMinutes: input.otBreakDeductMinutes ?? 0,
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,
      anomalyMeta: input.anomalyMeta ?? Prisma.JsonNull,
      requiresReview: input.requiresReview ?? false,
      reviewReasons: input.reviewReasons ?? [],
      reviewStatus: input.reviewStatus ?? (input.requiresReview ? "PENDING" : "NONE"),
      reviewedAt: input.reviewedAt ?? null,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewNote: input.reviewNote ?? null,

      shiftSource: input.shiftSource ?? null,
      shiftSignature: input.shiftSignature ?? null,
      shiftStartMinute: input.shiftStartMinute ?? null,
      shiftEndMinute: input.shiftEndMinute ?? null,
      shiftSpansMidnight: input.shiftSpansMidnight ?? null,
      computedAt: input.computedAt,
    },
  });
}

export async function listDailyAttendance(
  companyId: string,
  workDate: Date,
  employeeWhere?: Prisma.EmployeeWhereInput | null
) {
  return prisma.dailyAttendance.findMany({
    where: {
      companyId,
      workDate,
      ...(employeeWhere ? { employee: employeeWhere } : {}),
    },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      workDate: true,

      firstIn: true,
      lastOut: true,

      workedMinutes: true,
      scheduledWorkedMinutes: true,
      unscheduledWorkedMinutes: true,
      overtimeMinutes: true,
      scheduledOvertimeMinutes: true,
      unscheduledOvertimeMinutes: true,
      overtimeEarlyMinutes: true,
      overtimeLateMinutes: true,
      otBreakCount: true,
      otBreakDeductMinutes: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,

      status: true,
      anomalies: true,
      anomalyMeta: true,
      requiresReview: true,
      reviewReasons: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedByUserId: true,
      reviewNote: true,

      // Sales-safety: persist & always fetch engine-used shift meta
      shiftSource: true,
      shiftSignature: true,
      shiftStartMinute: true,
      shiftEndMinute: true,
      shiftSpansMidnight: true,

      computedAt: true,

      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ employee: { employeeCode: "asc" } }],
  });
}

export async function listDailyAttendanceRange(
  companyId: string,
  start: Date,
  end: Date,
  employeeWhere?: Prisma.EmployeeWhereInput | null
) {
  return prisma.dailyAttendance.findMany({
    where: {
      companyId,
      workDate: { gte: start, lt: end },
      ...(employeeWhere ? { employee: employeeWhere } : {}),
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
    orderBy: [{ employeeId: "asc" }],
  });
}

export async function updateDailyAttendanceReview(input: {
  id: string;
  companyId: string;
  reviewStatus: AttendanceReviewStatus;
  reviewedAt: Date | null;
  reviewedByUserId?: string | null;
  reviewNote?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyAttendance.findFirst({
      where: {
        id: input.id,
        companyId: input.companyId,
      },
      select: {
        id: true,
        companyId: true,
        employeeId: true,
        workDate: true,
        reviewStatus: true,
        reviewNote: true,
      },
    });

    if (!existing) {
      throw new Error("DAILY_ATTENDANCE_NOT_FOUND");
    }

    const updated = await tx.dailyAttendance.update({
      where: {
        id: input.id,
      },
      data: {
        reviewStatus: input.reviewStatus,
        reviewedAt: input.reviewedAt,
        reviewedByUserId: input.reviewedByUserId ?? null,
        reviewNote: input.reviewNote ?? null,
      },
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewedByUserId: true,
        reviewNote: true,
      },
    });

    await tx.dailyAttendanceReviewLog.create({
      data: {
        companyId: input.companyId,
        dailyAttendanceId: input.id,
        fromStatus: existing.reviewStatus ?? null,
        toStatus: input.reviewStatus,
        actedByUserId: input.reviewedByUserId ?? null,
        note: input.reviewNote ?? null,
      },
    });

    return {
      ...updated,
      previousReviewStatus: existing.reviewStatus ?? null,
      previousReviewNote: existing.reviewNote ?? null,
    };
  });
}

export async function findDailyAttendanceByKey(input: {
  companyId: string;
  employeeId: string;
  workDate: Date;
}) {
  return prisma.dailyAttendance.findUnique({
    where: {
      companyId_employeeId_workDate: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        workDate: input.workDate,
      },
    },
    select: {
      id: true,
      status: true,
      firstIn: true,
      lastOut: true,
      workedMinutes: true,
      scheduledWorkedMinutes: true,
      unscheduledWorkedMinutes: true,
      overtimeMinutes: true,
      scheduledOvertimeMinutes: true,
      unscheduledOvertimeMinutes: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,
      anomalies: true,
      anomalyMeta: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedByUserId: true,
      reviewNote: true,
    },
  });
}

export async function listDailyAttendanceReviewLogs(input: {
  companyId: string;
  dailyAttendanceId: string;
}) {
  return prisma.dailyAttendanceReviewLog.findMany({
    where: {
      companyId: input.companyId,
      dailyAttendanceId: input.dailyAttendanceId,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      actedByUserId: true,
      note: true,
      createdAt: true,
    },
  });
}