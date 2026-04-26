import {
  formatBreakMinutesAsDecimalHoursText,
  formatBreakMinutesAsHumanDurationText,
} from "@/src/domain/breakPlans/breakPlanDuration";
import type { BreakPlanMutationInput } from "@/src/services/breakPlan.service";

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

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (String(value).trim() === "") return undefined;
  return Number(value);
}

export function toBreakPlanMutationInput(body: any): BreakPlanMutationInput {
  const plannedBreakHours = firstNonBlank(
    body?.plannedBreakHours,
    body?.plannedBreakHoursText,
    body?.plannedBreakDecimalHours
  );

  return {
    code: optionalString(body?.code),
    name: optionalString(body?.name),
    plannedBreakHours: plannedBreakHours as string | number | undefined,
    plannedBreakMinutes: optionalNumber(body?.plannedBreakMinutes),
    isPaid: body?.isPaid == null ? undefined : Boolean(body.isPaid),
  };
}

export function isBreakPlanMutationValidationError(e: unknown) {
  const msg = typeof (e as any)?.message === "string" ? (e as any).message : "";
  return (
    msg === "BREAK_PLAN_NOT_FOUND" ||
    msg.startsWith("BREAK_PLAN_CODE_") ||
    msg.startsWith("BREAK_PLAN_NAME_") ||
    msg.startsWith("BREAK_DURATION_HOURS_") ||
    msg.startsWith("BREAK_DURATION_MINUTES_")
  );
}

export function toBreakPlanDto<T extends Record<string, any>>(item: T) {
  const plannedBreakMinutes = Number(item?.plannedBreakMinutes ?? 0);

  return {
    ...item,
    plannedBreakMinutes,
    plannedBreakHoursText: formatBreakMinutesAsDecimalHoursText(plannedBreakMinutes),
    plannedBreakHumanText: formatBreakMinutesAsHumanDurationText(plannedBreakMinutes),
    payType: item?.isPaid ? "PAID" : "UNPAID",
    payTypeText: item?.isPaid ? "Ücretli" : "Ücretsiz",
  };
}

export function toBreakPlanDtos<T extends Record<string, any>>(items: T[]) {
  return items.map((item) => toBreakPlanDto(item));
}

export function breakPlanAuditDetails(
  op: string,
  item: Record<string, any> | null | undefined,
  extra: Record<string, any> = {}
) {
  const plannedBreakMinutes = Number(item?.plannedBreakMinutes ?? 0);

  return {
    op,
    breakPlanId: item?.id ?? null,
    code: item?.code ?? null,
    name: item?.name ?? null,
    plannedBreakMinutes,
    plannedBreakHoursText: formatBreakMinutesAsDecimalHoursText(plannedBreakMinutes),
    isPaid: item?.isPaid ?? null,
    isActive: item?.isActive ?? null,
    ...extra,
  };
}