import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryFormConfiguration,
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryFormConfigurationFieldKey,
  type EmployeeMasterHistoryFormConfigurationScreenKey,
  type EmployeeMasterHistoryFormResolvedConfiguration,
  parseEmployeeMasterHistoryFormConfigurationFieldKey,
  parseEmployeeMasterHistoryFormConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterHistoryFormConfiguration";

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
  EmployeeMasterHistoryFormConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_FORM,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeMasterHistoryFormConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  gender: ScreenConfigurationFieldKey.GENDER,
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeMasterHistoryFormConfigurationFieldKey | null
> = {
  [ScreenConfigurationFieldKey.GENDER]: "gender",
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: null,
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: null,
};

export function toEmployeeMasterHistoryFormConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryFormConfigurationScreenKey {
  return parseEmployeeMasterHistoryFormConfigurationScreenKey(value);
}

export function toEmployeeMasterHistoryFormConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryFormConfigurationFieldKey {
  return parseEmployeeMasterHistoryFormConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed = parseEmployeeMasterHistoryFormConfigurationScreenKey(screenKey);
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeMasterHistoryFormConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeMasterHistoryFormConfigurationOverrides(args: {
  base?: EmployeeMasterHistoryFormResolvedConfiguration;
  overrides: Array<{
    fieldKey:
      | ScreenConfigurationFieldKey
      | EmployeeMasterHistoryFormConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeMasterHistoryFormResolvedConfiguration {
  const base = args.base ?? buildDefaultEmployeeMasterHistoryFormConfiguration();
  const next: EmployeeMasterHistoryFormResolvedConfiguration = {
    ...base,
    fields: {
      ...base.fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeMasterHistoryFormConfigurationFieldKey(
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

export async function resolveEmployeeMasterHistoryFormConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeMasterHistoryFormResolvedConfiguration> {
  const screenKey = parseEmployeeMasterHistoryFormConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
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

  return mergeEmployeeMasterHistoryFormConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryFormConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
