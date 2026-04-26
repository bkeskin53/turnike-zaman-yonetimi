import { getCompanyBundle } from "@/src/services/company.service";
import { dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";
import {
  createWorkSchedulePattern,
  findWorkSchedulePatternByCode,
  findWorkSchedulePatternByCodeInTx,
  findWorkSchedulePatternById,
  findWorkSchedulePatternByName,
  findWorkSchedulePatternByNameInTx,
  listWorkSchedulePatterns,
  updateWorkSchedulePattern,
  type WorkScheduleMutationTx,
  deleteWorkSchedulePattern,
} from "@/src/repositories/workSchedule.repo";

export function normalizeWorkSchedulePatternCode(code: string): string {
  return String(code ?? "").trim().toUpperCase();
}

export function normalizeWorkSchedulePatternName(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function normalizeWorkSchedulePatternDayShiftTemplateIds(dayShiftTemplateIds: Array<string | null>) {
  return dayShiftTemplateIds.map((item) => {
    const value = String(item ?? "").trim();
    return value ? value : null;
  });
}

function toReferenceDayKey(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function currentPatternDayShiftTemplateIds(current: { dayShiftTemplateIds?: Array<string | null> }) {
  return normalizeWorkSchedulePatternDayShiftTemplateIds(Array.isArray(current.dayShiftTemplateIds) ? current.dayShiftTemplateIds : []);
}

export function validateWorkSchedulePatternDraft(input: {
  code: string;
  name: string;
  cycleLengthDays: number;
  referenceDayKey: string;
  dayShiftTemplateIds: Array<string | null>;
}) {
  const code = normalizeWorkSchedulePatternCode(input.code);
  const name = normalizeWorkSchedulePatternName(input.name);
  if (!code) throw new Error("CODE_REQUIRED");
  if (!name) throw new Error("NAME_REQUIRED");

  const cycleLengthDays = Number(input.cycleLengthDays);
  if (!Number.isInteger(cycleLengthDays) || cycleLengthDays <= 0 || cycleLengthDays > 366) {
    throw new Error("CYCLE_INVALID");
  }

  const referenceDayKey = String(input.referenceDayKey ?? "").trim();
  if (!isISODate(referenceDayKey)) throw new Error("REFERENCE_DATE_INVALID");

  if (!Array.isArray(input.dayShiftTemplateIds) || input.dayShiftTemplateIds.length !== cycleLengthDays) {
    throw new Error("DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH");
  }

  return {
    code,
    name,
    cycleLengthDays,
    referenceDayKey,
    referenceDate: dbDateFromDayKey(referenceDayKey),
    dayShiftTemplateIds: normalizeWorkSchedulePatternDayShiftTemplateIds(input.dayShiftTemplateIds),
  };
}

export function ensureWorkSchedulePatternShrinkGuard(
  current: { cycleLengthDays: number; dayShiftTemplateIds?: Array<string | null> },
  nextDayShiftTemplateIds: Array<string | null>
) {
  const currentCycleLength = Number(current.cycleLengthDays ?? 0);
  if (nextDayShiftTemplateIds.length >= currentCycleLength) return;

  const removedTail = currentPatternDayShiftTemplateIds(current).slice(nextDayShiftTemplateIds.length);
  if (removedTail.some((value) => value !== null)) {
    throw new Error("NON_OFF_TAIL_REMOVAL_FORBIDDEN");
  }
}

export async function assertWorkSchedulePatternUniqueness(input: {
  companyId: string;
  code: string;
  name: string;
  currentPatternId?: string;
  tx?: WorkScheduleMutationTx;
}) {
  const exists = input.tx
    ? await findWorkSchedulePatternByCodeInTx(input.tx, input.companyId, input.code)
    : await findWorkSchedulePatternByCode(input.companyId, input.code);
  if (exists && exists.id !== input.currentPatternId) throw new Error("CODE_ALREADY_EXISTS");

  const sameName = input.tx
    ? await findWorkSchedulePatternByNameInTx(input.tx, input.companyId, input.name)
    : await findWorkSchedulePatternByName(input.companyId, input.name);
  if (sameName && sameName.id !== input.currentPatternId) throw new Error("NAME_ALREADY_EXISTS");
}

export async function listPatterns() {
  const { company } = await getCompanyBundle();
  const items = await listWorkSchedulePatterns(company.id);
  return { items };
}

export async function createPattern(input: {
  code: string;
  name: string;
  cycleLengthDays: number;
  referenceDayKey: string;
  dayShiftTemplateIds: Array<string | null>;
}) {
  const { company } = await getCompanyBundle();
  const normalized = validateWorkSchedulePatternDraft(input);
  await assertWorkSchedulePatternUniqueness({
    companyId: company.id,
    code: normalized.code,
    name: normalized.name,
  });

  return createWorkSchedulePattern({
    companyId: company.id,
    code: normalized.code,
    name: normalized.name,
    cycleLengthDays: normalized.cycleLengthDays,
    referenceDate: normalized.referenceDate,
    dayShiftTemplateIds: normalized.dayShiftTemplateIds,
    isActive: true,
  });
}

export async function updatePattern(input: {
  id: string;
  code?: string;
  name?: string;
  cycleLengthDays?: number;
  referenceDayKey?: string;
  dayShiftTemplateIds?: Array<string | null>;
  isActive?: boolean;
}) {
  const { company } = await getCompanyBundle();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");
  const current = await findWorkSchedulePatternById(company.id, id);
  if (!current) throw new Error("NOT_FOUND");

  const normalized = validateWorkSchedulePatternDraft({
    code: input.code ?? current.code,
    name: input.name ?? current.name,
    cycleLengthDays: input.cycleLengthDays ?? current.cycleLengthDays,
    referenceDayKey: input.referenceDayKey ?? toReferenceDayKey(current.referenceDate),
    dayShiftTemplateIds: input.dayShiftTemplateIds ?? currentPatternDayShiftTemplateIds(current),
  });

  ensureWorkSchedulePatternShrinkGuard(current, normalized.dayShiftTemplateIds);
  await assertWorkSchedulePatternUniqueness({
    companyId: company.id,
    code: normalized.code,
    name: normalized.name,
    currentPatternId: id,
  });

  return updateWorkSchedulePattern({
    companyId: company.id,
    id,
    code: normalized.code,
    name: normalized.name,
    cycleLengthDays: normalized.cycleLengthDays,
    referenceDate: normalized.referenceDate,
    dayShiftTemplateIds: normalized.dayShiftTemplateIds,
    ...(input.isActive != null ? { isActive: input.isActive } : {}),
  });
}

export async function deletePattern(input: { id: string }) {
  const { company } = await getCompanyBundle();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");

  const deleted = await deleteWorkSchedulePattern(company.id, id);
  if (!deleted) throw new Error("NOT_FOUND");
  return deleted;
}