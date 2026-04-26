export const EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY =
  "employees.master.history" as const;

export type EmployeeMasterHistoryDisplayConfigurationScreenKey =
  typeof EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEYS = [
  "gender",
  "email",
  "phone",
] as const;

export type EmployeeMasterHistoryDisplayConfigurationFieldKey =
  (typeof EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeMasterHistoryDisplayConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "gender", label: "Cinsiyet" },
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
] as const;

export type EmployeeMasterHistoryDisplayFieldVisibility = {
  fieldKey: EmployeeMasterHistoryDisplayConfigurationFieldKey;
  isVisible: boolean;
};

export type EmployeeMasterHistoryDisplayResolvedConfiguration = {
  screenKey: EmployeeMasterHistoryDisplayConfigurationScreenKey;
  fields: Record<
    EmployeeMasterHistoryDisplayConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEYS,
);

export function parseEmployeeMasterHistoryDisplayConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryDisplayConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY",
    );
  }
  return EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeMasterHistoryDisplayConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryDisplayConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_KEY",
    );
  }
  return value as EmployeeMasterHistoryDisplayConfigurationFieldKey;
}

export function buildDefaultEmployeeMasterHistoryDisplayConfiguration(): EmployeeMasterHistoryDisplayResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
    fields: {
      gender: { isVisible: true },
      email: { isVisible: true },
      phone: { isVisible: true },
    },
  };
}
