import { getCompanyBundle } from "@/src/services/company.service";
import { dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";
import {
  createWorkSchedulePattern,
  findWorkSchedulePatternByCode,
  findWorkSchedulePatternById,
  listWorkSchedulePatterns,
  updateWorkSchedulePattern,
} from "@/src/repositories/workSchedule.repo";

function normalizeCode(code: string): string {
  return String(code ?? "").trim().toUpperCase();
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
  const code = normalizeCode(input.code);
  if (!code) throw new Error("CODE_REQUIRED");
  if (!input.name || !String(input.name).trim()) throw new Error("NAME_REQUIRED");
  const cycle = Number(input.cycleLengthDays);
  if (!Number.isInteger(cycle) || cycle <= 0 || cycle > 366) throw new Error("CYCLE_INVALID");
  if (!isISODate(input.referenceDayKey)) throw new Error("REFERENCE_DATE_INVALID");
  if (!Array.isArray(input.dayShiftTemplateIds) || input.dayShiftTemplateIds.length !== cycle) {
    throw new Error("DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH");
  }

  const exists = await findWorkSchedulePatternByCode(company.id, code);
  if (exists) throw new Error("CODE_ALREADY_EXISTS");

  return createWorkSchedulePattern({
    companyId: company.id,
    code,
    name: String(input.name).trim(),
    cycleLengthDays: cycle,
    referenceDate: dbDateFromDayKey(input.referenceDayKey),
    // Enterprise OFF: null/"" => OFF (stored as NULL in child table, "" in legacy array)
    dayShiftTemplateIds: input.dayShiftTemplateIds.map((x) => (x == null ? "" : String(x))).map((x) => String(x).trim()),
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

  let cycle: number | undefined;
  if (input.cycleLengthDays != null) {
    cycle = Number(input.cycleLengthDays);
    if (!Number.isInteger(cycle) || cycle <= 0 || cycle > 366) throw new Error("CYCLE_INVALID");
  }

  let refDate: Date | undefined;
  if (input.referenceDayKey != null) {
    if (!isISODate(input.referenceDayKey)) throw new Error("REFERENCE_DATE_INVALID");
    refDate = dbDateFromDayKey(input.referenceDayKey);
  }

  if (input.dayShiftTemplateIds != null) {
    const expected = cycle ?? current.cycleLengthDays;
    if (!Array.isArray(input.dayShiftTemplateIds) || input.dayShiftTemplateIds.length !== expected) {
      throw new Error("DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH");
    }
  }

  const code = input.code != null ? normalizeCode(input.code) : undefined;
  if (code) {
    const other = await findWorkSchedulePatternByCode(company.id, code);
    if (other && other.id !== id) throw new Error("CODE_ALREADY_EXISTS");
  }

  return updateWorkSchedulePattern({
    companyId: company.id,
    id,
    ...(code != null ? { code } : {}),
    ...(input.name != null ? { name: String(input.name).trim() } : {}),
    ...(cycle != null ? { cycleLengthDays: cycle } : {}),
    ...(refDate != null ? { referenceDate: refDate } : {}),
    ...(input.dayShiftTemplateIds != null
      ? { dayShiftTemplateIds: input.dayShiftTemplateIds.map((x) => (x == null ? "" : String(x))).map((x) => String(x).trim()) }
      : {}),
    ...(input.isActive != null ? { isActive: input.isActive } : {}),
  });
}