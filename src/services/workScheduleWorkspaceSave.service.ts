import { prisma } from "@/src/repositories/prisma";
import {
  createWorkScheduleAssignmentsInTx,
  deleteWorkScheduleAssignmentsByIdsInTx,
  findWorkScheduleAssignmentsByIdsInTx,
  findWorkSchedulePatternByIdInTx,
  updateWorkSchedulePatternInTx,
} from "@/src/repositories/workSchedule.repo";
import { getCompanyBundle } from "@/src/services/company.service";
import {
  assertWorkSchedulePatternUniqueness,
  ensureWorkSchedulePatternShrinkGuard,
  validateWorkSchedulePatternDraft,
} from "@/src/services/workSchedulePattern.service";
import {
  type WorkScheduleAssignmentScope,
  validateWorkScheduleAssignmentDraft,
} from "@/src/services/workScheduleAssignment.service";

function normalizeAssignmentDeleteIds(ids: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function patternReferenceDayKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizePatternDayShiftTemplateIds(value: Array<string | null>) {
  return value.map((item) => {
    const normalized = String(item ?? "").trim();
    return normalized ? normalized : null;
  });
}

function patternStateChanged(
  current: {
    code: string;
    name: string;
    cycleLengthDays: number;
    referenceDate: string | Date;
    dayShiftTemplateIds: Array<string | null>;
  },
  next: {
    code: string;
    name: string;
    cycleLengthDays: number;
    referenceDayKey: string;
    dayShiftTemplateIds: Array<string | null>;
  }
) {
  if (String(current.code ?? "").trim() !== next.code) return true;
  if (String(current.name ?? "").trim() !== next.name) return true;
  if (Number(current.cycleLengthDays ?? 0) !== Number(next.cycleLengthDays ?? 0)) return true;
  if (patternReferenceDayKey(current.referenceDate) !== next.referenceDayKey) return true;

  const currentDays = normalizePatternDayShiftTemplateIds(Array.isArray(current.dayShiftTemplateIds) ? current.dayShiftTemplateIds : []);
  if (currentDays.length !== next.dayShiftTemplateIds.length) return true;
  for (let i = 0; i < currentDays.length; i++) {
    if ((currentDays[i] ?? null) !== (next.dayShiftTemplateIds[i] ?? null)) return true;
  }
  return false;
}

export async function saveWorkScheduleWorkspace(input: {
  patternId: string;
  pattern: {
    code: string;
    name: string;
    cycleLengthDays: number;
    referenceDayKey: string;
    dayShiftTemplateIds: Array<string | null>;
  };
  assignmentCreateDrafts?: Array<{
    scope: WorkScheduleAssignmentScope;
    employeeId?: string | null;
    employeeSubgroupId?: string | null;
    employeeGroupId?: string | null;
    branchId?: string | null;
    validFromDayKey?: string | null;
    validToDayKey?: string | null;
    priority?: number;
  }>;
  assignmentDeleteIds?: string[];
}) {
  const { company } = await getCompanyBundle();
  const patternId = String(input.patternId ?? "").trim();
  if (!patternId) throw new Error("PATTERN_ID_REQUIRED");

  const normalizedPattern = validateWorkSchedulePatternDraft(input.pattern);
  const normalizedDeleteIds = normalizeAssignmentDeleteIds(
    Array.isArray(input.assignmentDeleteIds) ? input.assignmentDeleteIds : []
  );
  const normalizedCreateDrafts = (Array.isArray(input.assignmentCreateDrafts) ? input.assignmentCreateDrafts : []).map(
    (draft) => validateWorkScheduleAssignmentDraft({ ...draft, patternId })
  );

  return prisma.$transaction(async (tx) => {
    const currentPattern = await findWorkSchedulePatternByIdInTx(tx, company.id, patternId);
    if (!currentPattern) throw new Error("NOT_FOUND");

    await assertWorkSchedulePatternUniqueness({
      companyId: company.id,
      code: normalizedPattern.code,
      name: normalizedPattern.name,
      currentPatternId: patternId,
      tx,
    });
    ensureWorkSchedulePatternShrinkGuard(currentPattern, normalizedPattern.dayShiftTemplateIds);

    const assignmentDeletes = normalizedDeleteIds.length
      ? await findWorkScheduleAssignmentsByIdsInTx(tx, company.id, normalizedDeleteIds)
      : [];
    if (assignmentDeletes.length !== normalizedDeleteIds.length) {
      throw new Error("ASSIGNMENT_NOT_FOUND");
    }
    if (assignmentDeletes.some((assignment) => String(assignment.patternId ?? "") !== patternId)) {
      throw new Error("ASSIGNMENT_PATTERN_MISMATCH");
    }

    const updatedPattern = await updateWorkSchedulePatternInTx(tx, {
      companyId: company.id,
      id: patternId,
      code: normalizedPattern.code,
      name: normalizedPattern.name,
      cycleLengthDays: normalizedPattern.cycleLengthDays,
      referenceDate: normalizedPattern.referenceDate,
      dayShiftTemplateIds: normalizedPattern.dayShiftTemplateIds,
      isActive: currentPattern.isActive,
    });

    const deletedAssignmentCount = normalizedDeleteIds.length
      ? await deleteWorkScheduleAssignmentsByIdsInTx(tx, company.id, normalizedDeleteIds)
      : 0;

    const createdAssignmentCount = normalizedCreateDrafts.length
      ? await createWorkScheduleAssignmentsInTx(tx, {
          companyId: company.id,
          items: normalizedCreateDrafts.map((draft) => ({
            scope: draft.scope,
            patternId,
            priority: draft.priority,
            validFrom: draft.validFrom,
            validTo: draft.validTo,
            employeeId: draft.employeeId,
            employeeSubgroupId: draft.employeeSubgroupId,
            employeeGroupId: draft.employeeGroupId,
            branchId: draft.branchId,
          })),
        })
      : 0;

    return {
      item: updatedPattern,
      summary: {
        patternChanged: patternStateChanged(currentPattern, normalizedPattern),
        createdAssignmentCount,
        deletedAssignmentCount,
      },
    };
  });
}