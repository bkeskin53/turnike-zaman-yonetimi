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
