import { Prisma, RecomputeReason } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  backfillEmployeeHistoryForEmployee,
  type EmployeeOrgContext,
} from "@/src/services/employeeHistory.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import {
  buildFiniteRangeMutationPlan,
  nextDayKey,
  previousDayKey,
  toDayKey,
} from "@/src/services/employees/finiteRangeHistoryMutation.util";

type Tx = Prisma.TransactionClient;

type EmployeeMirrorRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
};

type EmployeeOrgAssignmentRow = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
};

export type EmployeeOrgAssignmentMutationErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_DAY"
  | "NO_ACTIVE_ORG_ASSIGNMENT_FOR_DAY"
  | "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE"
  | "BRANCH_REQUIRED"
  | "EMPLOYEE_GROUP_REQUIRED"
  | "EMPLOYEE_SUBGROUP_REQUIRED"
  | "INVALID_BRANCH_ID"
  | "INVALID_EMPLOYEE_GROUP_ID"
  | "INVALID_EMPLOYEE_SUBGROUP_ID"
  | "SUBGROUP_GROUP_MISMATCH";

export class EmployeeOrgAssignmentMutationError extends Error {
  code: EmployeeOrgAssignmentMutationErrorCode;
  meta?: Record<string, unknown>;

  constructor(code: EmployeeOrgAssignmentMutationErrorCode, message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "EmployeeOrgAssignmentMutationError";
    this.code = code;
    this.meta = meta;
  }
}

export function isEmployeeOrgAssignmentMutationError(
  error: unknown,
): error is EmployeeOrgAssignmentMutationError {
  return error instanceof EmployeeOrgAssignmentMutationError;
}

export type EmployeeOrgAssignmentMutationResult = {
  status: "changed" | "no_change";
  changed: boolean;
  employeeId: string;
  effectiveDayKey: string;
  assignmentId: string | null;
  context: EmployeeOrgContext;
  mirrorChanged: boolean;
  mergedPairCount: number;
};

export type BulkEmployeeLocationAssignmentRejectedItem = {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  code: EmployeeOrgAssignmentMutationErrorCode;
  message: string;
  meta?: Record<string, unknown>;
};

export type BulkEmployeeLocationAssignmentSummary = {
  requested: number;
  found: number;
  changed: number;
  unchanged: number;
  rejected: number;
};

export type BulkEmployeeLocationAssignmentResult = {
  summary: BulkEmployeeLocationAssignmentSummary;
  changedEmployeeIds: string[];
  unchangedEmployeeIds: string[];
  rejectedEmployees: BulkEmployeeLocationAssignmentRejectedItem[];
};

function uniqueIds(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function sameOrgContext(a: EmployeeOrgContext, b: EmployeeOrgContext): boolean {
  return (
    (a.branchId ?? null) === (b.branchId ?? null) &&
    (a.employeeGroupId ?? null) === (b.employeeGroupId ?? null) &&
    (a.employeeSubgroupId ?? null) === (b.employeeSubgroupId ?? null)
  );
}

function rowToOrgContext(row: Pick<EmployeeOrgAssignmentRow, "branchId" | "employeeGroupId" | "employeeSubgroupId">): EmployeeOrgContext {
  return {
    branchId: row.branchId ?? null,
    employeeGroupId: row.employeeGroupId ?? null,
    employeeSubgroupId: row.employeeSubgroupId ?? null,
  };
}

function employeeToOrgContext(employee: Pick<EmployeeMirrorRow, "branchId" | "employeeGroupId" | "employeeSubgroupId">): EmployeeOrgContext {
  return {
    branchId: employee.branchId ?? null,
    employeeGroupId: employee.employeeGroupId ?? null,
    employeeSubgroupId: employee.employeeSubgroupId ?? null,
  };
}

function buildFullName(employee: Pick<EmployeeMirrorRow, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function isActiveOnDay(row: EmployeeOrgAssignmentRow, dayKey: string): boolean {
  const fromKey = toDayKey(row.validFrom);
  const toKey = toDayKey(row.validTo);
  if (!fromKey) return false;
  if (fromKey > dayKey) return false;
  if (!toKey) return true;
  return toKey >= dayKey;
}

function isAdjacentOrOverlapping(prev: EmployeeOrgAssignmentRow, next: EmployeeOrgAssignmentRow): boolean {
  const prevEnd = toDayKey(prev.validTo);
  const nextStart = toDayKey(next.validFrom);
  if (!nextStart) return false;
  if (!prevEnd) return true;
  return nextDayKey(prevEnd) >= nextStart;
}

function maxNullableDayKey(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  return a >= b ? a : b;
}

async function loadEmployeeMirror(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}): Promise<EmployeeMirrorRow | null> {
  return args.tx.employee.findFirst({
    where: {
      companyId: args.companyId,
      id: args.employeeId,
    },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });
}

async function loadEmployeeOrgAssignments(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}): Promise<EmployeeOrgAssignmentRow[]> {
  return args.tx.employeeOrgAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });
}

function findActiveRows(rows: EmployeeOrgAssignmentRow[], dayKey: string): EmployeeOrgAssignmentRow[] {
  const activeRows = rows.filter((row) => isActiveOnDay(row, dayKey));
  activeRows.sort((a, b) => {
    const aFrom = toDayKey(a.validFrom) ?? "";
    const bFrom = toDayKey(b.validFrom) ?? "";
    if (aFrom !== bFrom) return bFrom.localeCompare(aFrom);
    const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (updatedDelta !== 0) return updatedDelta;
    const createdDelta = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;
    return b.id.localeCompare(a.id);
  });
  return activeRows;
}

function findActiveRow(rows: EmployeeOrgAssignmentRow[], dayKey: string): EmployeeOrgAssignmentRow | null {
  const activeRows = findActiveRows(rows, dayKey);
  return activeRows[0] ?? null;
}

function findNextRow(rows: EmployeeOrgAssignmentRow[], dayKey: string): EmployeeOrgAssignmentRow | null {
  return rows.find((row) => {
    const fromKey = toDayKey(row.validFrom);
    return !!fromKey && fromKey > dayKey;
  }) ?? null;
}

function resolveBaseOrgContextForDay(args: {
  rows: EmployeeOrgAssignmentRow[];
  employee: EmployeeMirrorRow;
  dayKey: string;
}): EmployeeOrgContext {
  const active = findActiveRow(args.rows, args.dayKey);
  if (active) return rowToOrgContext(active);

  let previous: EmployeeOrgAssignmentRow | null = null;
  for (const row of args.rows) {
    const fromKey = toDayKey(row.validFrom);
    if (fromKey && fromKey <= args.dayKey) previous = row;
  }
  if (previous) return rowToOrgContext(previous);

  const next = findNextRow(args.rows, args.dayKey);
  if (next) return rowToOrgContext(next);

  return employeeToOrgContext(args.employee);
}

export async function ensureEmployeeEmployedOnDay(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
}) {
  const effectiveDb = dbDateFromDayKey(args.effectiveDayKey);

  const period = await args.tx.employeeEmploymentPeriod.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      startDate: { lte: effectiveDb },
      OR: [{ endDate: null }, { endDate: { gte: effectiveDb } }],
    },
    select: { id: true },
  });

  if (!period) {
    throw new EmployeeOrgAssignmentMutationError(
      "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE",
      "Personel belirtilen etkili tarihte istihdam kapsamında değil.",
      {
        employeeId: args.employeeId,
        effectiveDayKey: args.effectiveDayKey,
      },
    );
  }
}

export async function validateEmployeeOrgContext(args: {
  tx: Tx;
  companyId: string;
  payload: EmployeeOrgContext;
}): Promise<EmployeeOrgContext> {
  const branchId = args.payload.branchId ?? null;
  const employeeGroupId = args.payload.employeeGroupId ?? null;
  const employeeSubgroupId = args.payload.employeeSubgroupId ?? null;

  if (branchId) {
    const branch = await args.tx.branch.findFirst({
      where: {
        companyId: args.companyId,
        id: branchId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new EmployeeOrgAssignmentMutationError(
        "INVALID_BRANCH_ID",
        "Lokasyon bulunamadı ya da pasif durumda.",
        { branchId },
      );
    }
  }

  let resolvedGroupId = employeeGroupId;
  if (employeeGroupId) {
    const group = await args.tx.employeeGroup.findFirst({
      where: {
        companyId: args.companyId,
        id: employeeGroupId,
      },
      select: { id: true },
    });

    if (!group) {
      throw new EmployeeOrgAssignmentMutationError(
        "INVALID_EMPLOYEE_GROUP_ID",
        "Çalışan grubu bulunamadı.",
        { employeeGroupId },
      );
    }
  }

  if (employeeSubgroupId) {
    const subgroup = await args.tx.employeeSubgroup.findFirst({
      where: {
        companyId: args.companyId,
        id: employeeSubgroupId,
      },
      select: { id: true, groupId: true },
    });

    if (!subgroup) {
      throw new EmployeeOrgAssignmentMutationError(
        "INVALID_EMPLOYEE_SUBGROUP_ID",
        "Çalışan alt grubu bulunamadı.",
        { employeeSubgroupId },
      );
    }

    if (resolvedGroupId && resolvedGroupId !== subgroup.groupId) {
      throw new EmployeeOrgAssignmentMutationError(
        "SUBGROUP_GROUP_MISMATCH",
        "Seçilen alt grup ile grup birbirine ait değil.",
        {
          employeeGroupId: resolvedGroupId,
          employeeSubgroupId,
          subgroupGroupId: subgroup.groupId,
        },
      );
    }

    resolvedGroupId = subgroup.groupId;
  }

  return {
    branchId,
    employeeGroupId: resolvedGroupId,
    employeeSubgroupId,
  };
}

async function loadResolvedActiveContext(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
  strict?: boolean;
}): Promise<{ assignmentId: string | null; context: EmployeeOrgContext }> {
  const rows = await loadEmployeeOrgAssignments(args);
  const activeRows = findActiveRows(rows, args.dayKey);
  if (args.strict && activeRows.length > 1) {
    throw new EmployeeOrgAssignmentMutationError(
      "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_DAY",
      "İstenen gün için birden fazla aktif organizasyon ataması bulundu.",
      { dayKey: args.dayKey, employeeId: args.employeeId },
    );
  }

  const active = activeRows[0] ?? null;
  if (active) {
    return {
      assignmentId: active.id,
      context: rowToOrgContext(active),
    };
  }

  const employee = await loadEmployeeMirror({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (args.strict) {
    throw new EmployeeOrgAssignmentMutationError(
      "NO_ACTIVE_ORG_ASSIGNMENT_FOR_DAY",
      "İstenen gün için aktif organizasyon ataması bulunamadı.",
      { dayKey: args.dayKey, employeeId: args.employeeId },
    );
  }

  return {
    assignmentId: null,
    context: employee ? employeeToOrgContext(employee) : { branchId: null, employeeGroupId: null, employeeSubgroupId: null },
  };
}

export function requireCompleteOrgContext(context: EmployeeOrgContext): EmployeeOrgContext {
  if (!context.branchId) {
    throw new EmployeeOrgAssignmentMutationError("BRANCH_REQUIRED", "Lokasyon seçimi zorunludur.");
  }
  if (!context.employeeGroupId) {
    throw new EmployeeOrgAssignmentMutationError("EMPLOYEE_GROUP_REQUIRED", "Grup seçimi zorunludur.");
  }
  if (!context.employeeSubgroupId) {
    throw new EmployeeOrgAssignmentMutationError("EMPLOYEE_SUBGROUP_REQUIRED", "Alt grup seçimi zorunludur.");
  }
  return context;
}

export function buildAppendEmployeeOrgAssignmentPlan(args: {
  rows: Array<{ id: string; validFrom: Date }>;
  effectiveDayKey: string;
}): { createValidToDayKey: string | null } {
  const nextRow = args.rows
    .map((row) => ({ ...row, validFromDayKey: toDayKey(row.validFrom) }))
    .filter((row): row is { id: string; validFrom: Date; validFromDayKey: string } =>
      Boolean(row.validFromDayKey && row.validFromDayKey > args.effectiveDayKey),
    )
    .sort((a, b) => {
      if (a.validFromDayKey !== b.validFromDayKey) return a.validFromDayKey.localeCompare(b.validFromDayKey);
      return a.id.localeCompare(b.id);
    })[0] ?? null;

  return {
    createValidToDayKey: nextRow ? previousDayKey(nextRow.validFromDayKey) : null,
  };
}

function intersectsFiniteRange(args: {
  row: EmployeeOrgAssignmentRow;
  startDayKey: string;
  endDayKey: string;
}): boolean {
  const validFromDayKey = toDayKey(args.row.validFrom);
  const validToDayKey = toDayKey(args.row.validTo);
  if (!validFromDayKey) return false;
  if (validFromDayKey > args.endDayKey) return false;
  if (validToDayKey && validToDayKey < args.startDayKey) return false;
  return true;
}

export async function mergeAdjacentEmployeeOrgAssignments(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}): Promise<{ mergedPairCount: number }> {
  let mergedPairCount = 0;

  while (true) {
    const rows = await loadEmployeeOrgAssignments(args);
    let mergedInThisPass = false;

    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1];
      const next = rows[i];

      if (!sameOrgContext(rowToOrgContext(prev), rowToOrgContext(next))) continue;
      if (!isAdjacentOrOverlapping(prev, next)) continue;

      const mergedValidTo = maxNullableDayKey(toDayKey(prev.validTo), toDayKey(next.validTo));

      await args.tx.employeeOrgAssignment.update({
        where: { id: prev.id },
        data: {
          validTo: mergedValidTo ? dbDateFromDayKey(mergedValidTo) : null,
        },
        select: { id: true },
      });

      await args.tx.employeeOrgAssignment.delete({
        where: { id: next.id },
        select: { id: true },
      });

      mergedPairCount += 1;
      mergedInThisPass = true;
      break;
    }

    if (!mergedInThisPass) break;
  }

  return { mergedPairCount };
}

export async function syncEmployeeCurrentOrgMirrorFromHistory(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  mirrorDayKey: string;
  strict?: boolean;
}): Promise<{ changed: boolean; context: EmployeeOrgContext }> {
  const employee = await loadEmployeeMirror({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (!employee) {
    throw new EmployeeOrgAssignmentMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadı.",
      { employeeId: args.employeeId },
    );
  }

  const resolved = await loadResolvedActiveContext({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.mirrorDayKey,
    strict: args.strict,
  });

  const currentMirror = employeeToOrgContext(employee);
  if (sameOrgContext(currentMirror, resolved.context)) {
    return {
      changed: false,
      context: resolved.context,
    };
  }

  await args.tx.employee.update({
    where: { id: employee.id },
    data: {
      branchId: resolved.context.branchId,
      employeeGroupId: resolved.context.employeeGroupId,
      employeeSubgroupId: resolved.context.employeeSubgroupId,
    },
    select: { id: true },
  });

  return {
    changed: true,
    context: resolved.context,
  };
}

export async function applyEmployeeOrgAssignmentChange(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
  mirrorDayKey: string;
  payload: EmployeeOrgContext;
  enforceEmploymentOnEffectiveDate?: boolean;
  strictMirrorSync?: boolean;
}): Promise<EmployeeOrgAssignmentMutationResult> {
  const employee = await loadEmployeeMirror({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (!employee) {
    throw new EmployeeOrgAssignmentMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadı.",
      { employeeId: args.employeeId },
    );
  }

  const payload = await validateEmployeeOrgContext({
    tx: args.tx,
    companyId: args.companyId,
    payload: args.payload,
  });

  if (args.enforceEmploymentOnEffectiveDate !== false) {
    await ensureEmployeeEmployedOnDay({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.effectiveDayKey,
    });
  }

  await backfillEmployeeHistoryForEmployee({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const rows = await loadEmployeeOrgAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const active = findActiveRow(rows, args.effectiveDayKey);

  if (active && sameOrgContext(rowToOrgContext(active), payload)) {
    const mirrorSync = await syncEmployeeCurrentOrgMirrorFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      mirrorDayKey: args.mirrorDayKey,
      strict: args.strictMirrorSync,
    });

    return {
      status: "no_change",
      changed: false,
      employeeId: args.employeeId,
      effectiveDayKey: args.effectiveDayKey,
      assignmentId: active.id,
      context: rowToOrgContext(active),
      mirrorChanged: mirrorSync.changed,
      mergedPairCount: 0,
    };
  }

  const effectiveDb = dbDateFromDayKey(args.effectiveDayKey);
  let touchedAssignmentId: string | null = null;

  if (active) {
    const activeFromKey = toDayKey(active.validFrom);

    if (activeFromKey === args.effectiveDayKey) {
      const updated = await args.tx.employeeOrgAssignment.update({
        where: { id: active.id },
        data: {
          branchId: payload.branchId,
          employeeGroupId: payload.employeeGroupId,
          employeeSubgroupId: payload.employeeSubgroupId,
        },
        select: { id: true },
      });
      touchedAssignmentId = updated.id;
    } else {
      await args.tx.employeeOrgAssignment.update({
        where: { id: active.id },
        data: {
          validTo: dbDateFromDayKey(previousDayKey(args.effectiveDayKey)),
        },
        select: { id: true },
      });

      const created = await args.tx.employeeOrgAssignment.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          validFrom: effectiveDb,
          validTo: active.validTo,
          branchId: payload.branchId,
          employeeGroupId: payload.employeeGroupId,
          employeeSubgroupId: payload.employeeSubgroupId,
        },
        select: { id: true },
      });
      touchedAssignmentId = created.id;
    }
  } else {
    const nextRow = findNextRow(rows, args.effectiveDayKey);
    const created = await args.tx.employeeOrgAssignment.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: effectiveDb,
        validTo: nextRow ? dbDateFromDayKey(previousDayKey(toDayKey(nextRow.validFrom)!)) : null,
        branchId: payload.branchId,
        employeeGroupId: payload.employeeGroupId,
        employeeSubgroupId: payload.employeeSubgroupId,
      },
      select: { id: true },
    });
    touchedAssignmentId = created.id;
  }

  const mergeResult = await mergeAdjacentEmployeeOrgAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const mirrorSync = await syncEmployeeCurrentOrgMirrorFromHistory({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    mirrorDayKey: args.mirrorDayKey,
    strict: args.strictMirrorSync,
  });

  const resolved = await loadResolvedActiveContext({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.effectiveDayKey,
    strict: args.strictMirrorSync,
  });

  return {
    status: "changed",
    changed: true,
    employeeId: args.employeeId,
    effectiveDayKey: args.effectiveDayKey,
    assignmentId: resolved.assignmentId ?? touchedAssignmentId,
    context: resolved.context,
    mirrorChanged: mirrorSync.changed,
    mergedPairCount: mergeResult.mergedPairCount,
  };
}

export async function applyEmployeeOrgAssignmentAppendVersionChange(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  effectiveDayKey: string;
  mirrorDayKey: string;
  payload: EmployeeOrgContext;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeOrgAssignmentMutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const mutation = await applyEmployeeOrgAssignmentChange({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.effectiveDayKey,
      mirrorDayKey: args.mirrorDayKey,
      payload: args.payload,
      enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
      strictMirrorSync: true,
    });

    const assignment = mutation.assignmentId
      ? await tx.employeeOrgAssignment.findUnique({
          where: { id: mutation.assignmentId },
          select: {
            id: true,
            validFrom: true,
            validTo: true,
          },
        })
      : null;

    if (mutation.changed) {
      await tx.employeeAction.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          type: "UPDATE",
          effectiveDate: dbDateFromDayKey(args.effectiveDayKey),
          note: "Organizasyon bilgileri için sürüm kaydı güncellendi.",
          actorUserId: args.actorUserId,
          details: {
            surface: "ASSIGNMENTS",
            mode: "VERSIONED_EDIT",
            assignmentId: assignment?.id ?? mutation.assignmentId,
            effectiveDayKey: args.effectiveDayKey,
            validToDayKey: assignment ? toDayKey(assignment.validTo) : null,
            mutationStatus: mutation.status,
            mergedPairCount: mutation.mergedPairCount,
            mirrorChanged: mutation.mirrorChanged,
            fields: ["branchId", "employeeGroupId", "employeeSubgroupId"],
          },
        },
        select: { id: true },
      });
    }

    return {
      ...mutation,
      assignmentId: assignment?.id ?? mutation.assignmentId,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORKFORCE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: args.effectiveDayKey,
    rangeEndDayKey: null,
  });

  return result;
}

export async function applyEmployeeOrgAssignmentFiniteRangeChange(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  startDayKey: string;
  endDayKey: string;
  mirrorDayKey: string;
  payload: EmployeeOrgContext;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeOrgAssignmentMutationResult> {
  const employee = await loadEmployeeMirror({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (!employee) {
    throw new EmployeeOrgAssignmentMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadÄ±.",
      { employeeId: args.employeeId },
    );
  }

  const payload = await validateEmployeeOrgContext({
    tx: args.tx,
    companyId: args.companyId,
    payload: args.payload,
  });

  if (args.enforceEmploymentOnEffectiveDate !== false) {
    await ensureEmployeeEmployedOnDay({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.startDayKey,
    });
  }

  await backfillEmployeeHistoryForEmployee({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const rows = await loadEmployeeOrgAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const plan = buildFiniteRangeMutationPlan({
    rows: rows.map((row) => ({
      validFrom: row.validFrom,
      validTo: row.validTo,
      payload: rowToOrgContext(row),
    })),
    startDayKey: args.startDayKey,
    endDayKey: args.endDayKey,
    payload,
    samePayload: sameOrgContext,
  });

  if (!plan.changed) {
    const mergeResult = await mergeAdjacentEmployeeOrgAssignments({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });
    const mirrorSync = await syncEmployeeCurrentOrgMirrorFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      mirrorDayKey: args.mirrorDayKey,
    });
    const resolved = await loadResolvedActiveContext({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.startDayKey,
    });

    return {
      status: "no_change",
      changed: false,
      employeeId: args.employeeId,
      effectiveDayKey: args.startDayKey,
      assignmentId: resolved.assignmentId,
      context: resolved.context,
      mirrorChanged: mirrorSync.changed,
      mergedPairCount: mergeResult.mergedPairCount,
    };
  }

  const startDb = dbDateFromDayKey(args.startDayKey);
  const endDb = dbDateFromDayKey(args.endDayKey);
  const restoreDayKey = nextDayKey(args.endDayKey);
  let touchedAssignmentId: string | null = null;

  for (const row of rows.filter((item) =>
    intersectsFiniteRange({
      row: item,
      startDayKey: args.startDayKey,
      endDayKey: args.endDayKey,
    }),
  )) {
    const validFromDayKey = toDayKey(row.validFrom)!;
    const validToDayKey = toDayKey(row.validTo);
    const overlapsLeft = validFromDayKey < args.startDayKey;
    const overlapsRight = !validToDayKey || validToDayKey > args.endDayKey;

    if (overlapsLeft && overlapsRight) {
      await args.tx.employeeOrgAssignment.update({
        where: { id: row.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });

      await args.tx.employeeOrgAssignment.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          validFrom: dbDateFromDayKey(restoreDayKey),
          validTo: validToDayKey ? dbDateFromDayKey(validToDayKey) : null,
          branchId: row.branchId,
          employeeGroupId: row.employeeGroupId,
          employeeSubgroupId: row.employeeSubgroupId,
        },
        select: { id: true },
      });
      continue;
    }

    if (overlapsLeft) {
      await args.tx.employeeOrgAssignment.update({
        where: { id: row.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });
      continue;
    }

    if (overlapsRight) {
      await args.tx.employeeOrgAssignment.update({
        where: { id: row.id },
        data: { validFrom: dbDateFromDayKey(restoreDayKey) },
        select: { id: true },
      });
      continue;
    }

    await args.tx.employeeOrgAssignment.delete({
      where: { id: row.id },
      select: { id: true },
    });
  }

  const created = await args.tx.employeeOrgAssignment.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      validFrom: startDb,
      validTo: endDb,
      branchId: payload.branchId,
      employeeGroupId: payload.employeeGroupId,
      employeeSubgroupId: payload.employeeSubgroupId,
    },
    select: { id: true },
  });
  touchedAssignmentId = created.id;

  const mergeResult = await mergeAdjacentEmployeeOrgAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });
  const mirrorSync = await syncEmployeeCurrentOrgMirrorFromHistory({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    mirrorDayKey: args.mirrorDayKey,
  });
  const resolved = await loadResolvedActiveContext({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.startDayKey,
  });

  return {
    status: "changed",
    changed: true,
    employeeId: args.employeeId,
    effectiveDayKey: args.startDayKey,
    assignmentId: resolved.assignmentId ?? touchedAssignmentId,
    context: resolved.context,
    mirrorChanged: mirrorSync.changed,
    mergedPairCount: mergeResult.mergedPairCount,
  };
}

export async function applyEmployeeLocationAssignmentChange(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  targetBranchId: string | null;
  effectiveDayKey: string;
  mirrorDayKey: string;
}): Promise<EmployeeOrgAssignmentMutationResult> {
  const employee = await loadEmployeeMirror({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (!employee) {
    throw new EmployeeOrgAssignmentMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadı.",
      { employeeId: args.employeeId },
    );
  }

  await backfillEmployeeHistoryForEmployee({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const rows = await loadEmployeeOrgAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const baseContext = resolveBaseOrgContextForDay({
    rows,
    employee,
    dayKey: args.effectiveDayKey,
  });

  return applyEmployeeOrgAssignmentChange({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    effectiveDayKey: args.effectiveDayKey,
    mirrorDayKey: args.mirrorDayKey,
    payload: {
      ...baseContext,
      branchId: args.targetBranchId,
    },
  });
}

export async function applyBulkEmployeeLocationAssignment(args: {
  companyId: string;
  employeeIds: string[];
  targetBranchId: string | null;
  effectiveDayKey: string;
  mirrorDayKey: string;
}): Promise<BulkEmployeeLocationAssignmentResult> {
  const requestedEmployeeIds = uniqueIds(args.employeeIds);

  if (requestedEmployeeIds.length === 0) {
    return {
      summary: {
        requested: 0,
        found: 0,
        changed: 0,
        unchanged: 0,
        rejected: 0,
      },
      changedEmployeeIds: [],
      unchangedEmployeeIds: [],
      rejectedEmployees: [],
    };
  }

  return prisma.$transaction(async (tx) => {
    await validateEmployeeOrgContext({
      tx,
      companyId: args.companyId,
      payload: {
        branchId: args.targetBranchId,
        employeeGroupId: null,
        employeeSubgroupId: null,
      },
    });

    const employees = await tx.employee.findMany({
      where: {
        companyId: args.companyId,
        id: { in: requestedEmployeeIds },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        branchId: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
      },
    });

    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const changedEmployeeIds: string[] = [];
    const unchangedEmployeeIds: string[] = [];
    const rejectedEmployees: BulkEmployeeLocationAssignmentRejectedItem[] = [];

    for (const employeeId of requestedEmployeeIds) {
      const employee = employeeById.get(employeeId);

      if (!employee) {
        rejectedEmployees.push({
          employeeId,
          employeeCode: null,
          fullName: "",
          code: "EMPLOYEE_NOT_FOUND",
          message: "Personel bulunamadı.",
          meta: { employeeId },
        });
        continue;
      }

      try {
        const result = await applyEmployeeLocationAssignmentChange({
          tx,
          companyId: args.companyId,
          employeeId: employee.id,
          targetBranchId: args.targetBranchId,
          effectiveDayKey: args.effectiveDayKey,
          mirrorDayKey: args.mirrorDayKey,
        });

        if (result.changed) changedEmployeeIds.push(employee.id);
        else unchangedEmployeeIds.push(employee.id);
      } catch (error) {
        if (!isEmployeeOrgAssignmentMutationError(error)) {
          throw error;
        }

        rejectedEmployees.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode ?? null,
          fullName: buildFullName(employee),
          code: error.code,
          message: error.message,
          meta: error.meta,
        });
      }
    }

    return {
      summary: {
        requested: requestedEmployeeIds.length,
        found: employees.length,
        changed: changedEmployeeIds.length,
        unchanged: unchangedEmployeeIds.length,
        rejected: rejectedEmployees.length,
      },
      changedEmployeeIds,
      unchangedEmployeeIds,
      rejectedEmployees,
    };
  });
}
