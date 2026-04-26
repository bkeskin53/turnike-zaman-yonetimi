export type EmployeeAssignmentEditDraft = {
  scopeStartDate: string;
  branchId: string;
  employeeGroupId: string;
  employeeSubgroupId: string;
};

export type EmployeeAssignmentEditSource = {
  branchId: string | null | undefined;
  employeeGroupId: string | null | undefined;
  employeeSubgroupId: string | null | undefined;
};

export type EmployeeAssignmentEditValidationCode =
  | "SCOPE_START_DATE_REQUIRED"
  | "SCOPE_START_DATE_INVALID"
  | "BRANCH_REQUIRED"
  | "EMPLOYEE_GROUP_REQUIRED"
  | "EMPLOYEE_SUBGROUP_REQUIRED";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildEmployeeAssignmentEditDraft(args: {
  source: EmployeeAssignmentEditSource;
  scopeStartDate: string;
}): EmployeeAssignmentEditDraft {
  return {
    scopeStartDate: toText(args.scopeStartDate),
    branchId: toText(args.source.branchId),
    employeeGroupId: toText(args.source.employeeGroupId),
    employeeSubgroupId: toText(args.source.employeeSubgroupId),
  };
}

export function normalizeEmployeeAssignmentEditDraft(
  draft: Partial<Record<keyof EmployeeAssignmentEditDraft, unknown>>,
): EmployeeAssignmentEditDraft {
  return {
    scopeStartDate: toText(draft.scopeStartDate),
    branchId: toText(draft.branchId),
    employeeGroupId: toText(draft.employeeGroupId),
    employeeSubgroupId: toText(draft.employeeSubgroupId),
  };
}

export function validateEmployeeAssignmentEditDraft(
  draft: EmployeeAssignmentEditDraft,
): EmployeeAssignmentEditValidationCode | null {
  if (!draft.scopeStartDate) return "SCOPE_START_DATE_REQUIRED";
  if (!isValidIsoDay(draft.scopeStartDate)) return "SCOPE_START_DATE_INVALID";
  if (!draft.branchId) return "BRANCH_REQUIRED";
  if (!draft.employeeGroupId) return "EMPLOYEE_GROUP_REQUIRED";
  if (!draft.employeeSubgroupId) return "EMPLOYEE_SUBGROUP_REQUIRED";
  return null;
}

export function toEmployeeAssignmentEditPayload(draft: EmployeeAssignmentEditDraft) {
  const normalized = normalizeEmployeeAssignmentEditDraft(draft);
  return {
    scopeStartDate: normalized.scopeStartDate,
    branchId: normalized.branchId,
    employeeGroupId: normalized.employeeGroupId,
    employeeSubgroupId: normalized.employeeSubgroupId,
  };
}

export function humanizeEmployeeAssignmentEditValidation(
  code: EmployeeAssignmentEditValidationCode | string,
): string {
  const map: Record<string, string> = {
    SCOPE_START_DATE_REQUIRED: "Geçerlilik başlangıcı zorunludur.",
    SCOPE_START_DATE_INVALID: "Geçerlilik başlangıcı YYYY-AA-GG formatında olmalıdır.",
    BRANCH_REQUIRED: "Lokasyon seçimi zorunludur.",
    EMPLOYEE_GROUP_REQUIRED: "Grup seçimi zorunludur.",
    EMPLOYEE_SUBGROUP_REQUIRED: "Alt grup seçimi zorunludur.",
  };
  return map[code] ?? "Organizasyon bilgileri kaydedilemedi. Lütfen alanları kontrol edin.";
}
