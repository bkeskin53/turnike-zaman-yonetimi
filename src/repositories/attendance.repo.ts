import { prisma } from "@/src/repositories/prisma";
import { DailyStatus } from "@prisma/client";

export async function upsertDailyAttendance(input: {
  companyId: string;
  employeeId: string;
  workDate: Date;

  firstIn: Date | null;
  lastOut: Date | null;

  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  otBreakCount?: number;
  otBreakDeductMinutes?: number;

  lateMinutes: number;
  earlyLeaveMinutes: number;

  status: DailyStatus;
  anomalies: string[];

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
      overtimeMinutes: input.overtimeMinutes,
      overtimeEarlyMinutes: input.overtimeEarlyMinutes,
      overtimeLateMinutes: input.overtimeLateMinutes,
      otBreakCount: input.otBreakCount ?? 0,
      otBreakDeductMinutes: input.otBreakDeductMinutes ?? 0,
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,

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
      overtimeMinutes: input.overtimeMinutes,
      overtimeEarlyMinutes: input.overtimeEarlyMinutes,
      overtimeLateMinutes: input.overtimeLateMinutes,
      otBreakCount: input.otBreakCount ?? 0,
      otBreakDeductMinutes: input.otBreakDeductMinutes ?? 0,
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,
      shiftSource: input.shiftSource ?? null,
      shiftSignature: input.shiftSignature ?? null,
      shiftStartMinute: input.shiftStartMinute ?? null,
      shiftEndMinute: input.shiftEndMinute ?? null,
      shiftSpansMidnight: input.shiftSpansMidnight ?? null,
      computedAt: input.computedAt,
    },
  });
}

export async function listDailyAttendance(companyId: string, workDate: Date) {
  return prisma.dailyAttendance.findMany({
    where: { companyId, workDate },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      workDate: true,

      firstIn: true,
      lastOut: true,

      workedMinutes: true,
      overtimeMinutes: true,
      overtimeEarlyMinutes: true,
      overtimeLateMinutes: true,
      otBreakCount: true,
      otBreakDeductMinutes: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,

      status: true,
      anomalies: true,

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

export async function listDailyAttendanceRange(companyId: string, start: Date, end: Date) {
  return prisma.dailyAttendance.findMany({
    where: {
      companyId,
      workDate: { gte: start, lt: end },
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
    orderBy: [{ employeeId: "asc" }],
  });
}
