export type EmployeeMasterProfileEditDraft = {
  scopeStartDate: string;
  employeeCode: string;
  cardNo: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  gender: string;
  email: string;
  phone: string;
};

export type EmployeeMasterProfileEditSource = {
  employeeCode: string | null | undefined;
  cardNo: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  nationalId: string | null | undefined;
  gender: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
};

export type EmployeeMasterProfileEditValidationCode =
  | "SCOPE_START_DATE_REQUIRED"
  | "SCOPE_START_DATE_INVALID"
  | "EMPLOYEE_CODE_REQUIRED"
  | "EMPLOYEE_CODE_TOO_LONG"
  | "CARD_NO_TOO_LONG"
  | "FIRST_NAME_REQUIRED"
  | "LAST_NAME_REQUIRED"
  | "FIRST_NAME_TOO_LONG"
  | "LAST_NAME_TOO_LONG"
  | "INVALID_NATIONAL_ID"
  | "INVALID_GENDER"
  | "INVALID_EMAIL"
  | "PHONE_TOO_LONG";

const ALLOWED_GENDERS = new Set(["", "MALE", "FEMALE", "OTHER", "UNSPECIFIED"]);

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildEmployeeMasterProfileEditDraft(args: {
  source: EmployeeMasterProfileEditSource;
  scopeStartDate: string;
}): EmployeeMasterProfileEditDraft {
  return {
    scopeStartDate: toText(args.scopeStartDate),
    employeeCode: toText(args.source.employeeCode),
    cardNo: toText(args.source.cardNo),
    firstName: toText(args.source.firstName),
    lastName: toText(args.source.lastName),
    nationalId: toText(args.source.nationalId),
    gender: toText(args.source.gender),
    email: toText(args.source.email),
    phone: toText(args.source.phone),
  };
}

export function normalizeEmployeeMasterProfileEditDraft(
  draft: Partial<Record<keyof EmployeeMasterProfileEditDraft, unknown>>,
): EmployeeMasterProfileEditDraft {
  return {
    scopeStartDate: toText(draft.scopeStartDate),
    employeeCode: toText(draft.employeeCode),
    cardNo: toText(draft.cardNo),
    firstName: toText(draft.firstName),
    lastName: toText(draft.lastName),
    nationalId: toText(draft.nationalId).replace(/\D+/g, "").slice(0, 11),
    gender: toText(draft.gender),
    email: toText(draft.email),
    phone: toText(draft.phone),
  };
}

export function validateEmployeeMasterProfileEditDraft(
  draft: EmployeeMasterProfileEditDraft,
): EmployeeMasterProfileEditValidationCode | null {
  if (!draft.scopeStartDate) return "SCOPE_START_DATE_REQUIRED";
  if (!isValidIsoDay(draft.scopeStartDate)) return "SCOPE_START_DATE_INVALID";
  if (!draft.employeeCode) return "EMPLOYEE_CODE_REQUIRED";
  if (draft.employeeCode.length > 50) return "EMPLOYEE_CODE_TOO_LONG";
  if (draft.cardNo.length > 100) return "CARD_NO_TOO_LONG";
  if (!draft.firstName) return "FIRST_NAME_REQUIRED";
  if (!draft.lastName) return "LAST_NAME_REQUIRED";
  if (draft.firstName.length > 100) return "FIRST_NAME_TOO_LONG";
  if (draft.lastName.length > 100) return "LAST_NAME_TOO_LONG";
  if (draft.nationalId && !/^\d{11}$/.test(draft.nationalId)) return "INVALID_NATIONAL_ID";
  if (!ALLOWED_GENDERS.has(draft.gender)) return "INVALID_GENDER";
  if (draft.email && (draft.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))) {
    return "INVALID_EMAIL";
  }
  if (draft.phone.length > 30) return "PHONE_TOO_LONG";
  return null;
}

export function toEmployeeMasterProfileEditPayload(draft: EmployeeMasterProfileEditDraft) {
  const normalized = normalizeEmployeeMasterProfileEditDraft(draft);
  return {
    scopeStartDate: normalized.scopeStartDate,
    employeeCode: normalized.employeeCode,
    cardNo: normalized.cardNo || null,
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    nationalId: normalized.nationalId || null,
    gender: normalized.gender || null,
    email: normalized.email || null,
    phone: normalized.phone || null,
  };
}

export function humanizeEmployeeMasterProfileEditValidation(
  code: EmployeeMasterProfileEditValidationCode | string,
): string {
  const map: Record<string, string> = {
    SCOPE_START_DATE_REQUIRED: "Geçerlilik başlangıcı zorunludur.",
    SCOPE_START_DATE_INVALID: "Geçerlilik başlangıcı YYYY-AA-GG formatında olmalıdır.",
    EMPLOYEE_CODE_REQUIRED: "Sicil no zorunludur.",
    EMPLOYEE_CODE_TOO_LONG: "Sicil no en fazla 50 karakter olabilir.",
    CARD_NO_TOO_LONG: "Kart ID en fazla 100 karakter olabilir.",
    FIRST_NAME_REQUIRED: "Ad zorunludur.",
    LAST_NAME_REQUIRED: "Soyad zorunludur.",
    FIRST_NAME_TOO_LONG: "Ad en fazla 100 karakter olabilir.",
    LAST_NAME_TOO_LONG: "Soyad en fazla 100 karakter olabilir.",
    INVALID_NATIONAL_ID: "TC Kimlik 11 haneli olmalıdır.",
    INVALID_GENDER: "Cinsiyet değeri geçersiz.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
    PHONE_TOO_LONG: "Telefon en fazla 30 karakter olabilir.",
  };
  return map[code] ?? "Bilgiler kaydedilemedi. Lütfen alanları kontrol edin.";
}
