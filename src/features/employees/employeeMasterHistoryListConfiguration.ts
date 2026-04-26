export const EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY =
  "employees.master.history.list" as const;

export type EmployeeMasterHistoryListConfigurationScreenKey =
  typeof EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEYS = [
  "email",
  "phone",
] as const;

export type EmployeeMasterHistoryListConfigurationFieldKey =
  (typeof EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeMasterHistoryListConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
] as const;

export type EmployeeMasterHistoryListResolvedConfiguration = {
  screenKey: EmployeeMasterHistoryListConfigurationScreenKey;
  fields: Record<
    EmployeeMasterHistoryListConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEYS,
);

export function parseEmployeeMasterHistoryListConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryListConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY",
    );
  }
  return EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeMasterHistoryListConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryListConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_FIELD_KEY",
    );
  }
  return value as EmployeeMasterHistoryListConfigurationFieldKey;
}

export function buildDefaultEmployeeMasterHistoryListConfiguration(): EmployeeMasterHistoryListResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
    fields: {
      email: { isVisible: true },
      phone: { isVisible: true },
    },
  };
}
