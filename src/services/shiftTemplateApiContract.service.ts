import {
  deriveExpectedWorkMinutes,
  formatMinutesAsDecimalHoursText,
  formatMinutesAsHumanDurationText,
} from "@/src/domain/shiftTemplates/shiftTemplateClock";
import type { ShiftTemplateMutationInput } from "@/src/services/shiftTemplate.service";

function firstNonBlank(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return String(value);
}

function optionalNullableId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (String(value).trim() === "") return undefined;
  return Number(value);
}

export function toShiftTemplateMutationInput(body: any): ShiftTemplateMutationInput {
  const plannedWorkHours = firstNonBlank(
    body?.plannedWorkHours,
    body?.plannedWorkHoursText,
    body?.plannedWorkDecimalHours
  );

  return {
    shiftCode: optionalString(body?.shiftCode),
    plannedWorkHours: plannedWorkHours as string | number | undefined,
    plannedWorkMinutes: optionalNumber(body?.plannedWorkMinutes),
    breakPlanId: optionalNullableId(body?.breakPlanId),
    startTime: optionalNullableString(body?.startTime),
    endTime: optionalNullableString(body?.endTime),
  };
}

export function isShiftTemplateMutationValidationError(e: unknown) {
  const msg = typeof (e as any)?.message === "string" ? (e as any).message : "";
  return (
    msg === "PLANNED_WORK_HOURS_REQUIRED" ||
    msg.startsWith("PLANNED_WORK_") ||
    msg.startsWith("SHIFT_START_TIME_") ||
    msg.startsWith("BREAK_PLAN_")
  );
}

export function toShiftTemplateDto<T extends Record<string, any>>(item: T) {
  const plannedWorkMinutes = Number(item?.plannedWorkMinutes ?? 0);
  const breakPlan = item?.breakPlan ?? null;
  const plannedBreakMinutes =
    breakPlan && typeof breakPlan.plannedBreakMinutes === "number"
      ? Number(breakPlan.plannedBreakMinutes)
      : null;
  const expectedWorkMinutes = deriveExpectedWorkMinutes({
    plannedWorkMinutes,
    breakPlan: breakPlan
      ? {
          plannedBreakMinutes,
          isPaid: Boolean(breakPlan.isPaid),
        }
      : null,
  });

  return {
    ...item,
    plannedWorkMinutes,
    plannedWorkHoursText: formatMinutesAsDecimalHoursText(plannedWorkMinutes),
    plannedWorkHumanText: formatMinutesAsHumanDurationText(plannedWorkMinutes),
    expectedWorkMinutes,
    expectedWorkHoursText: formatMinutesAsDecimalHoursText(expectedWorkMinutes),
    expectedWorkHumanText: formatMinutesAsHumanDurationText(expectedWorkMinutes),
    breakPlanId: item?.breakPlanId ?? null,
    breakPlan: breakPlan
      ? {
          id: breakPlan.id,
          code: breakPlan.code,
          name: breakPlan.name,
          plannedBreakMinutes,
          plannedBreakHoursText:
            plannedBreakMinutes == null ? null : formatMinutesAsDecimalHoursText(plannedBreakMinutes),
          plannedBreakHumanText:
            plannedBreakMinutes == null ? null : formatMinutesAsHumanDurationText(plannedBreakMinutes),
          isPaid: Boolean(breakPlan.isPaid),
          payTypeText: breakPlan.isPaid ? "Ücretli" : "Ücretsiz",
          isActive: Boolean(breakPlan.isActive),
        }
      : null,
  };
}

export function toShiftTemplateDtos<T extends Record<string, any>>(items: T[]) {
  return items.map((item) => toShiftTemplateDto(item));
}

export function shiftTemplateAuditDetails(
  op: string,
  item: Record<string, any> | null | undefined,
  extra: Record<string, any> = {}
) {
  const plannedWorkMinutes = Number(item?.plannedWorkMinutes ?? 0);
  const expectedWorkMinutes = deriveExpectedWorkMinutes({
    plannedWorkMinutes,
    breakPlan: item?.breakPlan
      ? {
          plannedBreakMinutes: Number(item.breakPlan.plannedBreakMinutes ?? 0),
          isPaid: Boolean(item.breakPlan.isPaid),
        }
      : null,
  });

  return {
    op,
    shiftTemplateId: item?.id ?? null,
    shiftCode: item?.shiftCode ?? null,
    signature: item?.signature ?? null,
    startTime: item?.startTime ?? null,
    endTime: item?.endTime ?? null,
    spansMidnight: item?.spansMidnight ?? null,
    plannedWorkMinutes,
    plannedWorkHoursText: formatMinutesAsDecimalHoursText(plannedWorkMinutes),
    expectedWorkMinutes,
    expectedWorkHoursText: formatMinutesAsDecimalHoursText(expectedWorkMinutes),
    breakPlanId: item?.breakPlanId ?? null,
    breakPlanCode: item?.breakPlan?.code ?? null,
    ...extra,
  };
}