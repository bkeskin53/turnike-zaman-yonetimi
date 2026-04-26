import { Prisma, ScreenConfigurationFieldKey } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeCreateFormConfiguration,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_DEFINITIONS,
  type EmployeeCreateFormConfigurationFieldKey,
  type EmployeeCreateFormResolvedConfiguration,
} from "@/src/features/employees/employeeCreateFormConfiguration";
import {
  mergeEmployeeCreateFormConfigurationOverrides,
  toScreenConfigurationFieldKey,
  toScreenConfigurationScreenKey,
} from "@/src/services/employees/employeeCreateFormConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type EmployeeCreateFormConfigurationWriteFieldInput = {
  fieldKey: string;
  isVisible: boolean;
};

export type EmployeeCreateFormConfigurationWriteInput = {
  screenKey: string;
  fields: EmployeeCreateFormConfigurationWriteFieldInput[];
};

export type EmployeeCreateFormConfigurationMutationErrorCode =
  | "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY"
  | "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY"
  | "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET"
  | "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_VISIBILITY";

export class EmployeeCreateFormConfigurationMutationError extends Error {
  code: EmployeeCreateFormConfigurationMutationErrorCode;

  constructor(
    code: EmployeeCreateFormConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmployeeCreateFormConfigurationMutationError";
    this.code = code;
  }
}

export function isEmployeeCreateFormConfigurationMutationError(
  error: unknown,
): error is EmployeeCreateFormConfigurationMutationError {
  return error instanceof EmployeeCreateFormConfigurationMutationError;
}

const EXPECTED_FIELD_KEYS = EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
  (item) => item.fieldKey,
);

function normalizeWriteInput(
  input: EmployeeCreateFormConfigurationWriteInput,
): {
  screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  fields: Array<{
    fieldKey: EmployeeCreateFormConfigurationFieldKey;
    prismaFieldKey: ScreenConfigurationFieldKey;
    isVisible: boolean;
  }>;
} {
  let screenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    screenKey = toScreenConfigurationScreenKey(input.screenKey);
  } catch {
    throw new EmployeeCreateFormConfigurationMutationError(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY",
      "Geçersiz create form screen key.",
    );
  }

  if (!Array.isArray(input.fields)) {
    throw new EmployeeCreateFormConfigurationMutationError(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET",
      "Alan listesi geçersiz.",
    );
  }

  const seen = new Set<EmployeeCreateFormConfigurationFieldKey>();
  const normalized = input.fields.map((item) => {
    let fieldKey: EmployeeCreateFormConfigurationFieldKey;
    try {
      fieldKey = item?.fieldKey as EmployeeCreateFormConfigurationFieldKey;
      const prismaFieldKey = toScreenConfigurationFieldKey(item?.fieldKey);
      if (typeof item?.isVisible !== "boolean") {
        throw new EmployeeCreateFormConfigurationMutationError(
          "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_VISIBILITY",
          "isVisible yalnızca boolean olabilir.",
        );
      }
      if (seen.has(fieldKey)) {
        throw new EmployeeCreateFormConfigurationMutationError(
          "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET",
          "Aynı fieldKey birden fazla kez gönderilemez.",
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
        error instanceof EmployeeCreateFormConfigurationMutationError
      ) {
        throw error;
      }
      throw new EmployeeCreateFormConfigurationMutationError(
        "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY",
        "Geçersiz create form field key.",
      );
    }
  });

  const normalizedKeys = normalized.map((item) => item.fieldKey).sort();
  const expectedKeys = [...EXPECTED_FIELD_KEYS].sort();
  if (
    normalized.length !== expectedKeys.length ||
    normalizedKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new EmployeeCreateFormConfigurationMutationError(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_SET",
      "Tam ve geçerli field set gönderilmelidir.",
    );
  }

  return {
    screenKey,
    fields: normalized,
  };
}

export async function saveEmployeeCreateFormConfiguration(args: {
  companyId: string;
  input: EmployeeCreateFormConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<EmployeeCreateFormResolvedConfiguration> {
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

  return mergeEmployeeCreateFormConfigurationOverrides({
    base: buildDefaultEmployeeCreateFormConfiguration(),
    overrides: fields,
  });
}

export async function resetEmployeeCreateFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: typeof prisma;
}): Promise<EmployeeCreateFormResolvedConfiguration> {
  const screenKey = args.screenKey ?? EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY;
  let prismaScreenKey: ReturnType<typeof toScreenConfigurationScreenKey>;
  try {
    prismaScreenKey = toScreenConfigurationScreenKey(screenKey);
  } catch {
    throw new EmployeeCreateFormConfigurationMutationError(
      "INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY",
      "Geçersiz create form screen key.",
    );
  }

  const db = args.db ?? prisma;
  await db.screenConfigurationProfile.deleteMany({
    where: {
      companyId: args.companyId,
      screenKey: prismaScreenKey,
    },
  });

  return buildDefaultEmployeeCreateFormConfiguration();
}
