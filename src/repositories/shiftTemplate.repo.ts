import { prisma } from "@/src/repositories/prisma";

export async function listShiftTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId, isActive: true },
    include: { breakPlan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllShiftTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId },
    include: { breakPlan: true },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function findShiftTemplateById(companyId: string, id: string) {
  return prisma.shiftTemplate.findFirst({
    where: { companyId, id, isActive: true },
    include: { breakPlan: true },
  });
}

export async function findShiftTemplateBySignature(companyId: string, signature: string) {
  return prisma.shiftTemplate.findFirst({
    where: { companyId, signature, isActive: true },
  });
}

export async function createShiftTemplate(input: {
  companyId: string;
  shiftCode: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  plannedWorkMinutes: number;
  breakPlanId?: string | null;
}) {
  return prisma.shiftTemplate.create({
    data: {
      companyId: input.companyId,
      shiftCode: input.shiftCode,
      signature: input.signature,
      startTime: input.startTime,
      endTime: input.endTime,
      spansMidnight: input.spansMidnight,
      plannedWorkMinutes: input.plannedWorkMinutes,
      breakPlanId: input.breakPlanId ?? null,
      isActive: true,
    },
    include: { breakPlan: true },
  });
}
export async function updateShiftTemplate(input: {
  companyId: string;
  id: string;
  signature: string;
  shiftCode?: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  plannedWorkMinutes: number;
  breakPlanId?: string | null;
}) {
  return prisma.shiftTemplate.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      shiftCode: input.shiftCode,
      signature: input.signature,
      startTime: input.startTime,
      endTime: input.endTime,
      spansMidnight: input.spansMidnight,
      plannedWorkMinutes: input.plannedWorkMinutes,
      breakPlanId: input.breakPlanId ?? null,
    },
    include: { breakPlan: true },
  });
}

export async function deactivateShiftTemplate(companyId: string, id: string) {
  return prisma.shiftTemplate.updateMany({
    where: { companyId, id },
    data: { isActive: false },
  });
}

export async function activateShiftTemplate(companyId: string, id: string) {
  return prisma.shiftTemplate.updateMany({
    where: { companyId, id },
    data: { isActive: true },
  });
}