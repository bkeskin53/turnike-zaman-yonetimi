import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

export const companyManagementLocationSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  locationGroupId: true,
  createdAt: true,
  updatedAt: true,
  locationGroup: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.BranchSelect;

export type CompanyManagementLocationRecord = Prisma.BranchGetPayload<{
  select: typeof companyManagementLocationSelect;
}>;

export async function listCompanyManagementLocations(input: {
  companyId: string;
  activeOnly?: boolean;
  locationGroupId?: string | null;
}) {
  return prisma.branch.findMany({
    where: {
      companyId: input.companyId,
      ...(input.activeOnly ? { isActive: true } : {}),
      ...(input.locationGroupId ? { locationGroupId: input.locationGroupId } : {}),
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    select: companyManagementLocationSelect,
  });
}

export async function findCompanyManagementLocationById(
  companyId: string,
  id: string,
) {
  return prisma.branch.findFirst({
    where: { companyId, id },
    select: companyManagementLocationSelect,
  });
}

export async function findCompanyManagementLocationByCode(
  companyId: string,
  code: string,
) {
  return prisma.branch.findFirst({
    where: { companyId, code },
    select: companyManagementLocationSelect,
  });
}

export async function createCompanyManagementLocation(input: {
  companyId: string;
  locationGroupId: string;
  code: string;
  name: string;
  isActive?: boolean;
}) {
  return prisma.branch.create({
    data: {
      companyId: input.companyId,
      locationGroupId: input.locationGroupId,
      code: input.code,
      name: input.name,
      isActive: input.isActive ?? true,
    },
    select: companyManagementLocationSelect,
  });
}

export async function updateCompanyManagementLocation(input: {
  companyId: string;
  id: string;
  locationGroupId: string | null;
  code: string;
  name: string;
  isActive: boolean;
}) {
  return prisma.branch.update({
    where: { id: input.id },
    data: {
      locationGroupId: input.locationGroupId,
      code: input.code,
      name: input.name,
      isActive: input.isActive,
    },
    select: companyManagementLocationSelect,
  });
}

export async function deleteCompanyManagementLocation(input: {
  companyId: string;
  id: string;
}) {
  return prisma.branch.delete({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
    select: companyManagementLocationSelect,
  });
}