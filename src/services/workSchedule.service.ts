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

type EmployeeCtx = {
  id: string;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  branchId: string | null;
};

type WorkScheduleAssignmentRow = {
  id: string;
  scope: any;
  employeeId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  branchId: string | null;
  priority: number | null;
  createdAt: Date;
  pattern: any;
};

/**
 * ✅ Batch work schedule resolver (recompute hot-path).
 * Same behavior as resolveWorkScheduleShiftForEmployeeOnDate, but eliminates N+1:
 * - no per-employee employee.findFirst
 * - no per-employee workScheduleAssignment.findMany
 * - no per-employee getShiftTemplateById
 */
export async function resolveWorkScheduleShiftsForEmployeesOnDate(args: {
  companyId: string;
  employees: EmployeeCtx[];
  dayKey: string; // YYYY-MM-DD
  timezone: string;
}): Promise<Map<string, WorkScheduleResolved | null>> {
  const out = new Map<string, WorkScheduleResolved | null>();
  const dayDb = dbDateFromDayKey(args.dayKey);
  const tz = args.timezone || "Europe/Istanbul";

  // Default all -> null
  for (const e of args.employees) out.set(e.id, null);
  if (args.employees.length === 0) return out;

  const employeeIds = args.employees.map((e) => e.id);
  const subgroupIds = Array.from(new Set(args.employees.map((e) => e.employeeSubgroupId).filter(Boolean))) as string[];
  const groupIds = Array.from(new Set(args.employees.map((e) => e.employeeGroupId).filter(Boolean))) as string[];
  const branchIds = Array.from(new Set(args.employees.map((e) => e.branchId).filter(Boolean))) as string[];

  // Build reverse indexes for fast assignment->employees expansion
  const subgroupToEmployees = new Map<string, string[]>();
  const groupToEmployees = new Map<string, string[]>();
  const branchToEmployees = new Map<string, string[]>();
  for (const e of args.employees) {
    if (e.employeeSubgroupId) {
      const arr = subgroupToEmployees.get(e.employeeSubgroupId) ?? [];
      arr.push(e.id);
      subgroupToEmployees.set(e.employeeSubgroupId, arr);
    }
    if (e.employeeGroupId) {
      const arr = groupToEmployees.get(e.employeeGroupId) ?? [];
      arr.push(e.id);
      groupToEmployees.set(e.employeeGroupId, arr);
    }
    if (e.branchId) {
      const arr = branchToEmployees.get(e.branchId) ?? [];
      arr.push(e.id);
      branchToEmployees.set(e.branchId, arr);
    }
  }

  const rows: WorkScheduleAssignmentRow[] = await prisma.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: dayDb } }] },
        { OR: [{ validTo: null }, { validTo: { gte: dayDb } }] },
      ],
      OR: [
        { scope: "EMPLOYEE" as any, employeeId: { in: employeeIds } },
        subgroupIds.length ? { scope: "EMPLOYEE_SUBGROUP" as any, employeeSubgroupId: { in: subgroupIds } } : undefined,
        groupIds.length ? { scope: "EMPLOYEE_GROUP" as any, employeeGroupId: { in: groupIds } } : undefined,
        branchIds.length ? { scope: "BRANCH" as any, branchId: { in: branchIds } } : undefined,
      ].filter(Boolean) as any,
    },
    include: { pattern: { include: { days: true } } },
  });

  // Expand assignments to employee buckets
  const buckets = new Map<string, WorkScheduleAssignmentRow[]>();
  function push(empId: string, a: WorkScheduleAssignmentRow) {
    const arr = buckets.get(empId) ?? [];
    arr.push(a);
    buckets.set(empId, arr);
  }

  for (const a of rows) {
    if (!a.pattern?.isActive) continue;
    const scope = String(a.scope);
    if (scope === "EMPLOYEE" && a.employeeId) {
      push(a.employeeId, a);
      continue;
    }
    if (scope === "EMPLOYEE_SUBGROUP" && a.employeeSubgroupId) {
      const empIds = subgroupToEmployees.get(a.employeeSubgroupId) ?? [];
      for (const id of empIds) push(id, a);
      continue;
    }
    if (scope === "EMPLOYEE_GROUP" && a.employeeGroupId) {
      const empIds = groupToEmployees.get(a.employeeGroupId) ?? [];
      for (const id of empIds) push(id, a);
      continue;
    }
    if (scope === "BRANCH" && a.branchId) {
      const empIds = branchToEmployees.get(a.branchId) ?? [];
      for (const id of empIds) push(id, a);
      continue;
    }
  }

  // Choose best assignment per employee (same ordering)
  const chosenByEmployee = new Map<string, WorkScheduleAssignmentRow>();
  for (const [empId, arr] of buckets.entries()) {
    if (!arr.length) continue;
    arr.sort((a, b) => {
      const sr = scopeRank(String(a.scope)) - scopeRank(String(b.scope));
      if (sr !== 0) return -sr;
      const pr = (a.priority ?? 0) - (b.priority ?? 0);
      if (pr !== 0) return -pr;
      return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
    });
    chosenByEmployee.set(empId, arr[0]);
  }

  // Determine needed template ids, then batch fetch templates once
  const templateIdNeeded = new Set<string>();
  const computedIdxByEmp = new Map<string, { idx: number; pattern: any }>();

  const currentDay = DateTime.fromISO(args.dayKey, { zone: tz }).startOf("day");

  for (const [empId, chosen] of chosenByEmployee.entries()) {
    const pattern = chosen.pattern;
    if (!pattern) continue;
    const cycle = pattern.cycleLengthDays;
    if (!Number.isInteger(cycle) || cycle <= 0) continue;

    const refDayKey = dayKeyFromDbDate(pattern.referenceDate);
    const refDay = DateTime.fromISO(refDayKey, { zone: tz }).startOf("day");
    const diffDays = Math.floor(currentDay.diff(refDay, "days").days);
    const idx = positiveMod(diffDays, cycle);
    computedIdxByEmp.set(empId, { idx, pattern });

    const dayRow = (pattern as any).days?.find?.((d: any) => d.dayIndex === idx);
    if (dayRow) {
      if (dayRow.shiftTemplateId) templateIdNeeded.add(String(dayRow.shiftTemplateId));
      continue;
    }

    const legacyTplId = pattern.dayShiftTemplateIds?.[idx];
    if (legacyTplId) templateIdNeeded.add(String(legacyTplId));
  }

  const templates = templateIdNeeded.size
    ? await prisma.shiftTemplate.findMany({
        where: { companyId: args.companyId, id: { in: Array.from(templateIdNeeded) } },
        select: { id: true, shiftCode: true, signature: true, startTime: true, endTime: true, spansMidnight: true },
      })
    : [];
  const tplById = new Map<string, any>(templates.map((t) => [t.id, t]));

  // Build final resolved map
  for (const e of args.employees) {
    const chosen = chosenByEmployee.get(e.id);
    if (!chosen) continue;
    const meta = computedIdxByEmp.get(e.id);
    if (!meta) continue;
    const pattern = meta.pattern;
    const idx = meta.idx;

    const dayRow = (pattern as any).days?.find?.((d: any) => d.dayIndex === idx);
    if (dayRow) {
      if (!dayRow.shiftTemplateId) {
        out.set(e.id, { kind: "OFF" });
        continue;
      }
      const tpl = tplById.get(String(dayRow.shiftTemplateId));
      if (!tpl) {
        out.set(e.id, null);
        continue;
      }
      out.set(e.id, {
        kind: "SHIFT",
        shiftTemplateId: tpl.id,
        shiftCode: (tpl as any).shiftCode ?? tpl.signature,
        signature: {
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          spansMidnight: tpl.spansMidnight,
          signature: tpl.signature,
        },
      });
      continue;
    }

    const legacyTplId = pattern.dayShiftTemplateIds?.[idx];
    if (!legacyTplId) {
      out.set(e.id, { kind: "OFF" });
      continue;
    }
    const tpl = tplById.get(String(legacyTplId));
    if (!tpl) {
      out.set(e.id, null);
      continue;
    }
    out.set(e.id, {
      kind: "SHIFT",
      shiftTemplateId: tpl.id,
      shiftCode: (tpl as any).shiftCode ?? tpl.signature,
      signature: {
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        spansMidnight: tpl.spansMidnight,
        signature: tpl.signature,
      },
    });
  }

  return out;
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
  employeeContext?: EmployeeCtx | null;
}): Promise<WorkScheduleResolved | null> {
  const dayDb = dbDateFromDayKey(args.dayKey);

  const emp =
    args.employeeContext ??
    (await prisma.employee.findFirst({
      where: { companyId: args.companyId, id: args.employeeId },
      select: {
        id: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
        branchId: true,
      },
    }));
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