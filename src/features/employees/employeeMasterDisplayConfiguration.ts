export const EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY =
  "employees.master.display" as const;

export type EmployeeMasterDisplayConfigurationScreenKey =
  typeof EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_KEYS = [
  "gender",
  "email",
  "phone",
] as const;

export type EmployeeMasterDisplayConfigurationFieldKey =
  (typeof EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeMasterDisplayConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "gender", label: "Cinsiyet" },
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
] as const;

export type EmployeeMasterDisplayResolvedConfiguration = {
  screenKey: EmployeeMasterDisplayConfigurationScreenKey;
  fields: Record<
    EmployeeMasterDisplayConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_KEYS,
);

export function parseEmployeeMasterDisplayConfigurationScreenKey(
  value: string,
): EmployeeMasterDisplayConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY",
    );
  }
  return EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeMasterDisplayConfigurationFieldKey(
  value: string,
): EmployeeMasterDisplayConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error(
      "INVALID_EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_KEY",
    );
  }
  return value as EmployeeMasterDisplayConfigurationFieldKey;
}

export function buildDefaultEmployeeMasterDisplayConfiguration(): EmployeeMasterDisplayResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
    fields: {
      gender: { isVisible: true },
      email: { isVisible: true },
      phone: { isVisible: true },
    },
  };
}
