import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryDisplayConfiguration,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryDisplayConfigurationFieldKey,
  type EmployeeMasterHistoryDisplayConfigurationScreenKey,
  type EmployeeMasterHistoryDisplayResolvedConfiguration,
  parseEmployeeMasterHistoryDisplayConfigurationFieldKey,
  parseEmployeeMasterHistoryDisplayConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";

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
  EmployeeMasterHistoryDisplayConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeMasterHistoryDisplayConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  gender: ScreenConfigurationFieldKey.GENDER,
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeMasterHistoryDisplayConfigurationFieldKey | null
> = {
  [ScreenConfigurationFieldKey.GENDER]: "gender",
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: null,
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: null,
};

export function toEmployeeMasterHistoryDisplayConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryDisplayConfigurationScreenKey {
  return parseEmployeeMasterHistoryDisplayConfigurationScreenKey(value);
}

export function toEmployeeMasterHistoryDisplayConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryDisplayConfigurationFieldKey {
  return parseEmployeeMasterHistoryDisplayConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed =
    parseEmployeeMasterHistoryDisplayConfigurationScreenKey(screenKey);
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeMasterHistoryDisplayConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeMasterHistoryDisplayConfigurationOverrides(args: {
  base?: EmployeeMasterHistoryDisplayResolvedConfiguration;
  overrides: Array<{
    fieldKey:
      | ScreenConfigurationFieldKey
      | EmployeeMasterHistoryDisplayConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeMasterHistoryDisplayResolvedConfiguration {
  const base =
    args.base ?? buildDefaultEmployeeMasterHistoryDisplayConfiguration();
  const next: EmployeeMasterHistoryDisplayResolvedConfiguration = {
    ...base,
    fields: {
      ...base.fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeMasterHistoryDisplayConfigurationFieldKey(
            override.fieldKey,
          )
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

export async function resolveEmployeeMasterHistoryDisplayConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeMasterHistoryDisplayResolvedConfiguration> {
  const screenKey = parseEmployeeMasterHistoryDisplayConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
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

  return mergeEmployeeMasterHistoryDisplayConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryDisplayConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
