import type {
  PuantajCode,
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";

export type PayrollCodeMappingProfile = "DEFAULT_TR";

export interface PayrollCodeMappingItem {
  payrollCode: string;
  payrollLabel: string;
  unit: PuantajPayrollQuantityUnit;
  quantityStrategy: PuantajPayrollQuantityStrategy;
  fixedQuantity: number | null;
}

const DEFAULT_TR_MAPPING: Record<PuantajCode, PayrollCodeMappingItem> = {
  NORMAL_WORK: {
    payrollCode: "001",
    payrollLabel: "Normal Çalışma",
    unit: "MINUTES",
    quantityStrategy: "WORKED_MINUTES",
    fixedQuantity: null,
  },
  OVERTIME: {
    payrollCode: "002",
    payrollLabel: "Fazla Mesai",
    unit: "MINUTES",
    quantityStrategy: "OVERTIME_MINUTES",
    fixedQuantity: null,
  },
  OFF_DAY: {
    payrollCode: "090",
    payrollLabel: "Hafta Tatili / Off",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  ABSENCE: {
    payrollCode: "099",
    payrollLabel: "Devamsızlık",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  LEAVE_ANNUAL: {
    payrollCode: "050",
    payrollLabel: "Yıllık İzin",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  LEAVE_SICK: {
    payrollCode: "051",
    payrollLabel: "Rapor",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  LEAVE_EXCUSED: {
    payrollCode: "052",
    payrollLabel: "Mazeret İzni",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  LEAVE_UNPAID: {
    payrollCode: "053",
    payrollLabel: "Ücretsiz İzin",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
  LEAVE_UNKNOWN: {
    payrollCode: "059",
    payrollLabel: "Tanımsız İzin",
    unit: "DAYS",
    quantityStrategy: "FIXED_QUANTITY",
    fixedQuantity: 1,
  },
};

export function getPayrollCodeMappingProfile(value: string | null | undefined): PayrollCodeMappingProfile {
  if (!value) return "DEFAULT_TR";
  if (value === "DEFAULT_TR") return value;
  throw new Error("BAD_PAYROLL_MAPPING_PROFILE");
}

export function resolvePayrollCodeMapping(args: {
  profile: PayrollCodeMappingProfile;
  code: PuantajCode;
}): PayrollCodeMappingItem {
  switch (args.profile) {
    case "DEFAULT_TR":
      return DEFAULT_TR_MAPPING[args.code];
  }
}