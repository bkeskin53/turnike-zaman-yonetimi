import { Prisma, ScreenConfigurationFieldKey } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryDisplayConfiguration,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryDisplayConfigurationFieldKey,
  type EmployeeMasterHistoryDisplayResolvedConfiguration,
} from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import {
  mergeEmployeeMasterHistoryDisplayConfigurationOverrides,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "@/src/services/employees/employeeMasterHistoryDisplayConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type EmployeeMasterHistoryDisplayConfigurationWriteFieldInput = {
  fieldKey: string;
  isVisible: boolean;
};

export type EmployeeMasterHistoryDisplayConfigurationWriteInput = {
  screenKey: string;
  fields: EmployeeMasterHistoryDisplayConfigurationWriteFieldInput[];
};

export type EmployeeMasterHistoryDisplayConfigurationMutationErrorCode =
  | "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_VISIBILITY";

export class EmployeeMasterHistoryDisplayConfigurationMutationError extends Error {
  code: EmployeeMasterHistoryDisplayConfigurationMutationErrorCode;

  constructor(
    code: EmployeeMasterHistoryDisplayConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeMasterHistoryDisplayConfigurationMutationError";
    this.code = code;
  }
}

export function isEmployeeMasterHistoryDisplayConfigurationMutationError(
  error: unknown,
): error is EmployeeMasterHistoryDisplayConfigurationMutationError {
  return (
    error instanceof EmployeeMasterHistoryDisplayConfigurationMutationError
  );
}

const EXPECTED_FIELD_KEYS =
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS.map(
    (item) => item.fieldKey,
  );

function normalizeWriteInput(
  input: EmployeeMasterHistoryDisplayConfigurationWriteInput,
): {
  screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  fields: Array<{
    fieldKey: EmployeeMasterHistoryDisplayConfigurationFieldKey;
    prismaFieldKey: ScreenConfigurationFieldKey;
    isVisible: boolean;
  }>;
} {
  let screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    screenKey = toScreenConfigurationScreenKey(input.screenKey);
  } catch {
    throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history display screen key.",
    );
  }

  if (!Array.isArray(input.fields)) {
    throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET",
      "Alan listesi gecersiz.",
    );
  }

  const seen = new Set<EmployeeMasterHistoryDisplayConfigurationFieldKey>();
  const normalized = input.fields.map((item) => {
    let fieldKey: EmployeeMasterHistoryDisplayConfigurationFieldKey;
    try {
      fieldKey =
        item?.fieldKey as EmployeeMasterHistoryDisplayConfigurationFieldKey;
      const prismaFieldKey = toScreenConfigurationFieldKey(item?.fieldKey);
      if (typeof item?.isVisible !== "boolean") {
        throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_VISIBILITY",
          "isVisible yalnizca boolean olabilir.",
        );
      }
      if (seen.has(fieldKey)) {
        throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET",
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
      if (
        error instanceof EmployeeMasterHistoryDisplayConfigurationMutationError
      ) {
        throw error;
      }
      throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
        "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEY",
        "Gecersiz master history display field key.",
      );
    }
  });

  const normalizedKeys = normalized.map((item) => item.fieldKey).sort();
  const expectedKeys = [...EXPECTED_FIELD_KEYS].sort();
  if (
    normalized.length !== expectedKeys.length ||
    normalizedKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_SET",
      "Tam ve gecerli field set gonderilmelidir.",
    );
  }

  return {
    screenKey,
    fields: normalized,
  };
}

export async function saveEmployeeMasterHistoryDisplayConfiguration(args: {
  companyId: string;
  input: EmployeeMasterHistoryDisplayConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryDisplayResolvedConfiguration> {
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

  return mergeEmployeeMasterHistoryDisplayConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryDisplayConfiguration(),
    overrides: fields,
  });
}

export async function resetEmployeeMasterHistoryDisplayConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryDisplayResolvedConfiguration> {
  const screenKey =
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY;
  let prismaScreenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    prismaScreenKey = toScreenConfigurationScreenKey(screenKey);
  } catch {
    throw new EmployeeMasterHistoryDisplayConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history display screen key.",
    );
  }

  const db = args.db ?? prisma;
  await db.screenConfigurationProfile.deleteMany({
    where: {
      companyId: args.companyId,
      screenKey: prismaScreenKey,
    },
  });

  return buildDefaultEmployeeMasterHistoryDisplayConfiguration();
}
