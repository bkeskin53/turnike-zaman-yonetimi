import {
  ScreenConfigurationFieldKey,
  ScreenConfigurationScreenKey,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultEmployeeMasterHistoryListConfiguration,
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryListConfigurationFieldKey,
  type EmployeeMasterHistoryListConfigurationScreenKey,
  type EmployeeMasterHistoryListResolvedConfiguration,
  parseEmployeeMasterHistoryListConfigurationFieldKey,
  parseEmployeeMasterHistoryListConfigurationScreenKey,
} from "@/src/features/employees/employeeMasterHistoryListConfiguration";

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
  EmployeeMasterHistoryListConfigurationScreenKey,
  ScreenConfigurationScreenKey
> = {
  [EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY]:
    ScreenConfigurationScreenKey.EMPLOYEES_MASTER_HISTORY_LIST,
};

const PRISMA_FIELD_KEY_BY_FIELD_KEY: Record<
  EmployeeMasterHistoryListConfigurationFieldKey,
  ScreenConfigurationFieldKey
> = {
  email: ScreenConfigurationFieldKey.EMAIL,
  phone: ScreenConfigurationFieldKey.PHONE,
};

const FIELD_KEY_BY_PRISMA_FIELD_KEY: Record<
  ScreenConfigurationFieldKey,
  EmployeeMasterHistoryListConfigurationFieldKey | null
> = {
  [ScreenConfigurationFieldKey.GENDER]: null,
  [ScreenConfigurationFieldKey.EMAIL]: "email",
  [ScreenConfigurationFieldKey.PHONE]: "phone",
  [ScreenConfigurationFieldKey.CARD_NO]: null,
  [ScreenConfigurationFieldKey.DEVICE_USER_ID]: null,
};

export function toEmployeeMasterHistoryListConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryListConfigurationScreenKey {
  return parseEmployeeMasterHistoryListConfigurationScreenKey(value);
}

export function toEmployeeMasterHistoryListConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryListConfigurationFieldKey {
  return parseEmployeeMasterHistoryListConfigurationFieldKey(value);
}

export function toScreenConfigurationScreenKey(
  screenKey: string,
): ScreenConfigurationScreenKey {
  const parsed = parseEmployeeMasterHistoryListConfigurationScreenKey(
    screenKey,
  );
  return PRISMA_SCREEN_KEY_BY_SCREEN_KEY[parsed];
}

export function toScreenConfigurationFieldKey(
  fieldKey: string,
): ScreenConfigurationFieldKey {
  const parsed = parseEmployeeMasterHistoryListConfigurationFieldKey(fieldKey);
  return PRISMA_FIELD_KEY_BY_FIELD_KEY[parsed];
}

export function mergeEmployeeMasterHistoryListConfigurationOverrides(args: {
  base?: EmployeeMasterHistoryListResolvedConfiguration;
  overrides: Array<{
    fieldKey:
      | ScreenConfigurationFieldKey
      | EmployeeMasterHistoryListConfigurationFieldKey;
    isVisible: boolean;
  }>;
}): EmployeeMasterHistoryListResolvedConfiguration {
  const base = args.base ?? buildDefaultEmployeeMasterHistoryListConfiguration();
  const next: EmployeeMasterHistoryListResolvedConfiguration = {
    ...base,
    fields: {
      ...base.fields,
    },
  };

  for (const override of args.overrides) {
    const fieldKey =
      typeof override.fieldKey === "string" &&
      override.fieldKey in PRISMA_FIELD_KEY_BY_FIELD_KEY
        ? parseEmployeeMasterHistoryListConfigurationFieldKey(
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

export async function resolveEmployeeMasterHistoryListConfiguration(args: {
  companyId: string;
  screenKey?: string;
  db?: ScreenConfigurationProfileReader;
}): Promise<EmployeeMasterHistoryListResolvedConfiguration> {
  const screenKey = parseEmployeeMasterHistoryListConfigurationScreenKey(
    args.screenKey ?? EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
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

  return mergeEmployeeMasterHistoryListConfigurationOverrides({
    base: buildDefaultEmployeeMasterHistoryListConfiguration(),
    overrides: profile?.fields ?? [],
  });
}
