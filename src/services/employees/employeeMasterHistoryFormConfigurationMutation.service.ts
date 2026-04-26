import { Prisma, ScreenConfigurationFieldKey } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryFormConfiguration,
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryFormConfigurationFieldKey,
  type EmployeeMasterHistoryFormResolvedConfiguration,
} from "@/src/features/employees/employeeMasterHistoryFormConfiguration";
import {
  mergeEmployeeMasterHistoryFormConfigurationOverrides,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "@/src/services/employees/employeeMasterHistoryFormConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type EmployeeMasterHistoryFormConfigurationWriteFieldInput = {
  fieldKey: string;
  isVisible: boolean;
};

export type EmployeeMasterHistoryFormConfigurationWriteInput = {
  screenKey: string;
  fields: EmployeeMasterHistoryFormConfigurationWriteFieldInput[];
};

export type EmployeeMasterHistoryFormConfigurationMutationErrorCode =
  | "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_SET"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_VISIBILITY";

export class EmployeeMasterHistoryFormConfigurationMutationError extends Error {
  code: EmployeeMasterHistoryFormConfigurationMutationErrorCode;

  constructor(
    code: EmployeeMasterHistoryFormConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeMasterHistoryFormConfigurationMutationError";
    this.code = code;
  }
}

export function isEmployeeMasterHistoryFormConfigurationMutationError(
  error: unknown,
): error is EmployeeMasterHistoryFormConfigurationMutationError {
  return error instanceof EmployeeMasterHistoryFormConfigurationMutationError;
}

const EXPECTED_FIELD_KEYS =
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
    (item) => item.fieldKey,
  );

function normalizeWriteInput(
  input: EmployeeMasterHistoryFormConfigurationWriteInput,
): {
  screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  fields: Array<{
    fieldKey: EmployeeMasterHistoryFormConfigurationFieldKey;
    prismaFieldKey: ScreenConfigurationFieldKey;
    isVisible: boolean;
  }>;
} {
  let screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    screenKey = toScreenConfigurationScreenKey(input.screenKey);
  } catch {
    throw new EmployeeMasterHistoryFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history form screen key.",
    );
  }

  if (!Array.isArray(input.fields)) {
    throw new EmployeeMasterHistoryFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_SET",
      "Alan listesi gecersiz.",
    );
  }

  const seen = new Set<EmployeeMasterHistoryFormConfigurationFieldKey>();
  const normalized = input.fields.map((item) => {
    let fieldKey: EmployeeMasterHistoryFormConfigurationFieldKey;
    try {
      fieldKey = item?.fieldKey as EmployeeMasterHistoryFormConfigurationFieldKey;
      const prismaFieldKey = toScreenConfigurationFieldKey(item?.fieldKey);
      if (typeof item?.isVisible !== "boolean") {
        throw new EmployeeMasterHistoryFormConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_VISIBILITY",
          "isVisible yalnizca boolean olabilir.",
        );
      }
      if (seen.has(fieldKey)) {
        throw new EmployeeMasterHistoryFormConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_SET",
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
        error instanceof EmployeeMasterHistoryFormConfigurationMutationError
      ) {
        throw error;
      }
      throw new EmployeeMasterHistoryFormConfigurationMutationError(
        "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEY",
        "Gecersiz master history form field key.",
      );
    }
  });

  const normalizedKeys = normalized.map((item) => item.fieldKey).sort();
  const expectedKeys = [...EXPECTED_FIELD_KEYS].sort();
  if (
    normalized.length !== expectedKeys.length ||
    normalizedKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new EmployeeMasterHistoryFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_SET",
      "Tam ve gecerli field set gonderilmelidir.",
    );
  }

  return {
    screenKey,
    fields: normalized,
  };
}

export async function saveEmployeeMasterHistoryFormConfiguration(args: {
  companyId: string;
  input: EmployeeMasterHistoryFormConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryFormResolvedConfiguration> {
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

  return mergeEmployeeMasterHistoryFormConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryFormConfiguration(),
    overrides: fields,
  });
}

export async function resetEmployeeMasterHistoryFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryFormResolvedConfiguration> {
  const screenKey =
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY;
  let prismaScreenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    prismaScreenKey = toScreenConfigurationScreenKey(screenKey);
  } catch {
    throw new EmployeeMasterHistoryFormConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history form screen key.",
    );
  }

  const db = args.db ?? prisma;
  await db.screenConfigurationProfile.deleteMany({
    where: {
      companyId: args.companyId,
      screenKey: prismaScreenKey,
    },
  });

  return buildDefaultEmployeeMasterHistoryFormConfiguration();
}
