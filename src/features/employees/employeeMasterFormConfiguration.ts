export const EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY =
  "employees.master" as const;

export type EmployeeMasterFormConfigurationScreenKey =
  typeof EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEYS = [
  "gender",
  "email",
  "phone",
] as const;

export type EmployeeMasterFormConfigurationFieldKey =
  (typeof EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeMasterFormConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "gender", label: "Cinsiyet" },
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
] as const;

export type EmployeeMasterFormFieldVisibility = {
  fieldKey: EmployeeMasterFormConfigurationFieldKey;
  isVisible: boolean;
};

export type EmployeeMasterFormResolvedConfiguration = {
  screenKey: EmployeeMasterFormConfigurationScreenKey;
  fields: Record<
    EmployeeMasterFormConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(
  EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEYS,
);

export function parseEmployeeMasterFormConfigurationScreenKey(
  value: string,
): EmployeeMasterFormConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error("INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY");
  }
  return EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeMasterFormConfigurationFieldKey(
  value: string,
): EmployeeMasterFormConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error("INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEY");
  }
  return value as EmployeeMasterFormConfigurationFieldKey;
}

export function buildDefaultEmployeeMasterFormConfiguration(): EmployeeMasterFormResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
    fields: {
      gender: { isVisible: true },
      email: { isVisible: true },
      phone: { isVisible: true },
    },
  };
}
