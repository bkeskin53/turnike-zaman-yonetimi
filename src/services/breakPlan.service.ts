import {
  deriveBreakPlanDuration,
  type BreakPlanDurationInput,
} from "@/src/domain/breakPlans/breakPlanDuration";
import {
  activateBreakPlan,
  countShiftTemplatesUsingBreakPlan,
  createBreakPlan,
  deactivateBreakPlan,
  findBreakPlanById,
  hardDeleteBreakPlan,
  listAllBreakPlans,
  listBreakPlans,
  updateBreakPlan,
} from "@/src/repositories/breakPlan.repo";

export type BreakPlanMutationInput = {
  code?: string | null;
  name?: string | null;
  plannedBreakHours?: string | number | null;
  plannedBreakHoursText?: string | number | null;
  plannedBreakDecimalHours?: string | number | null;
  plannedBreakMinutes?: number | null;
  isPaid?: boolean | null;
};

function firstNonBlank(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return undefined;
}

function toDurationInputForCreate(input: BreakPlanMutationInput): BreakPlanDurationInput {
  const plannedBreakHours = firstNonBlank(
    input.plannedBreakHours,
    input.plannedBreakHoursText,
    input.plannedBreakDecimalHours
  );

  return {
    code: String(input.code ?? ""),
    name: String(input.name ?? ""),
    plannedBreakHours: plannedBreakHours as string | number | undefined,
    plannedBreakMinutes: input.plannedBreakMinutes ?? null,
    isPaid: input.isPaid === true,
  };
}

function toDurationInputForUpdate(
  input: BreakPlanMutationInput,
  existing: {
    code: string;
    name: string;
    plannedBreakMinutes: number;
    isPaid: boolean;
  }
): BreakPlanDurationInput {
  const plannedBreakHours = firstNonBlank(
    input.plannedBreakHours,
    input.plannedBreakHoursText,
    input.plannedBreakDecimalHours
  );

  const hasPlannedBreakInput =
    plannedBreakHours !== undefined || input.plannedBreakMinutes != null;

  return {
    code: input.code != null ? String(input.code) : existing.code,
    name: input.name != null ? String(input.name) : existing.name,
    plannedBreakHours: plannedBreakHours as string | number | undefined,
    plannedBreakMinutes: hasPlannedBreakInput
      ? input.plannedBreakMinutes ?? null
      : existing.plannedBreakMinutes,
    isPaid: input.isPaid == null ? existing.isPaid : input.isPaid === true,
  };
}

export async function getBreakPlanById(companyId: string, id: string) {
  return findBreakPlanById(companyId, id);
}

export async function listBreakPlansForCompany(companyId: string) {
  return listBreakPlans(companyId);
}

export async function listAllBreakPlansForCompany(companyId: string) {
  return listAllBreakPlans(companyId);
}

export async function createBreakPlanForCompany(companyId: string, input: BreakPlanMutationInput) {
  const derived = deriveBreakPlanDuration(toDurationInputForCreate(input));

  return createBreakPlan({
    companyId,
    code: derived.code,
    name: derived.name,
    plannedBreakMinutes: derived.plannedBreakMinutes,
    isPaid: derived.isPaid,
  });
}

export async function updateBreakPlanForCompany(
  companyId: string,
  id: string,
  input: BreakPlanMutationInput
) {
  const existing = await findBreakPlanById(companyId, id);
  if (!existing) throw new Error("BREAK_PLAN_NOT_FOUND");

  const derived = deriveBreakPlanDuration(toDurationInputForUpdate(input, existing));

  return updateBreakPlan({
    companyId,
    id,
    code: derived.code,
    name: derived.name,
    plannedBreakMinutes: derived.plannedBreakMinutes,
    isPaid: derived.isPaid,
  });
}

export async function deactivateBreakPlanForCompany(companyId: string, id: string) {
  const existing = await findBreakPlanById(companyId, id);
  if (!existing) throw new Error("BREAK_PLAN_NOT_FOUND");

  await deactivateBreakPlan(companyId, id);
  return { ...existing, isActive: false };
}

export async function activateBreakPlanForCompany(companyId: string, id: string) {
  const existing = await findBreakPlanById(companyId, id);
  if (!existing) throw new Error("BREAK_PLAN_NOT_FOUND");

  await activateBreakPlan(companyId, id);
  return { ...existing, isActive: true };
}

export async function hardDeleteBreakPlanForCompany(companyId: string, id: string) {
  const existing = await findBreakPlanById(companyId, id);
  if (!existing) throw new Error("BREAK_PLAN_NOT_FOUND");

  const linkedShiftTemplateCount = await countShiftTemplatesUsingBreakPlan(companyId, id);
  await hardDeleteBreakPlan(companyId, id);

  return {
    item: existing,
    linkedShiftTemplateCount,
  };
}