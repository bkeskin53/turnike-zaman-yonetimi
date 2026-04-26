export type EmployeeWorkScheduleProfileEditDraft = {
  scopeStartDate: string;
  workSchedulePatternId: string;
};

export type EmployeeWorkScheduleProfileEditSource = {
  workSchedulePatternId: string | null | undefined;
};

export type EmployeeWorkScheduleProfileEditValidationCode =
  | "SCOPE_START_DATE_REQUIRED"
  | "SCOPE_START_DATE_INVALID"
  | "WORK_SCHEDULE_PATTERN_REQUIRED";

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildEmployeeWorkScheduleProfileEditDraft(args: {
  source: EmployeeWorkScheduleProfileEditSource;
  scopeStartDate: string;
}): EmployeeWorkScheduleProfileEditDraft {
  return {
    scopeStartDate: toText(args.scopeStartDate),
    workSchedulePatternId: toText(args.source.workSchedulePatternId),
  };
}

export function normalizeEmployeeWorkScheduleProfileEditDraft(
  draft: Partial<Record<keyof EmployeeWorkScheduleProfileEditDraft, unknown>>,
): EmployeeWorkScheduleProfileEditDraft {
  return {
    scopeStartDate: toText(draft.scopeStartDate),
    workSchedulePatternId: toText(draft.workSchedulePatternId),
  };
}

export function validateEmployeeWorkScheduleProfileEditDraft(
  draft: EmployeeWorkScheduleProfileEditDraft,
): EmployeeWorkScheduleProfileEditValidationCode | null {
  if (!draft.scopeStartDate) return "SCOPE_START_DATE_REQUIRED";
  if (!isValidIsoDay(draft.scopeStartDate)) return "SCOPE_START_DATE_INVALID";
  if (!draft.workSchedulePatternId) return "WORK_SCHEDULE_PATTERN_REQUIRED";
  return null;
}

export function toEmployeeWorkScheduleProfileEditPayload(draft: EmployeeWorkScheduleProfileEditDraft) {
  const normalized = normalizeEmployeeWorkScheduleProfileEditDraft(draft);
  return {
    scopeStartDate: normalized.scopeStartDate,
    workSchedulePatternId: normalized.workSchedulePatternId,
  };
}

export function humanizeEmployeeWorkScheduleProfileEditValidation(
  code: EmployeeWorkScheduleProfileEditValidationCode | string,
): string {
  const map: Record<string, string> = {
    SCOPE_START_DATE_REQUIRED: "Geçerlilik başlangıcı zorunludur.",
    SCOPE_START_DATE_INVALID: "Geçerlilik başlangıcı YYYY-AA-GG formatında olmalıdır.",
    WORK_SCHEDULE_PATTERN_REQUIRED: "Çalışma planı seçimi zorunludur.",
  };
  return map[code] ?? "Vardiya bilgileri kaydedilemedi. Lütfen alanları kontrol edin.";
}
