import { prisma } from "@/src/repositories/prisma";
import type {
  PuantajCode,
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";

export type PayrollCodeMappingDbUnit = PuantajPayrollQuantityUnit;
export type PayrollCodeMappingDbQuantityStrategy = PuantajPayrollQuantityStrategy;

export type PayrollCodeMappingDbItem = {
  id: string;
  puantajCode: PuantajCode;
  payrollCode: string;
  payrollLabel: string;
  unit: PayrollCodeMappingDbUnit;
  quantityStrategy: PayrollCodeMappingDbQuantityStrategy;
  fixedQuantity: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type PayrollCodeMappingDbProfile = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: PayrollCodeMappingDbItem[];
};

type RawPayrollCodeMappingRowItem = {
  id: string;
  puantajCode: string;
  payrollCode: string;
  payrollLabel: string;
  unit: string;
  quantityStrategy: string;
  fixedQuantity: any;
  sortOrder: number;
  isActive: boolean;
};

type RawPayrollCodeMappingRowProfile = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: RawPayrollCodeMappingRowItem[];
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

function isPuantajCode(value: string): value is PuantajCode {
  return VALID_PUANTAJ_CODES.includes(value as PuantajCode);
}

function hasValidPuantajCode(
  item: RawPayrollCodeMappingRowItem
): item is RawPayrollCodeMappingRowItem & { puantajCode: PuantajCode } {
  return isPuantajCode(item.puantajCode);
}

function toUnit(value: string): PayrollCodeMappingDbUnit {
  if (value === "MINUTES") return "MINUTES";
  if (value === "COUNT") return "COUNT";
  return "DAYS";
}

function toQuantityStrategy(value: string): PayrollCodeMappingDbQuantityStrategy {
  switch (value) {
    case "WORKED_MINUTES":
      return "WORKED_MINUTES";
    case "OVERTIME_MINUTES":
      return "OVERTIME_MINUTES";
    case "FIXED_QUANTITY":
    default:
      return "FIXED_QUANTITY";
  }
}

function toFixedQuantity(value: any): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeFixedQuantityNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function requiresFixedQuantity(strategy: PayrollCodeMappingDbQuantityStrategy) {
  return strategy === "FIXED_QUANTITY";
}

function mapProfile(profile: RawPayrollCodeMappingRowProfile): PayrollCodeMappingDbProfile {
  return {
    id: profile.id,
    companyId: profile.companyId,
    code: profile.code,
    name: profile.name,
    isDefault: profile.isDefault,
    isActive: profile.isActive,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    items: profile.items
      .filter(hasValidPuantajCode)
      .map((item): PayrollCodeMappingDbItem => ({
        id: item.id,
        puantajCode: item.puantajCode,
        payrollCode: item.payrollCode,
        payrollLabel: item.payrollLabel,
        unit: toUnit(item.unit),
        quantityStrategy: toQuantityStrategy(item.quantityStrategy),
        fixedQuantity: toFixedQuantity(item.fixedQuantity),
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })),
  };
}

export async function listPayrollCodeMappingProfiles(companyId: string) {
  const rows = await prisma.payrollCodeMappingProfile.findMany({
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

  return rows.map(mapProfile);
}

export async function getPayrollCodeMappingProfileByCode(args: {
  companyId: string;
  code: string;
  activeOnly?: boolean;
}) {
  const code = String(args.code ?? "").trim();
  if (!code) return null;

  const row = await prisma.payrollCodeMappingProfile.findFirst({
    where: {
      companyId: args.companyId,
      code,
      ...(args.activeOnly === false ? {} : { isActive: true }),
    },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
      },
    },
  });

  return row ? mapProfile(row) : null;
}

export async function getDefaultPayrollCodeMappingProfile(args: {
  companyId: string;
  activeOnly?: boolean;
}) {
  const row = await prisma.payrollCodeMappingProfile.findFirst({
    where: {
      companyId: args.companyId,
      isDefault: true,
      ...(args.activeOnly === false ? {} : { isActive: true }),
    },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
  });

  return row ? mapProfile(row) : null;
}

export async function getPayrollCodeMappingProfileResolved(args: {
  companyId: string;
  code?: string | null;
  activeOnly?: boolean;
}) {
  const requestedCode = String(args.code ?? "").trim();

  if (requestedCode) {
    const exact = await getPayrollCodeMappingProfileByCode({
      companyId: args.companyId,
      code: requestedCode,
      activeOnly: args.activeOnly,
    });
    if (exact) return exact;
  }

  const defaultProfile = await getDefaultPayrollCodeMappingProfile({
    companyId: args.companyId,
    activeOnly: args.activeOnly,
  });

  if (defaultProfile) return defaultProfile;

  return null;
}

export function indexPayrollCodeMappingItems(
  profile: PayrollCodeMappingDbProfile | null
) {
  const map = new Map<PuantajCode, PayrollCodeMappingDbItem>();

  for (const item of profile?.items ?? []) {
    if (!item.isActive) continue;
    map.set(item.puantajCode, item);
  }

  return map;
}

function normalizeProfileCode(value: string) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,50}$/.test(code)) {
    throw new Error("BAD_PROFILE_CODE");
  }
  return code;
}

function normalizeProfileName(value: string) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 200) {
    throw new Error("BAD_PROFILE_NAME");
  }
  return name;
}

function normalizePayrollCode(value: string) {
  const payrollCode = String(value ?? "").trim();
  if (!payrollCode || payrollCode.length > 50) {
    throw new Error("BAD_PAYROLL_CODE");
  }
  return payrollCode;
}

function normalizePayrollLabel(value: string) {
  const payrollLabel = String(value ?? "").trim();
  if (!payrollLabel || payrollLabel.length > 200) {
    throw new Error("BAD_PAYROLL_LABEL");
  }
  return payrollLabel;
}

function normalizeSortOrder(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function normalizeUnit(value: string): PayrollCodeMappingDbUnit {
  if (value === "MINUTES") return "MINUTES";
  if (value === "COUNT") return "COUNT";
  return "DAYS";
}

function normalizeQuantityStrategy(value: string): PayrollCodeMappingDbQuantityStrategy {
  switch (value) {
    case "WORKED_MINUTES":
      return "WORKED_MINUTES";
    case "OVERTIME_MINUTES":
      return "OVERTIME_MINUTES";
    case "FIXED_QUANTITY":
      return "FIXED_QUANTITY";
    default:
      throw new Error("BAD_QUANTITY_STRATEGY");
  }
}

function normalizeFixedQuantity(
  value: unknown,
  strategy: PayrollCodeMappingDbQuantityStrategy
): number | null {
  if (!requiresFixedQuantity(strategy)) {
    return null;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("BAD_FIXED_QUANTITY");
  }
  return normalizeFixedQuantityNumber(n);
}

export async function createPayrollCodeMappingProfile(args: {
  companyId: string;
  code: string;
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
}) {
  const code = normalizeProfileCode(args.code);
  const name = normalizeProfileName(args.name);
  const isDefault = !!args.isDefault;
  const isActive = args.isActive ?? true;

  const existing = await prisma.payrollCodeMappingProfile.findFirst({
    where: {
      companyId: args.companyId,
      code,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("PROFILE_CODE_ALREADY_EXISTS");
  }

  const row = await prisma.$transaction(async (tx) => {
    if (isDefault) {
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

    return tx.payrollCodeMappingProfile.create({
      data: {
        companyId: args.companyId,
        code,
        name,
        isDefault,
        isActive,
      },
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
        },
      },
    });
  });

  return mapProfile(row);
}

export async function updatePayrollCodeMappingProfile(args: {
  companyId: string;
  code: string;
  name?: string;
  isActive?: boolean;
}) {
  const code = normalizeProfileCode(args.code);
  const data: {
    name?: string;
    isActive?: boolean;
  } = {};

  if (args.name !== undefined) {
    data.name = normalizeProfileName(args.name);
  }
  if (args.isActive !== undefined) {
    data.isActive = !!args.isActive;
  }

  const row = await prisma.payrollCodeMappingProfile.update({
    where: {
      companyId_code: {
        companyId: args.companyId,
        code,
      },
    },
    data,
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
      },
    },
  });

  return mapProfile(row);
}

export async function setDefaultPayrollCodeMappingProfile(args: {
  companyId: string;
  code: string;
}) {
  const code = normalizeProfileCode(args.code);

  const row = await prisma.$transaction(async (tx) => {
    await tx.payrollCodeMappingProfile.updateMany({
      where: {
        companyId: args.companyId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    return tx.payrollCodeMappingProfile.update({
      where: {
        companyId_code: {
          companyId: args.companyId,
          code,
        },
      },
      data: {
        isDefault: true,
        isActive: true,
      },
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
        },
      },
    });
  });

  return mapProfile(row);
}

export async function setPayrollCodeMappingProfileActive(args: {
  companyId: string;
  code: string;
  isActive: boolean;
}) {
  const code = normalizeProfileCode(args.code);

  const row = await prisma.payrollCodeMappingProfile.update({
    where: {
      companyId_code: {
        companyId: args.companyId,
        code,
      },
    },
    data: {
      isActive: !!args.isActive,
    },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { payrollCode: "asc" }, { puantajCode: "asc" }],
      },
    },
  });

  return mapProfile(row);
}

export async function upsertPayrollCodeMappingItem(args: {
  companyId: string;
  profileCode: string;
  puantajCode: PuantajCode;
  payrollCode: string;
  payrollLabel: string;
  unit: PayrollCodeMappingDbUnit;
  quantityStrategy: PayrollCodeMappingDbQuantityStrategy;
  fixedQuantity?: number | null;
  sortOrder?: number | null;
  isActive?: boolean;
}) {
  const profileCode = normalizeProfileCode(args.profileCode);
  const payrollCode = normalizePayrollCode(args.payrollCode);
  const payrollLabel = normalizePayrollLabel(args.payrollLabel);
  const unit = normalizeUnit(args.unit);
  const quantityStrategy = normalizeQuantityStrategy(args.quantityStrategy);
  const fixedQuantity = normalizeFixedQuantity(args.fixedQuantity, quantityStrategy);
  const sortOrder = normalizeSortOrder(args.sortOrder);
  const isActive = args.isActive ?? true;

  const profile = await prisma.payrollCodeMappingProfile.findUnique({
    where: {
      companyId_code: {
        companyId: args.companyId,
        code: profileCode,
      },
    },
    select: {
      id: true,
    },
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  await prisma.payrollCodeMappingItem.upsert({
    where: {
      profileId_puantajCode: {
        profileId: profile.id,
        puantajCode: args.puantajCode,
      },
    },
    update: {
      payrollCode,
      payrollLabel,
      unit,
      quantityStrategy,
      fixedQuantity,
      sortOrder,
      isActive,
    },
    create: {
      profileId: profile.id,
      puantajCode: args.puantajCode,
      payrollCode,
      payrollLabel,
      unit,
      quantityStrategy,
      fixedQuantity,
      sortOrder,
      isActive,
    },
  });

  return getPayrollCodeMappingProfileByCode({
    companyId: args.companyId,
    code: profileCode,
    activeOnly: false,
  });
}

export async function deactivatePayrollCodeMappingItem(args: {
  companyId: string;
  profileCode: string;
  puantajCode: PuantajCode;
}) {
  const profileCode = normalizeProfileCode(args.profileCode);

  const profile = await prisma.payrollCodeMappingProfile.findUnique({
    where: {
      companyId_code: {
        companyId: args.companyId,
        code: profileCode,
      },
    },
    select: {
      id: true,
    },
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  await prisma.payrollCodeMappingItem.update({
    where: {
      profileId_puantajCode: {
        profileId: profile.id,
        puantajCode: args.puantajCode,
      },
    },
    data: {
      isActive: false,
    },
  });

  return getPayrollCodeMappingProfileByCode({
    companyId: args.companyId,
    code: profileCode,
    activeOnly: false,
  });
}