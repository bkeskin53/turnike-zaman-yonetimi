import { getCompanyBundle } from "@/src/services/company.service";
import { dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";
import {
  createWorkScheduleAssignment,
  deleteWorkScheduleAssignment,
  listWorkScheduleAssignments,
} from "@/src/repositories/workSchedule.repo";

export async function listAssignments() {
  const { company } = await getCompanyBundle();
  const items = await listWorkScheduleAssignments(company.id);
  return { items };
}

export async function createAssignment(input: {
  scope: "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH";
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

  const scope = String(input.scope ?? "").trim() as any;
  const patternId = String(input.patternId ?? "").trim();
  if (!patternId) throw new Error("PATTERN_ID_REQUIRED");
  if (!scope) throw new Error("SCOPE_REQUIRED");

  const priority =
    typeof input.priority === "number" && Number.isFinite(input.priority)
      ? Math.trunc(input.priority)
      : 0;

  const validFrom = input.validFromDayKey
    ? isISODate(input.validFromDayKey)
      ? dbDateFromDayKey(input.validFromDayKey)
      : (() => {
          throw new Error("VALID_FROM_INVALID");
        })()
    : null;

  const validTo = input.validToDayKey
    ? isISODate(input.validToDayKey)
      ? dbDateFromDayKey(input.validToDayKey)
      : (() => {
          throw new Error("VALID_TO_INVALID");
        })()
    : null;

  // Scope guard: ensure the relevant FK is present.
  if (scope === "EMPLOYEE" && !input.employeeId) throw new Error("EMPLOYEE_REQUIRED");
  if (scope === "EMPLOYEE_SUBGROUP" && !input.employeeSubgroupId) throw new Error("SUBGROUP_REQUIRED");
  if (scope === "EMPLOYEE_GROUP" && !input.employeeGroupId) throw new Error("GROUP_REQUIRED");
  if (scope === "BRANCH" && !input.branchId) throw new Error("BRANCH_REQUIRED");

  return createWorkScheduleAssignment({
    companyId: company.id,
    scope,
    patternId,
    priority,
    validFrom,
    validTo,
    employeeId: input.employeeId ?? null,
    employeeSubgroupId: input.employeeSubgroupId ?? null,
    employeeGroupId: input.employeeGroupId ?? null,
    branchId: input.branchId ?? null,
  });
}

export async function deleteAssignment(input: { id: string }) {
  const { company } = await getCompanyBundle();
  const id = String(input.id ?? "").trim();
  if (!id) throw new Error("ID_REQUIRED");
  return deleteWorkScheduleAssignment(company.id, id);
}