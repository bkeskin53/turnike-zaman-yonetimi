export const EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY =
  "employees.master.history.form" as const;

export type EmployeeMasterHistoryFormConfigurationScreenKey =
  typeof EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEYS = [
  "gender",
  "email",
  "phone",
] as const;

export type EmployeeMasterHistoryFormConfigurationFieldKey =
  (typeof EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeMasterHistoryFormConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "gender", label: "Cinsiyet" },
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
] as const;

export type EmployeeMasterHistoryFormFieldVisibility = {
  fieldKey: EmployeeMasterHistoryFormConfigurationFieldKey;
  isVisible: boolean;
};

export type EmployeeMasterHistoryFormResolvedConfiguration = {
  screenKey: EmployeeMasterHistoryFormConfigurationScreenKey;
  fields: Record<
    EmployeeMasterHistoryFormConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEYS,
);

export function parseEmployeeMasterHistoryFormConfigurationScreenKey(
  value: string,
): EmployeeMasterHistoryFormConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY",
    );
  }
  return EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeMasterHistoryFormConfigurationFieldKey(
  value: string,
): EmployeeMasterHistoryFormConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_FIELD_KEY",
    );
  }
  return value as EmployeeMasterHistoryFormConfigurationFieldKey;
}

export function buildDefaultEmployeeMasterHistoryFormConfiguration(): EmployeeMasterHistoryFormResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
    fields: {
      gender: { isVisible: true },
      email: { isVisible: true },
      phone: { isVisible: true },
    },
  };
}
