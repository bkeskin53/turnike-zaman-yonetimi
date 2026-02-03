import { prisma } from "@/src/repositories/prisma";

export async function listShiftTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllShiftTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function findShiftTemplateById(companyId: string, id: string) {
  return prisma.shiftTemplate.findFirst({
    where: { companyId, id, isActive: true },
  });
}

export async function findShiftTemplateBySignature(companyId: string, signature: string) {
  return prisma.shiftTemplate.findFirst({
    where: { companyId, signature, isActive: true },
  });
}

export async function createShiftTemplate(input: {
  companyId: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
}) {
  return prisma.shiftTemplate.create({
    data: {
      companyId: input.companyId,
      signature: input.signature,
      startTime: input.startTime,
      endTime: input.endTime,
      spansMidnight: input.spansMidnight,
      isActive: true,
    },
  });
}
export async function updateShiftTemplate(input: {
  companyId: string;
  id: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
}) {
  return prisma.shiftTemplate.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      signature: input.signature,
      startTime: input.startTime,
      endTime: input.endTime,
      spansMidnight: input.spansMidnight,
    },
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