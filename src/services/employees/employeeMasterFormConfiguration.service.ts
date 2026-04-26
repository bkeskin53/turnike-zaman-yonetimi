import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterFormConfiguration,
  EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterFormConfigurationFieldKey,
  type EmployeeMasterFormConfigurationScreenKey,
  type EmployeeMasterFormResolvedConfiguration,
  parseEmployeeMasterFormConfigurationFieldKey,
  parseEmployeeMasterFormConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterFormConfiguration";

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
  EmployeeMasterFormConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_MASTER,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeMasterFormConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  gender: ScreenConfigurationFieldKey.GENDER,
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeMasterFormConfigurationFieldKey | null
> = {
  [ScreenConfigurationFieldKey.GENDER]: "gender",
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: null,
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: null,
};

export function toEmployeeMasterFormConfigurationScreenKey(
  value: string,
): EmployeeMasterFormConfigurationScreenKey {
  return parseEmployeeMasterFormConfigurationScreenKey(value);
}

export function toEmployeeMasterFormConfigurationFieldKey(
  value: string,
): EmployeeMasterFormConfigurationFieldKey {
  return parseEmployeeMasterFormConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed = parseEmployeeMasterFormConfigurationScreenKey(screenKey);
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeMasterFormConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeMasterFormConfigurationOverrides(args: {
  base?: EmployeeMasterFormResolvedConfiguration;
  overrides: Array<{
    fieldKey: ScreenConfigurationFieldKey | EmployeeMasterFormConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeMasterFormResolvedConfiguration {
  const base =
    args.base ?? buildDefaultEmployeeMasterFormConfiguration();
  const next: EmployeeMasterFormResolvedConfiguration = {
    ...base,
    fields: {
      ...base.fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeMasterFormConfigurationFieldKey(override.fieldKey)
        : FIELD_KEY_BY_PRISMA_FIELD_KEY[
            override.fieldKey as ScreenConfigurationFieldKey
          ];

    if (!fieldKey) continue;
    next.fields[fieldKey] = {
      isVisible: override.isVisible,
    };
  }

  return next;
}

export async function resolveEmployeeMasterFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeMasterFormResolvedConfiguration> {
  const screenKey = parseEmployeeMasterFormConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
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

  return mergeEmployeeMasterFormConfigurationOverrides({
    base: buildDefaultEmployeeMasterFormConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
