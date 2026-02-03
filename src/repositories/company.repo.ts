import type { ExitExceedAction } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

export async function findCompanyById(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: { policy: true },
  });
}

export async function createCompanyWithDefaultPolicy(name: string) {
  return prisma.company.create({
    data: {
      name,
      policy: {
        create: {},
      },
    },
    include: { policy: true },
  });
}

export async function updateCompanyName(id: string, name: string) {
  return prisma.company.update({
    where: { id },
    data: { name },
    include: { policy: true },
  });
}

export async function upsertPolicy(
  companyId: string,
  data: {
    timezone?: string;
    shiftStartMinute?: number;
    shiftEndMinute?: number;
    breakMinutes?: number;
    lateGraceMinutes?: number;
    earlyLeaveGraceMinutes?: number;
    breakAutoDeductEnabled?: boolean;
    offDayEntryBehavior?: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    overtimeEnabled?: boolean;
    
    graceAffectsWorked?: boolean;
    /**
     * Optional grace mode. If provided, controls how grace minutes are treated.
     * ROUND_ONLY: no extra paid grace minutes; PAID_PARTIAL: include grace minutes in worked.
     */
    graceMode?: "ROUND_ONLY" | "PAID_PARTIAL";
    workedCalculationMode?: "ACTUAL" | "CLAMP_TO_SHIFT";
    exitConsumesBreak?: boolean;
    maxSingleExitMinutes?: number;
    maxDailyExitMinutes?: number;
    exitExceedAction?: ExitExceedAction;

    // Behavior for punches on leave days. Reuses OffDayEntryBehavior.
    leaveEntryBehavior?: "IGNORE" | "FLAG" | "COUNT_AS_OT";
  }
) {
  return prisma.companyPolicy.upsert({
    where: { companyId },
    update: data,
    create: {
      companyId,
      ...data,
    },
  });
}
