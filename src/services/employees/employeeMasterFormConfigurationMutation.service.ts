import { Prisma, ScreenConfigurationFieldKey } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterFormConfiguration,
  EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterFormConfigurationFieldKey,
  type EmployeeMasterFormResolvedConfiguration,
} from "@/src/features/employees/employeeMasterFormConfiguration";
import {
  mergeEmployeeMasterFormConfigurationOverrides,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "@/src/services/employees/employeeMasterFormConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type EmployeeMasterFormConfigurationWriteFieldInput = {
  fieldKey: string;
  isVisible: boolean;
};

export type EmployeeMasterFormConfigurationWriteInput = {
  screenKey: string;
  fields: EmployeeMasterFormConfigurationWriteFieldInput[];
};

export type EmployeeMasterFormConfigurationMutationErrorCode =
  | "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY"
  | "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEY"
  | "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_SET"
  | "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_VISIBILITY";

export class EmployeeMasterFormConfigurationMutationError extends Error {
  code: EmployeeMasterFormConfigurationMutationErrorCode;

  constructor(
    code: EmployeeMasterFormConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeMasterFormConfigurationMutationError";
    this.code = code;
  }
}

export function isEmployeeMasterFormConfigurationMutationError(
  error: unknown,
): error is EmployeeMasterFormConfigurationMutationError {
  return error instanceof EmployeeMasterFormConfigurationMutationError;
}

const EXPECTED_FIELD_KEYS = EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
  (item) => item.fieldKey,
);

function normalizeWriteInput(
  input: EmployeeMasterFormConfigurationWriteInput,
): {
  screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  fields: Array<{
    fieldKey: EmployeeMasterFormConfigurationFieldKey;
    prismaFieldKey: ScreenConfigurationFieldKey;
    isVisible: boolean;
  }>;
} {
  let screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    screenKey = toScreenConfigurationScreenKey(input.screenKey);
  } catch {
    throw new EmployeeMasterFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master form screen key.",
    );
  }

  if (!Array.isArray(input.fields)) {
    throw new EmployeeMasterFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_SET",
      "Alan listesi gecersiz.",
    );
  }

  const seen = new Set<EmployeeMasterFormConfigurationFieldKey>();
  const normalized = input.fields.map((item) => {
    let fieldKey: EmployeeMasterFormConfigurationFieldKey;
    try {
      fieldKey = item?.fieldKey as EmployeeMasterFormConfigurationFieldKey;
      const prismaFieldKey = toScreenConfigurationFieldKey(item?.fieldKey);
      if (typeof item?.isVisible !== "boolean") {
        throw new EmployeeMasterFormConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_VISIBILITY",
          "isVisible yalnizca boolean olabilir.",
        );
      }
      if (seen.has(fieldKey)) {
        throw new EmployeeMasterFormConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_SET",
          "Ayni fieldKey birden fazla kez gonderilemez.",
        );
      }
      seen.add(fieldKey);
      return {
        fieldKey,
        prismaFieldKey,
        isVisible: item.isVisible,
      };
    } catch (error) {
      if (error instanceof EmployeeMasterFormConfigurationMutationError) {
        throw error;
      }
      throw new EmployeeMasterFormConfigurationMutationError(
        "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEY",
        "Gecersiz master form field key.",
      );
    }
  });

  const normalizedKeys = normalized.map((item) => item.fieldKey).sort();
  const expectedKeys = [...EXPECTED_FIELD_KEYS].sort();
  if (
    normalized.length !== expectedKeys.length ||
    normalizedKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new EmployeeMasterFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_SET",
      "Tam ve gecerli field set gonderilmelidir.",
    );
  }

  return {
    screenKey,
    fields: normalized,
  };
}

export async function saveEmployeeMasterFormConfiguration(args: {
  companyId: string;
  input: EmployeeMasterFormConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<EmployeeMasterFormResolvedConfiguration> {
  const normalized = normalizeWriteInput(args.input);
  const db = args.db ?? prisma;

  const fields = await db.$transaction(async (tx: TxClient) => {
    const profile = await tx.screenConfigurationProfile.upsert({
      where: {
        companyId_screenKey: {
          companyId: args.companyId,
          screenKey: normalized.screenKey,
        },
      },
      create: {
        companyId: args.companyId,
        screenKey: normalized.screenKey,
      },
      update: {},
      select: {
        id: true,
      },
    });

    await tx.screenConfigurationField.deleteMany({
      where: { profileId: profile.id },
    });

    await tx.screenConfigurationField.createMany({
      data: normalized.fields.map((field) => ({
        profileId: profile.id,
        fieldKey: field.prismaFieldKey,
        isVisible: field.isVisible,
      })),
    });

    return normalized.fields.map((field) => ({
      fieldKey: field.fieldKey,
      isVisible: field.isVisible,
    }));
  });

  return mergeEmployeeMasterFormConfigurationOverrides({
    base: buildDefaultEmployeeMasterFormConfiguration(),
    overrides: fields,
  });
}

export async function resetEmployeeMasterFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: typeof prisma;
}): Promise<EmployeeMasterFormResolvedConfiguration> {
  const screenKey = args.screenKey ?? EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY;
  let prismaScreenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    prismaScreenKey = toScreenConfigurationScreenKey(screenKey);
  } catch {
    throw new EmployeeMasterFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master form screen key.",
    );
  }

  const db = args.db ?? prisma;
  await db.screenConfigurationProfile.deleteMany({
    where: {
      companyId: args.companyId,
      screenKey: prismaScreenKey,
    },
  });

  return buildDefaultEmployeeMasterFormConfiguration();
}
