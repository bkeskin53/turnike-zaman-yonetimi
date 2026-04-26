import { Prisma, ScreenConfigurationFieldKey } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryListConfiguration,
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryListConfigurationFieldKey,
  type EmployeeMasterHistoryListResolvedConfiguration,
} from "@/src/features/employees/employeeMasterHistoryListConfiguration";
import {
  mergeEmployeeMasterHistoryListConfigurationOverrides,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "@/src/services/employees/employeeMasterHistoryListConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type EmployeeMasterHistoryListConfigurationWriteFieldInput = {
  fieldKey: string;
  isVisible: boolean;
};

export type EmployeeMasterHistoryListConfigurationWriteInput = {
  screenKey: string;
  fields: EmployeeMasterHistoryListConfigurationWriteFieldInput[];
};

export type EmployeeMasterHistoryListConfigurationMutationErrorCode =
  | "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEY"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET"
  | "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_VISIBILITY";

export class EmployeeMasterHistoryListConfigurationMutationError extends Error {
  code: EmployeeMasterHistoryListConfigurationMutationErrorCode;

  constructor(
    code: EmployeeMasterHistoryListConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeMasterHistoryListConfigurationMutationError";
    this.code = code;
  }
}

export function isEmployeeMasterHistoryListConfigurationMutationError(
  error: unknown,
): error is EmployeeMasterHistoryListConfigurationMutationError {
  return error instanceof EmployeeMasterHistoryListConfigurationMutationError;
}

const EXPECTED_FIELD_KEYS =
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_DEFINITIONS.map(
    (item) => item.fieldKey,
  );

function normalizeWriteInput(
  input: EmployeeMasterHistoryListConfigurationWriteInput,
): {
  screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  fields: Array<{
    fieldKey: EmployeeMasterHistoryListConfigurationFieldKey;
    prismaFieldKey: ScreenConfigurationFieldKey;
    isVisible: boolean;
  }>;
} {
  let screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    screenKey = toScreenConfigurationScreenKey(input.screenKey);
  } catch {
    throw new EmployeeMasterHistoryListConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history list screen key.",
    );
  }

  if (!Array.isArray(input.fields)) {
    throw new EmployeeMasterHistoryListConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET",
      "Alan listesi gecersiz.",
    );
  }

  const seen = new Set<EmployeeMasterHistoryListConfigurationFieldKey>();
  const normalized = input.fields.map((item) => {
    let fieldKey: EmployeeMasterHistoryListConfigurationFieldKey;
    try {
      fieldKey =
        item?.fieldKey as EmployeeMasterHistoryListConfigurationFieldKey;
      const prismaFieldKey = toScreenConfigurationFieldKey(item?.fieldKey);
      if (typeof item?.isVisible !== "boolean") {
        throw new EmployeeMasterHistoryListConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_VISIBILITY",
          "isVisible yalnizca boolean olabilir.",
        );
      }
      if (seen.has(fieldKey)) {
        throw new EmployeeMasterHistoryListConfigurationMutationError(
          "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET",
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
        error instanceof EmployeeMasterHistoryListConfigurationMutationError
      ) {
        throw error;
      }
      throw new EmployeeMasterHistoryListConfigurationMutationError(
        "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEY",
        "Gecersiz master history list field key.",
      );
    }
  });

  const normalizedKeys = normalized.map((item) => item.fieldKey).sort();
  const expectedKeys = [...EXPECTED_FIELD_KEYS].sort();
  if (
    normalized.length !== expectedKeys.length ||
    normalizedKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new EmployeeMasterHistoryListConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_SET",
      "Tam ve gecerli field set gonderilmelidir.",
    );
  }

  return {
    screenKey,
    fields: normalized,
  };
}

export async function saveEmployeeMasterHistoryListConfiguration(args: {
  companyId: string;
  input: EmployeeMasterHistoryListConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryListResolvedConfiguration> {
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

  return mergeEmployeeMasterHistoryListConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryListConfiguration(),
    overrides: fields,
  });
}

export async function resetEmployeeMasterHistoryListConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: typeof prisma;
}): Promise<EmployeeMasterHistoryListResolvedConfiguration> {
  const screenKey =
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY;
  let prismaScreenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    prismaScreenKey = toScreenConfigurationScreenKey(screenKey);
  } catch {
    throw new EmployeeMasterHistoryListConfigurationMutationError(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY",
      "Gecersiz master history list screen key.",
    );
  }

  const db = args.db ?? prisma;
  await db.screenConfigurationProfile.deleteMany({
    where: {
      companyId: args.companyId,
      screenKey: prismaScreenKey,
    },
  });

  return buildDefaultEmployeeMasterHistoryListConfiguration();
}
