import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
  buildDefaultEmployeeMasterDisplayConfiguration,
  type EmployeeMasterDisplayConfigurationFieldKey,
  type EmployeeMasterDisplayConfigurationScreenKey,
  type EmployeeMasterDisplayResolvedConfiguration,
  parseEmployeeMasterDisplayConfigurationFieldKey,
  parseEmployeeMasterDisplayConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterDisplayConfiguration";

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
  EmployeeMasterDisplayConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_MASTER_DISPLAY,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeMasterDisplayConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  gender: ScreenConfigurationFieldKey.GENDER,
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeMasterDisplayConfigurationFieldKey | null
> = {
  [ScreenConfigurationFieldKey.GENDER]: "gender",
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: null,
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: null,
};

export function toEmployeeMasterDisplayConfigurationScreenKey(
  value: string,
): EmployeeMasterDisplayConfigurationScreenKey {
  return parseEmployeeMasterDisplayConfigurationScreenKey(value);
}

export function toEmployeeMasterDisplayConfigurationFieldKey(
  value: string,
): EmployeeMasterDisplayConfigurationFieldKey {
  return parseEmployeeMasterDisplayConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed = parseEmployeeMasterDisplayConfigurationScreenKey(screenKey);
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeMasterDisplayConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeMasterDisplayConfigurationOverrides(args: {
  base?: EmployeeMasterDisplayResolvedConfiguration;
  overrides: Array<{
    fieldKey:
      | ScreenConfigurationFieldKey
      | EmployeeMasterDisplayConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeMasterDisplayResolvedConfiguration {
  const base = args.base ?? buildDefaultEmployeeMasterDisplayConfiguration();
  const next: EmployeeMasterDisplayResolvedConfiguration = {
    ...base,
    fields: {
      ...base.fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeMasterDisplayConfigurationFieldKey(override.fieldKey)
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

export async function resolveEmployeeMasterDisplayConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeMasterDisplayResolvedConfiguration> {
  const screenKey = parseEmployeeMasterDisplayConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
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

  return mergeEmployeeMasterDisplayConfigurationOverrides({
    base: buildDefaultEmployeeMasterDisplayConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
