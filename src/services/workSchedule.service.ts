import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { getShiftTemplateById } from "@/src/services/shiftTemplate.service";

// Local type (avoid circular import with shiftPlan.service)
export type ShiftSignature = {
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  signature: string;
};

export type WorkScheduleResolved =
  | { kind: "SHIFT"; shiftTemplateId: string; shiftCode: string | null; signature: ShiftSignature }
  | { kind: "OFF" };

function positiveMod(n: number, m: number): number {
  // JS % keeps sign; we need SAP-like positive modulo for pre-reference dates.
  return ((n % m) + m) % m;
}

function dayKeyFromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function scopeRank(scope: string): number {
  // Higher means more specific.
  switch (scope) {
    case "EMPLOYEE":
      return 4;
    case "EMPLOYEE_SUBGROUP":
      return 3;
    case "EMPLOYEE_GROUP":
      return 2;
    case "BRANCH":
      return 1;
    default:
      return 0;
  }
}

/**
 * Resolve period work schedule (SAP: Period Work Schedule) for employee on dayKey.
 * This is a fallback layer below planner (Weekly) and above policy.
 */
export async function resolveWorkScheduleShiftForEmployeeOnDate(args: {
  companyId: string;
  employeeId: string;
  dayKey: string; // YYYY-MM-DD
  timezone: string;
}): Promise<WorkScheduleResolved | null> {
  const dayDb = dbDateFromDayKey(args.dayKey);

  const emp = await prisma.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      branchId: true,
    },
  });
  if (!emp) return null;

  const candidates = await prisma.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      OR: [
        ...(emp.employeeSubgroupId ? [{ scope: "EMPLOYEE_SUBGROUP" as any, employeeSubgroupId: emp.employeeSubgroupId }] : []),
        ...(emp.employeeGroupId ? [{ scope: "EMPLOYEE_GROUP" as any, employeeGroupId: emp.employeeGroupId }] : []),
        ...(emp.branchId ? [{ scope: "BRANCH" as any, branchId: emp.branchId }] : []),
        { scope: "EMPLOYEE" as any, employeeId: emp.id },
      ],
      AND: [
        {
          OR: [{ validFrom: null }, { validFrom: { lte: dayDb } }],
        },
        {
          OR: [{ validTo: null }, { validTo: { gte: dayDb } }],
        },
      ],
    },
    include: { pattern: { include: { days: true } } },
  });

  const active = candidates.filter((a) => a.pattern?.isActive);
  if (active.length === 0) return null;

  active.sort((a, b) => {
    const sr = scopeRank(String(a.scope)) - scopeRank(String(b.scope));
    if (sr !== 0) return -sr;
    const pr = (a.priority ?? 0) - (b.priority ?? 0);
    if (pr !== 0) return -pr;
    return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
  });

  const chosen = active[0];
  const pattern = chosen.pattern;
  if (!pattern) return null;

  const cycle = pattern.cycleLengthDays;
  if (!Number.isInteger(cycle) || cycle <= 0) return null;

  const refDayKey = dayKeyFromDbDate(pattern.referenceDate);
  const tz = args.timezone || "Europe/Istanbul";

  const currentDay = DateTime.fromISO(args.dayKey, { zone: tz }).startOf("day");
  const refDay = DateTime.fromISO(refDayKey, { zone: tz }).startOf("day");
  const diffDays = Math.floor(currentDay.diff(refDay, "days").days);
  const idx = positiveMod(diffDays, cycle);

  // Enterprise first: child table (NULL => OFF)
  const dayRow = (pattern as any).days?.find?.((d: any) => d.dayIndex === idx);
  if (dayRow) {
    if (!dayRow.shiftTemplateId) {
      return { kind: "OFF" };
    }
    const tpl = await getShiftTemplateById(args.companyId, String(dayRow.shiftTemplateId));
    if (!tpl) return null;
    return {
      kind: "SHIFT",
      shiftTemplateId: tpl.id,
      shiftCode: (tpl as any).shiftCode ?? tpl.signature,
      signature: {
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        spansMidnight: tpl.spansMidnight,
        signature: tpl.signature,
      },
    };
  }

  // Legacy fallback: array (empty => OFF but legacy cannot represent NULL)
  const tplId = pattern.dayShiftTemplateIds?.[idx];
  if (!tplId) return { kind: "OFF" };

  const tpl = await getShiftTemplateById(args.companyId, tplId);
  if (!tpl) return null;

  return {
    kind: "SHIFT",
    shiftTemplateId: tpl.id,
    shiftCode: (tpl as any).shiftCode ?? tpl.signature,
    signature: { startTime: tpl.startTime, endTime: tpl.endTime, spansMidnight: tpl.spansMidnight, signature: tpl.signature },
  };
}