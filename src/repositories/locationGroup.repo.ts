import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

export const locationGroupSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LocationGroupSelect;

export type LocationGroupRecord = Prisma.LocationGroupGetPayload<{
  select: typeof locationGroupSelect;
}>;

export async function listLocationGroups(companyId: string) {
  return prisma.locationGroup.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    select: locationGroupSelect,
  });
}

export async function findLocationGroupById(companyId: string, id: string) {
  return prisma.locationGroup.findFirst({
    where: { id, companyId },
    select: locationGroupSelect,
  });
}

export async function findLocationGroupByCode(companyId: string, code: string) {
  return prisma.locationGroup.findFirst({
    where: { companyId, code },
    select: locationGroupSelect,
  });
}

export async function createLocationGroup(input: {
  companyId: string;
  code: string;
  name: string;
  isActive?: boolean;
}) {
  return prisma.locationGroup.create({
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      isActive: input.isActive ?? true,
    },
    select: locationGroupSelect,
  });
}

export async function updateLocationGroup(input: {
  companyId: string;
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}) {
  return prisma.locationGroup.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      isActive: input.isActive,
    },
    select: locationGroupSelect,
  });
}

export async function deleteLocationGroup(input: {
  companyId: string;
  id: string;
}) {
  return prisma.locationGroup.delete({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
    select: locationGroupSelect,
  });
}