import { getCompanyBundle } from "@/src/services/company.service";
import { dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";
import {
  createWorkScheduleAssignment,
  deleteWorkScheduleAssignment,
  listWorkScheduleAssignments,
} from "@/src/repositories/workSchedule.repo";

export type WorkScheduleAssignmentScope = "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH";

export function validateWorkScheduleAssignmentDraft(input: {
  scope: WorkScheduleAssignmentScope;
  patternId?: string | null;
  employeeId?: string | null;
  employeeSubgroupId?: string | null;
  employeeGroupId?: string | null;
  branchId?: string | null;
  validFromDayKey?: string | null;
  validToDayKey?: string | null;
  priority?: number;
}) {
  const scope = String(input.scope ?? "").trim() as WorkScheduleAssignmentScope;
  if (!scope) throw new Error("SCOPE_REQUIRED");

  const patternId = String(input.patternId ?? "").trim();
  if (input.patternId !== undefined && !patternId) throw new Error("PATTERN_ID_REQUIRED");

  const priority =
    typeof input.priority === "number" && Number.isFinite(input.priority)
      ? Math.trunc(input.priority)
      : 0;

  const validFromDayKey = input.validFromDayKey ? String(input.validFromDayKey).trim() : null;
  const validToDayKey = input.validToDayKey ? String(input.validToDayKey).trim() : null;

  if (validFromDayKey && !isISODate(validFromDayKey)) throw new Error("VALID_FROM_INVALID");
  if (validToDayKey && !isISODate(validToDayKey)) throw new Error("VALID_TO_INVALID");
  if (validFromDayKey && validToDayKey && validToDayKey < validFromDayKey) {
    throw new Error("VALID_RANGE_INVALID");
  }

  if (scope === "EMPLOYEE" && !input.employeeId) throw new Error("EMPLOYEE_REQUIRED");
  if (scope === "EMPLOYEE_SUBGROUP" && !input.employeeSubgroupId) throw new Error("SUBGROUP_REQUIRED");
  if (scope === "EMPLOYEE_GROUP" && !input.employeeGroupId) throw new Error("GROUP_REQUIRED");
  if (scope === "BRANCH" && !input.branchId) throw new Error("BRANCH_REQUIRED");

  return {
    scope,
    patternId: patternId || null,
    priority,
    validFromDayKey,
    validToDayKey,
    validFrom: validFromDayKey ? dbDateFromDayKey(validFromDayKey) : null,
    validTo: validToDayKey ? dbDateFromDayKey(validToDayKey) : null,
    employeeId: input.employeeId ? String(input.employeeId) : null,
    employeeSubgroupId: input.employeeSubgroupId ? String(input.employeeSubgroupId) : null,
    employeeGroupId: input.employeeGroupId ? String(input.employeeGroupId) : null,
    branchId: input.branchId ? String(input.branchId) : null,
  };
}

export async function listAssignments() {
  const { company } = await getCompanyBundle();
  const items = await listWorkScheduleAssignments(company.id);
  return { items };
}

export async function createAssignment(input: {
  scope: WorkScheduleAssignmentScope;
  patternId: string;
  employeeId?: string | null;
  employeeSubgroupId?: string | null;
  employeeGroupId?: string | null;
  branchId?: string | null;
  validFromDayKey?: string | null;
  validToDayKey?: string | null;
  priority?: number;
}) {
  const { company } = await getCompanyBundle();
  const normalized = validateWorkScheduleAssignmentDraft(input);
  if (!normalized.patternId) throw new Error("PATTERN_ID_REQUIRED");

  return createWorkScheduleAssignment({
    companyId: company.id,
    scope: normalized.scope,
    patternId: normalized.patternId,
    priority: normalized.priority,
    validFrom: normalized.validFrom,
    validTo: normalized.validTo,
    employeeId: normalized.employeeId,
    employeeSubgroupId: normalized.employeeSubgroupId,
    employeeGroupId: normalized.employeeGroupId,
    branchId: normalized.branchId,
  });
}

export async function deleteAssignment(input: { id: string }) {
  const { company } = await getCompanyBundle();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");
  return deleteWorkScheduleAssignment(company.id, id);
}