export const EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY = "employees.create" as const;

export type EmployeeCreateFormConfigurationScreenKey =
  typeof EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY;

export const EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEYS = [
  "gender",
  "email",
  "phone",
  "cardNo",
  "deviceUserId",
] as const;

export type EmployeeCreateFormConfigurationFieldKey =
  (typeof EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEYS)[number];

export const EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_DEFINITIONS: ReadonlyArray<{
  fieldKey: EmployeeCreateFormConfigurationFieldKey;
  label: string;
}> = [
  { fieldKey: "gender", label: "Cinsiyet" },
  { fieldKey: "email", label: "E-posta" },
  { fieldKey: "phone", label: "Telefon" },
  { fieldKey: "cardNo", label: "Kart ID" },
  { fieldKey: "deviceUserId", label: "Cihaz Kullanıcı No" },
] as const;

export type EmployeeCreateFormFieldVisibility = {
  fieldKey: EmployeeCreateFormConfigurationFieldKey;
  isVisible: boolean;
};

export type EmployeeCreateFormResolvedConfiguration = {
  screenKey: EmployeeCreateFormConfigurationScreenKey;
  fields: Record<
    EmployeeCreateFormConfigurationFieldKey,
    {
      isVisible: boolean;
    }
  >;
};

const SCREEN_KEY_SET = new Set<string>([
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
]);

const FIELD_KEY_SET = new Set<string>(EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEYS);

export function parseEmployeeCreateFormConfigurationScreenKey(
  value: string,
): EmployeeCreateFormConfigurationScreenKey {
  if (!SCREEN_KEY_SET.has(value)) {
    throw new Error("INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY");
  }
  return EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY;
}

export function parseEmployeeCreateFormConfigurationFieldKey(
  value: string,
): EmployeeCreateFormConfigurationFieldKey {
  if (!FIELD_KEY_SET.has(value)) {
    throw new Error("INVALID_EMPLOYEE_CREATE_FORM_CONFIGURATION_FIELD_KEY");
  }
  return value as EmployeeCreateFormConfigurationFieldKey;
}

export function buildDefaultEmployeeCreateFormConfiguration(): EmployeeCreateFormResolvedConfiguration {
  return {
    screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
    fields: {
      gender: { isVisible: true },
      email: { isVisible: true },
      phone: { isVisible: true },
      cardNo: { isVisible: true },
      deviceUserId: { isVisible: true },
    },
  };
}
