import { prisma } from "@/src/repositories/prisma";

export async function listBreakPlans(companyId: string) {
  return prisma.breakPlan.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ code: "asc" }, { createdAt: "desc" }],
  });
}

export async function listAllBreakPlans(companyId: string) {
  return prisma.breakPlan.findMany({
    where: { companyId },
    orderBy: [{ isActive: "desc" }, { code: "asc" }, { createdAt: "desc" }],
  });
}

export async function findBreakPlanById(companyId: string, id: string) {
  return prisma.breakPlan.findFirst({
    where: { companyId, id },
  });
}

export async function findActiveBreakPlanById(companyId: string, id: string) {
  return prisma.breakPlan.findFirst({
    where: { companyId, id, isActive: true },
  });
}

export async function findBreakPlanByCode(companyId: string, code: string) {
  return prisma.breakPlan.findFirst({
    where: { companyId, code },
  });
}

export async function createBreakPlan(input: {
  companyId: string;
  code: string;
  name: string;
  plannedBreakMinutes: number;
  isPaid: boolean;
}) {
  return prisma.breakPlan.create({
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      plannedBreakMinutes: input.plannedBreakMinutes,
      isPaid: input.isPaid,
      isActive: true,
    },
  });
}

export async function updateBreakPlan(input: {
  companyId: string;
  id: string;
  code: string;
  name: string;
  plannedBreakMinutes: number;
  isPaid: boolean;
}) {
  return prisma.breakPlan.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      plannedBreakMinutes: input.plannedBreakMinutes,
      isPaid: input.isPaid,
    },
  });
}

export async function deactivateBreakPlan(companyId: string, id: string) {
  return prisma.breakPlan.updateMany({
    where: { companyId, id },
    data: { isActive: false },
  });
}

export async function activateBreakPlan(companyId: string, id: string) {
  return prisma.breakPlan.updateMany({
    where: { companyId, id },
    data: { isActive: true },
  });
}

export async function countShiftTemplatesUsingBreakPlan(companyId: string, id: string) {
  return prisma.shiftTemplate.count({
    where: { companyId, breakPlanId: id },
  });
}

export async function hardDeleteBreakPlan(companyId: string, id: string) {
  return prisma.breakPlan.deleteMany({
    where: { companyId, id },
  });
}