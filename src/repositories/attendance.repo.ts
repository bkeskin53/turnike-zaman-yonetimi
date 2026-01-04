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

  lateMinutes: number;
  earlyLeaveMinutes: number;

  status: DailyStatus;
  anomalies: string[];

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
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,
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
      lateMinutes: input.lateMinutes,
      earlyLeaveMinutes: input.earlyLeaveMinutes,
      status: input.status,
      anomalies: input.anomalies,
      computedAt: input.computedAt,
    },
  });
}

export async function listDailyAttendance(companyId: string, workDate: Date) {
  return prisma.dailyAttendance.findMany({
    where: { companyId, workDate },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true } },
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
