import type { ShiftSignature } from "@/src/services/shiftPlan.service";
import {
  derivePlannedWorkMinutesFromShiftTimes,
  deriveExpectedWorkMinutes,
  deriveShiftTemplateClock,
  isOffShiftTemplateCode,
  type ShiftTemplateClock,
} from "@/src/domain/shiftTemplates/shiftTemplateClock";
import {
  listShiftTemplates as listShiftTemplatesRepo,
  listAllShiftTemplates as listAllShiftTemplatesRepo,
  createShiftTemplate,
  updateShiftTemplate,
  deactivateShiftTemplate,
  activateShiftTemplate,
  findShiftTemplateById,
  findShiftTemplateBySignature,
} from "@/src/repositories/shiftTemplate.repo";
import { findActiveBreakPlanById } from "@/src/repositories/breakPlan.repo";

export type ShiftTemplateMutationInput = {
  shiftCode?: string | null;
  plannedWorkHours?: string | number | null;
  plannedWorkMinutes?: number | null;
  breakPlanId?: string | null;

  /**
   * Canonical start clock. Blank/null means 00:00 at domain level.
   */
  startTime?: string | null;

  /**
   * Legacy transition input. UI/API will be moved away from this in the next
   * patches, but keeping it here avoids breaking the current page during the
   * contract migration chain.
   */
  endTime?: string | null;
};

function cleanShiftCode(value?: string | null): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function cleanOptionalId(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

type ResolvedBreakPlanForShiftTemplate = {
  id: string;
  plannedBreakMinutes: number;
  isPaid: boolean;
} | null;

async function resolveBreakPlanForMutation(
  companyId: string,
  input: ShiftTemplateMutationInput,
  existingBreakPlan?: ResolvedBreakPlanForShiftTemplate
): Promise<ResolvedBreakPlanForShiftTemplate> {
  const requested = cleanOptionalId(input.breakPlanId);
  if (requested === undefined) return existingBreakPlan ?? null;
  if (requested === null) return null;

  const breakPlan = await findActiveBreakPlanById(companyId, requested);
  if (!breakPlan) throw new Error("BREAK_PLAN_NOT_FOUND");
  return {
    id: breakPlan.id,
    plannedBreakMinutes: breakPlan.plannedBreakMinutes,
    isPaid: breakPlan.isPaid,
  };
}

function assertBreakPlanFitsPlannedWork(clock: ShiftTemplateClock, breakPlan: ResolvedBreakPlanForShiftTemplate) {
  if (!breakPlan) return;
  deriveExpectedWorkMinutes({
    plannedWorkMinutes: clock.plannedWorkMinutes,
    breakPlan,
  });
}

function hasPlannedWorkInput(input: ShiftTemplateMutationInput): boolean {
  if (input.plannedWorkMinutes != null) return true;
  if (input.plannedWorkHours == null) return false;
  return String(input.plannedWorkHours).trim() !== "";
}

function hasLegacyEndTime(input: ShiftTemplateMutationInput): boolean {
  return String(input.endTime ?? "").trim() !== "";
}

function deriveShiftTemplateClockForMutation(
  input: ShiftTemplateMutationInput,
  effectiveShiftCode?: string | null
): ShiftTemplateClock {
  const shiftCode = cleanShiftCode(input.shiftCode) ?? cleanShiftCode(effectiveShiftCode);

  if (hasPlannedWorkInput(input)) {
    return deriveShiftTemplateClock({
      shiftCode,
      plannedWorkHours: input.plannedWorkHours,
      plannedWorkMinutes: input.plannedWorkMinutes,
      startTime: input.startTime,
    });
  }

  if (hasLegacyEndTime(input)) {
    const plannedWorkMinutes = derivePlannedWorkMinutesFromShiftTimes(
      String(input.startTime ?? ""),
      String(input.endTime ?? ""),
      { allowZero: isOffShiftTemplateCode(shiftCode) }
    );
    return deriveShiftTemplateClock({
      shiftCode,
      plannedWorkMinutes,
      startTime: input.startTime,
    });
  }

  throw new Error("PLANNED_WORK_HOURS_REQUIRED");
}

export async function getShiftTemplateById(companyId: string, id: string) {
  return findShiftTemplateById(companyId, id);
}

export async function findOrCreateShiftTemplate(companyId: string, sig: ShiftSignature) {
  const existing = await findShiftTemplateBySignature(companyId, sig.signature);
  if (existing) return existing;
  const clock = deriveShiftTemplateClock({
    shiftCode: sig.signature,
    plannedWorkMinutes: derivePlannedWorkMinutesFromShiftTimes(sig.startTime, sig.endTime),
    startTime: sig.startTime,
  });
  return createShiftTemplate({
    companyId,
    shiftCode: sig.signature,
    signature: clock.signature,
    startTime: clock.startTime,
    endTime: clock.endTime,
    spansMidnight: clock.spansMidnight,
    plannedWorkMinutes: clock.plannedWorkMinutes,
    breakPlanId: null,
  });
}

export async function listShiftTemplates(companyId: string) {
  return listShiftTemplatesRepo(companyId);
}

export async function listAllShiftTemplates(companyId: string) {
  return listAllShiftTemplatesRepo(companyId);
}

export async function createShiftTemplateForCompany(
  companyId: string,
  input: ShiftTemplateMutationInput
) {
  const explicitShiftCode = cleanShiftCode(input.shiftCode);
  const clock = deriveShiftTemplateClockForMutation(input, explicitShiftCode);
  const shiftCode = explicitShiftCode ?? clock.signature;
  const breakPlan = await resolveBreakPlanForMutation(companyId, input, null);
  assertBreakPlanFitsPlannedWork(clock, breakPlan);

  return createShiftTemplate({
    companyId,
    shiftCode,
    signature: clock.signature,
    startTime: clock.startTime,
    endTime: clock.endTime,
    spansMidnight: clock.spansMidnight,
    plannedWorkMinutes: clock.plannedWorkMinutes,
    breakPlanId: breakPlan?.id ?? null,
  });
}

export async function updateShiftTemplateForCompany(
  companyId: string,
  id: string,
  input: ShiftTemplateMutationInput
) {
 // IMPORTANT (B-model): shiftCode is a stable identity. Do not change it unless explicitly provided.
  const existing = await getShiftTemplateById(companyId, id);
  if (!existing) throw new Error("SHIFT_TEMPLATE_NOT_FOUND");

  const shiftCode =
    cleanShiftCode(input.shiftCode)
      ? cleanShiftCode(input.shiftCode)
      : (existing as any).shiftCode;
  const clock = deriveShiftTemplateClockForMutation(input, shiftCode);
  const breakPlan = await resolveBreakPlanForMutation(
    companyId,
    input,
    (existing as any).breakPlan
      ? {
          id: (existing as any).breakPlan.id,
          plannedBreakMinutes: (existing as any).breakPlan.plannedBreakMinutes,
          isPaid: (existing as any).breakPlan.isPaid,
        }
      : null
  );
  assertBreakPlanFitsPlannedWork(clock, breakPlan);

  return updateShiftTemplate({
    companyId,
    shiftCode,
    id,
    signature: clock.signature,
    startTime: clock.startTime,
    endTime: clock.endTime,
    spansMidnight: clock.spansMidnight,
    plannedWorkMinutes: clock.plannedWorkMinutes,
    breakPlanId: breakPlan?.id ?? null,
  });
}

export async function deactivateShiftTemplateForCompany(companyId: string, id: string) {
  return deactivateShiftTemplate(companyId, id);
}

export async function activateShiftTemplateForCompany(companyId: string, id: string) {
  return activateShiftTemplate(companyId, id);
}