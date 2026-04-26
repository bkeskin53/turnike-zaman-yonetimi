import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeCreateFormConfiguration,
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeCreateFormConfigurationFieldKey,
  type EmployeeCreateFormConfigurationScreenKey,
  type EmployeeCreateFormResolvedConfiguration,
  parseEmployeeCreateFormConfigurationFieldKey,
  parseEmployeeCreateFormConfigurationScreenKey,
} from "@/src/features/employees/employeeCreateFormConfiguration";

type ScreenConfigurationProfileReader = {
  screenConfigurationProfile: {
    findUnique(args: {
      where: {
        companyId_screenKey: {
          companyId: string;
          screenKey: ScreenConfigurationScreenKey;
        };
      };
      select: {
        fields: {
          select: {
            fieldKey: true;
            isVisible: true;
          };
        };
      };
    }): Promise<{
      fields: Array<{
        fieldKey: ScreenConfigurationFieldKey;
        isVisible: boolean;
      }>;
    } | null>;
  };
};

const PRISMA_SCREEN_KEY_BY_SCREEN_KEY: Record<
  EmployeeCreateFormConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_CREATE,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeCreateFormConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  gender: ScreenConfigurationFieldKey.GENDER,
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
  cardNo: ScreenConfigurationFieldKey.CARD_NO,
  deviceUserId: ScreenConfigurationFieldKey.DEVICE_USER_ID,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeCreateFormConfigurationFieldKey
> = {
  [ScreenConfigurationFieldKey.GENDER]: "gender",
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: "cardNo",
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: "deviceUserId",
};

export function toEmployeeCreateFormConfigurationScreenKey(
  value: string,
): EmployeeCreateFormConfigurationScreenKey {
  return parseEmployeeCreateFormConfigurationScreenKey(value);
}

export function toEmployeeCreateFormConfigurationFieldKey(
  value: string,
): EmployeeCreateFormConfigurationFieldKey {
  return parseEmployeeCreateFormConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed = parseEmployeeCreateFormConfigurationScreenKey(screenKey);
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeCreateFormConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeCreateFormConfigurationOverrides(args: {
  base?: EmployeeCreateFormResolvedConfiguration;
  overrides: Array<{
    fieldKey: ScreenConfigurationFieldKey | EmployeeCreateFormConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeCreateFormResolvedConfiguration {
  const next = {
    ...(args.base ?? buildDefaultEmployeeCreateFormConfiguration()),
    fields: {
      ...(args.base ?? buildDefaultEmployeeCreateFormConfiguration()).fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeCreateFormConfigurationFieldKey(override.fieldKey)
        : FIELD_KEY_BY_PRISMA_FIELD_KEY[
            override.fieldKey as ScreenConfigurationFieldKey
          ];

    next.fields[fieldKey] = {
      isVisible: override.isVisible,
    };
  }

  return next;
}

export async function resolveEmployeeCreateFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeCreateFormResolvedConfiguration> {
  const screenKey = parseEmployeeCreateFormConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
  );
  const db = (args.db ?? prisma) as ScreenConfigurationProfileReader;
  const profile = await db.screenConfigurationProfile.findUnique({
    where: {
      companyId_screenKey: {
        companyId: args.companyId,
        screenKey: PRISMA_SCREEN_KEY_BY_SCREEN_KEY[screenKey],
      },
    },
    select: {
      fields: {
        select: {
          fieldKey: true,
          isVisible: true,
        },
      },
    },
  });

  return mergeEmployeeCreateFormConfigurationOverrides({
    base: buildDefaultEmployeeCreateFormConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
