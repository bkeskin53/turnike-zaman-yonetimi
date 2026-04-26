import { prisma } from "@/src/repositories/prisma";
import {
  getDefaultPayrollCodeMappingProfile,
  getPayrollCodeMappingProfileByCode,
  getPayrollCodeMappingProfileResolved,
  type PayrollCodeMappingDbProfile,
} from "@/src/services/puantaj/payrollCodeMappingDb.service";
import {
  getPayrollCodeMappingProfile,
  resolvePayrollCodeMapping,
  type PayrollCodeMappingProfile,
} from "@/src/services/puantaj/payrollCodeMappings";
import type { PuantajCode, PuantajPayrollQuantityStrategy, PuantajPayrollQuantityUnit } from "@/src/services/puantaj/types";

export type ResolvedPayrollCodeMappingItem = {
  puantajCode: PuantajCode;
  payrollCode: string;
  payrollLabel: string;
  unit: PuantajPayrollQuantityUnit;
  quantityStrategy: PuantajPayrollQuantityStrategy;
  fixedQuantity: number | null;
  sortOrder: number;
  source: "DB" | "FILE";
};

export type ResolvedPayrollCodeMappingProfile = {
  code: string;
  name: string;
  source: "DB" | "FILE";
  isDefault?: boolean;
  isActive?: boolean;
  items: ResolvedPayrollCodeMappingItem[];
};

const VALID_PUANTAJ_CODES: PuantajCode[] = [
  "NORMAL_WORK",
  "OVERTIME",
  "OFF_DAY",
  "ABSENCE",
  "LEAVE_ANNUAL",
  "LEAVE_SICK",
  "LEAVE_EXCUSED",
  "LEAVE_UNPAID",
  "LEAVE_UNKNOWN",
];

function toResolvedDbProfile(profile: PayrollCodeMappingDbProfile): ResolvedPayrollCodeMappingProfile {
  return {
    code: profile.code,
    name: profile.name,
    source: "DB",
    isDefault: profile.isDefault,
    isActive: profile.isActive,
    items: profile.items.map((item) => ({
      puantajCode: item.puantajCode,
      payrollCode: item.payrollCode,
      payrollLabel: item.payrollLabel,
      unit: item.unit,
      quantityStrategy: item.quantityStrategy,
      fixedQuantity: item.fixedQuantity,
      sortOrder: item.sortOrder,
      source: "DB",
    })),
  };
}

function toResolvedFileProfile(code: PayrollCodeMappingProfile): ResolvedPayrollCodeMappingProfile {
  const normalizedCode = getPayrollCodeMappingProfile(code);

  return {
    code: normalizedCode,
    name: normalizedCode,
    source: "FILE",
    isDefault: normalizedCode === "DEFAULT_TR",
    isActive: true,
    items: VALID_PUANTAJ_CODES.map((puantajCode, index) => {
      const item = resolvePayrollCodeMapping({
        profile: normalizedCode,
        code: puantajCode,
      });

      return {
        puantajCode,
        payrollCode: item.payrollCode,
        payrollLabel: item.payrollLabel,
        unit: item.unit,
        quantityStrategy: item.quantityStrategy,
        fixedQuantity: item.fixedQuantity,
        sortOrder: index,
        source: "FILE" as const,
      };
    }),
  };
}

export async function bootstrapPayrollCodeMappingProfileFromFile(args: {
  companyId: string;
  code: PayrollCodeMappingProfile;
  name?: string | null;
  markAsDefault?: boolean;
}) {
  const existing = await getPayrollCodeMappingProfileByCode({
    companyId: args.companyId,
    code: args.code,
    activeOnly: false,
  });

  if (existing) {
    return existing;
  }

  const fileProfile = toResolvedFileProfile(args.code);

  return prisma.$transaction(async (tx) => {
    if (args.markAsDefault) {
      await tx.payrollCodeMappingProfile.updateMany({
        where: {
          companyId: args.companyId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const profile = await tx.payrollCodeMappingProfile.create({
      data: {
        companyId: args.companyId,
        code: fileProfile.code,
        name: (args.name ?? "").trim() || fileProfile.name,
        isDefault: !!args.markAsDefault,
        isActive: true,
        items: {
          create: fileProfile.items.map((item) => ({
            puantajCode: item.puantajCode,
            payrollCode: item.payrollCode,
            payrollLabel: item.payrollLabel,
            unit: item.unit,
            quantityStrategy: item.quantityStrategy,
            fixedQuantity: item.fixedQuantity,
            sortOrder: item.sortOrder,
            isActive: true,
          })),
        },
      },
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
        },
      },
    });

    return {
      id: profile.id,
      companyId: profile.companyId,
      code: profile.code,
      name: profile.name,
      isDefault: profile.isDefault,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      items: profile.items.map((item) => ({
        id: item.id,
        puantajCode: item.puantajCode as PuantajCode,
        payrollCode: item.payrollCode,
        payrollLabel: item.payrollLabel,
        unit: item.unit === "MINUTES" ? "MINUTES" : item.unit === "COUNT" ? "COUNT" : "DAYS",
        quantityStrategy: item.quantityStrategy as PuantajPayrollQuantityStrategy,
        fixedQuantity: item.fixedQuantity == null ? null : Number(item.fixedQuantity),
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })),
    } satisfies PayrollCodeMappingDbProfile;
  });
}

export async function ensureDefaultPayrollCodeMappingProfileSeeded(companyId: string) {
  const existingDefault = await getDefaultPayrollCodeMappingProfile({
    companyId,
    activeOnly: false,
  });

  if (existingDefault) {
    return existingDefault;
  }

  return bootstrapPayrollCodeMappingProfileFromFile({
    companyId,
    code: "DEFAULT_TR",
    name: "Default TR",
    markAsDefault: true,
  });
}

export async function resolvePayrollCodeMappingProfile(args: {
  companyId: string;
  code?: string | null;
  autoSeedDefault?: boolean;
}) {
  if (args.autoSeedDefault) {
    await ensureDefaultPayrollCodeMappingProfileSeeded(args.companyId);
  }

  const dbProfile = await getPayrollCodeMappingProfileResolved({
    companyId: args.companyId,
    code: args.code,
    activeOnly: true,
  });

  if (dbProfile) {
    return toResolvedDbProfile(dbProfile);
  }

  const fallbackCode = (String(args.code ?? "").trim() || "DEFAULT_TR") as PayrollCodeMappingProfile;
  return toResolvedFileProfile(fallbackCode);
}

export async function resolvePayrollCodeMappingItemsIndex(args: {
  companyId: string;
  code?: string | null;
  autoSeedDefault?: boolean;
}) {
  const profile = await resolvePayrollCodeMappingProfile(args);
  const map = new Map<PuantajCode, ResolvedPayrollCodeMappingItem>();

  for (const item of profile.items) {
    map.set(item.puantajCode, item);
  }

  return {
    profile,
    itemsByCode: map,
  };
}

export async function listResolvedPayrollCodeMappingProfiles(companyId: string) {
  const dbProfiles = await prisma.payrollCodeMappingProfile.findMany({
    where: { companyId },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
      },
    },
    orderBy: [
      { isDefault: "desc" },
      { isActive: "desc" },
      { createdAt: "asc" },
      { code: "asc" },
    ],
  });

  if (dbProfiles.length > 0) {
    return dbProfiles.map((profile) =>
      toResolvedDbProfile({
        id: profile.id,
        companyId: profile.companyId,
        code: profile.code,
        name: profile.name,
        isDefault: profile.isDefault,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        items: profile.items.map((item) => ({
          id: item.id,
          puantajCode: item.puantajCode as PuantajCode,
          payrollCode: item.payrollCode,
          payrollLabel: item.payrollLabel,
          unit: item.unit === "MINUTES" ? "MINUTES" : item.unit === "COUNT" ? "COUNT" : "DAYS",
          quantityStrategy: item.quantityStrategy as PuantajPayrollQuantityStrategy,
          fixedQuantity: item.fixedQuantity == null ? null : Number(item.fixedQuantity),
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        })),
      })
    );
  }

  return [toResolvedFileProfile("DEFAULT_TR")];
}

export async function getResolvedPayrollCodeMappingProfileExact(args: {
  companyId: string;
  code: string;
}) {
  const code = String(args.code ?? "").trim();
  if (!code) return null;

  const dbProfile = await getPayrollCodeMappingProfileByCode({
    companyId: args.companyId,
    code,
    activeOnly: false,
  });

  if (dbProfile) {
    return toResolvedDbProfile(dbProfile);
  }

  try {
    const normalizedCode = getPayrollCodeMappingProfile(code);
    return toResolvedFileProfile(normalizedCode);
  } catch {
    return null;
  }
}