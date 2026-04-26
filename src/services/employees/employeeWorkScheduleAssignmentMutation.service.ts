import { Prisma, RecomputeReason } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import {
  buildFiniteRangeMutationPlan,
  nextDayKey,
  previousDayKey,
  toDayKey,
} from "@/src/services/employees/finiteRangeHistoryMutation.util";

type Tx = Prisma.TransactionClient;

type EmployeeWorkScheduleAssignmentRow = {
  id: string;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  patternId: string;
};

export type EmployeeWorkScheduleAssignmentMutationErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_DAY"
  | "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_DAY"
  | "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE"
  | "INVALID_WORK_SCHEDULE_PATTERN_ID";

export class EmployeeWorkScheduleAssignmentMutationError extends Error {
  code: EmployeeWorkScheduleAssignmentMutationErrorCode;
  meta?: Record<string, unknown>;

  constructor(
    code: EmployeeWorkScheduleAssignmentMutationErrorCode,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeWorkScheduleAssignmentMutationError";
    this.code = code;
    this.meta = meta;
  }
}

export function isEmployeeWorkScheduleAssignmentMutationError(
  error: unknown,
): error is EmployeeWorkScheduleAssignmentMutationError {
  return error instanceof EmployeeWorkScheduleAssignmentMutationError;
}

export type EmployeeWorkScheduleAssignmentMutationResult = {
  status: "changed" | "no_change";
  changed: boolean;
  employeeId: string;
  effectiveDayKey: string;
  assignmentId: string | null;
  patternId: string;
  mergedPairCount: number;
};

export type EmployeeWorkScheduleAssignmentMutationPlan =
  | {
      kind: "NO_OP";
      assignmentId: string | null;
      createValidToDayKey: null;
    }
  | {
      kind: "UPDATE_SAME_DAY";
      assignmentId: string;
      createValidToDayKey: null;
    }
  | {
      kind: "SPLIT";
      assignmentId: string;
      createValidToDayKey: string | null;
    }
  | {
      kind: "INSERT_GAP";
      assignmentId: null;
      createValidToDayKey: string | null;
    };

function isActiveOnDay(row: EmployeeWorkScheduleAssignmentRow, dayKey: string): boolean {
  const fromKey = toDayKey(row.validFrom);
  const toKey = toDayKey(row.validTo);

  if (fromKey && fromKey > dayKey) return false;
  if (!toKey) return true;
  return toKey >= dayKey;
}

function isAdjacentOrOverlapping(
  prev: EmployeeWorkScheduleAssignmentRow,
  next: EmployeeWorkScheduleAssignmentRow,
): boolean {
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

function findActiveRows(
  rows: EmployeeWorkScheduleAssignmentRow[],
  dayKey: string,
): EmployeeWorkScheduleAssignmentRow[] {
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

function findActiveRow(
  rows: EmployeeWorkScheduleAssignmentRow[],
  dayKey: string,
): EmployeeWorkScheduleAssignmentRow | null {
  const activeRows = findActiveRows(rows, dayKey);
  return activeRows[0] ?? null;
}

function findNextRow(
  rows: EmployeeWorkScheduleAssignmentRow[],
  dayKey: string,
): EmployeeWorkScheduleAssignmentRow | null {
  return (
    rows.find((row) => {
      const fromKey = toDayKey(row.validFrom);
      return !!fromKey && fromKey > dayKey;
    }) ?? null
  );
}

function intersectsFiniteRange(args: {
  row: EmployeeWorkScheduleAssignmentRow;
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

export function buildEmployeeWorkScheduleAssignmentMutationPlan(args: {
  rows: EmployeeWorkScheduleAssignmentRow[];
  effectiveDayKey: string;
  patternId: string;
}): EmployeeWorkScheduleAssignmentMutationPlan {
  const active = findActiveRow(args.rows, args.effectiveDayKey);

  if (active && active.patternId === args.patternId) {
    return {
      kind: "NO_OP",
      assignmentId: active.id,
      createValidToDayKey: null,
    };
  }

  if (active) {
    const activeFromKey = toDayKey(active.validFrom);

    if (activeFromKey === args.effectiveDayKey) {
      return {
        kind: "UPDATE_SAME_DAY",
        assignmentId: active.id,
        createValidToDayKey: null,
      };
    }

    return {
      kind: "SPLIT",
      assignmentId: active.id,
      createValidToDayKey: toDayKey(active.validTo),
    };
  }

  const nextRow = findNextRow(args.rows, args.effectiveDayKey);

  return {
    kind: "INSERT_GAP",
    assignmentId: null,
    createValidToDayKey: nextRow ? previousDayKey(toDayKey(nextRow.validFrom)!) : null,
  };
}

async function loadEmployeeWorkScheduleAssignments(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}): Promise<EmployeeWorkScheduleAssignmentRow[]> {
  return args.tx.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      scope: "EMPLOYEE",
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      patternId: true,
    },
  });
}

export function buildAppendEmployeeWorkScheduleAssignmentPlan(args: {
  rows: Array<{ id: string; validFrom: Date | null }>;
  effectiveDayKey: string;
}): { createValidToDayKey: string | null } {
  const nextRow = args.rows
    .map((row) => ({ ...row, validFromDayKey: toDayKey(row.validFrom) }))
    .filter((row): row is { id: string; validFrom: Date | null; validFromDayKey: string } =>
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

export async function ensureEmployeeExists(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  const employee = await args.tx.employee.findFirst({
    where: {
      companyId: args.companyId,
      id: args.employeeId,
    },
    select: { id: true },
  });

  if (!employee) {
    throw new EmployeeWorkScheduleAssignmentMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadı.",
      { employeeId: args.employeeId },
    );
  }
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
    throw new EmployeeWorkScheduleAssignmentMutationError(
      "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE",
      "Personel belirtilen etkili tarihte istihdam kapsamında değil.",
      {
        employeeId: args.employeeId,
        effectiveDayKey: args.effectiveDayKey,
      },
    );
  }
}

export async function validateWorkSchedulePattern(args: {
  tx: Tx;
  companyId: string;
  patternId: string;
}): Promise<string> {
  const pattern = await args.tx.workSchedulePattern.findFirst({
    where: {
      companyId: args.companyId,
      id: args.patternId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!pattern) {
    throw new EmployeeWorkScheduleAssignmentMutationError(
      "INVALID_WORK_SCHEDULE_PATTERN_ID",
      "Çalışma planı bulunamadı ya da pasif durumda.",
      { patternId: args.patternId },
    );
  }

  return pattern.id;
}

async function loadResolvedActiveAssignment(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
  strict?: boolean;
}) {
  const rows = await loadEmployeeWorkScheduleAssignments(args);
  const activeRows = findActiveRows(rows, args.dayKey);

  if (args.strict && activeRows.length > 1) {
    throw new EmployeeWorkScheduleAssignmentMutationError(
      "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_DAY",
      "İstenen gün için birden fazla aktif vardiya planı kaydı bulundu.",
      { dayKey: args.dayKey, employeeId: args.employeeId },
    );
  }

  const active = activeRows[0] ?? null;
  if (!active && args.strict) {
    throw new EmployeeWorkScheduleAssignmentMutationError(
      "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_DAY",
      "İstenen gün için aktif vardiya planı kaydı bulunamadı.",
      { dayKey: args.dayKey, employeeId: args.employeeId },
    );
  }

  return active;
}

export async function mergeAdjacentEmployeeWorkScheduleAssignments(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}): Promise<{ mergedPairCount: number }> {
  let mergedPairCount = 0;

  while (true) {
    const rows = await loadEmployeeWorkScheduleAssignments(args);
    let mergedInThisPass = false;

    for (let index = 1; index < rows.length; index += 1) {
      const prev = rows[index - 1];
      const next = rows[index];

      if (prev.patternId !== next.patternId) continue;
      if (!isAdjacentOrOverlapping(prev, next)) continue;

      const mergedValidTo = maxNullableDayKey(toDayKey(prev.validTo), toDayKey(next.validTo));

      await args.tx.workScheduleAssignment.update({
        where: { id: prev.id },
        data: {
          validTo: mergedValidTo ? dbDateFromDayKey(mergedValidTo) : null,
        },
        select: { id: true },
      });

      await args.tx.workScheduleAssignment.delete({
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

export async function applyEmployeeWorkScheduleAssignmentChange(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  patternId: string;
  effectiveDayKey: string;
  enforceEmploymentOnEffectiveDate?: boolean;
  strictResolve?: boolean;
}): Promise<EmployeeWorkScheduleAssignmentMutationResult> {
  await ensureEmployeeExists({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const patternId = await validateWorkSchedulePattern({
    tx: args.tx,
    companyId: args.companyId,
    patternId: args.patternId,
  });

  if (args.enforceEmploymentOnEffectiveDate !== false) {
    await ensureEmployeeEmployedOnDay({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.effectiveDayKey,
    });
  }

  const rows = await loadEmployeeWorkScheduleAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  if (args.strictResolve) {
    const activeRows = findActiveRows(rows, args.effectiveDayKey);
    if (activeRows.length > 1) {
      throw new EmployeeWorkScheduleAssignmentMutationError(
        "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_DAY",
        "İstenen gün için birden fazla aktif vardiya planı kaydı bulundu.",
        { dayKey: args.effectiveDayKey, employeeId: args.employeeId },
      );
    }
  }

  const plan = buildEmployeeWorkScheduleAssignmentMutationPlan({
    rows,
    effectiveDayKey: args.effectiveDayKey,
    patternId,
  });

  let changed = false;

  if (plan.kind === "UPDATE_SAME_DAY") {
    await args.tx.workScheduleAssignment.update({
      where: { id: plan.assignmentId },
      data: { patternId },
      select: { id: true },
    });
    changed = true;
  } else if (plan.kind === "SPLIT") {
    await args.tx.workScheduleAssignment.update({
      where: { id: plan.assignmentId },
      data: {
        validTo: dbDateFromDayKey(previousDayKey(args.effectiveDayKey)),
      },
      select: { id: true },
    });

    await args.tx.workScheduleAssignment.create({
      data: {
        companyId: args.companyId,
        scope: "EMPLOYEE",
        priority: 0,
        validFrom: dbDateFromDayKey(args.effectiveDayKey),
        validTo: plan.createValidToDayKey ? dbDateFromDayKey(plan.createValidToDayKey) : null,
        patternId,
        employeeId: args.employeeId,
        employeeSubgroupId: null,
        employeeGroupId: null,
        branchId: null,
      },
      select: { id: true },
    });
    changed = true;
  } else if (plan.kind === "INSERT_GAP") {
    await args.tx.workScheduleAssignment.create({
      data: {
        companyId: args.companyId,
        scope: "EMPLOYEE",
        priority: 0,
        validFrom: dbDateFromDayKey(args.effectiveDayKey),
        validTo: plan.createValidToDayKey ? dbDateFromDayKey(plan.createValidToDayKey) : null,
        patternId,
        employeeId: args.employeeId,
        employeeSubgroupId: null,
        employeeGroupId: null,
        branchId: null,
      },
      select: { id: true },
    });
    changed = true;
  }

  const mergeResult = await mergeAdjacentEmployeeWorkScheduleAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const resolved = await loadResolvedActiveAssignment({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.effectiveDayKey,
    strict: args.strictResolve,
  });

  return {
    status: changed ? "changed" : "no_change",
    changed,
    employeeId: args.employeeId,
    effectiveDayKey: args.effectiveDayKey,
    assignmentId: resolved?.id ?? null,
    patternId: resolved?.patternId ?? patternId,
    mergedPairCount: mergeResult.mergedPairCount,
  };
}

export async function applyEmployeeWorkScheduleAssignmentAppendVersionChange(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  patternId: string;
  effectiveDayKey: string;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeWorkScheduleAssignmentMutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const mutation = await applyEmployeeWorkScheduleAssignmentChange({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      patternId: args.patternId,
      effectiveDayKey: args.effectiveDayKey,
      enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
      strictResolve: true,
    });

    const assignment = mutation.assignmentId
      ? await tx.workScheduleAssignment.findUnique({
          where: { id: mutation.assignmentId },
          select: {
            id: true,
            validFrom: true,
            validTo: true,
            patternId: true,
          },
        })
      : null;

    if (!assignment) {
      throw new Error("WORK_SCHEDULE_ASSIGNMENT_NOT_FOUND_AFTER_MUTATION");
    }

    if (mutation.changed) {
      await tx.employeeAction.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          type: "UPDATE",
          effectiveDate: dbDateFromDayKey(args.effectiveDayKey),
          note: "Vardiya bilgileri için sürüm kaydı güncellendi.",
          actorUserId: args.actorUserId,
          details: {
            surface: "PROFILE",
            mode: "VERSIONED_EDIT",
            workScheduleAssignmentId: assignment.id,
            patternId: assignment.patternId,
            effectiveDayKey: args.effectiveDayKey,
            validToDayKey: toDayKey(assignment.validTo),
            mutationStatus: mutation.status,
            mergedPairCount: mutation.mergedPairCount,
            fields: ["workSchedulePatternId"],
          },
        },
        select: { id: true },
      });
    }

    return {
      ...mutation,
      assignmentId: assignment.id,
      patternId: assignment.patternId,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: args.effectiveDayKey,
    rangeEndDayKey: null,
  });

  return result;
}

export async function applyEmployeeWorkScheduleAssignmentFiniteRangeChange(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  patternId: string;
  startDayKey: string;
  endDayKey: string;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeWorkScheduleAssignmentMutationResult> {
  await ensureEmployeeExists({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const patternId = await validateWorkSchedulePattern({
    tx: args.tx,
    companyId: args.companyId,
    patternId: args.patternId,
  });

  if (args.enforceEmploymentOnEffectiveDate !== false) {
    await ensureEmployeeEmployedOnDay({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.startDayKey,
    });
  }

  const rows = await loadEmployeeWorkScheduleAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  const plan = buildFiniteRangeMutationPlan({
    rows: rows.map((row) => ({
      validFrom: row.validFrom,
      validTo: row.validTo,
      payload: row.patternId,
    })),
    startDayKey: args.startDayKey,
    endDayKey: args.endDayKey,
    payload: patternId,
    samePayload: (left, right) => left === right,
  });

  if (!plan.changed) {
    const mergeResult = await mergeAdjacentEmployeeWorkScheduleAssignments({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });
    const resolved = await loadResolvedActiveAssignment({
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
      assignmentId: resolved?.id ?? null,
      patternId: resolved?.patternId ?? patternId,
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
      await args.tx.workScheduleAssignment.update({
        where: { id: row.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });

      await args.tx.workScheduleAssignment.create({
        data: {
          companyId: args.companyId,
          scope: "EMPLOYEE",
          priority: 0,
          validFrom: dbDateFromDayKey(restoreDayKey),
          validTo: validToDayKey ? dbDateFromDayKey(validToDayKey) : null,
          patternId: row.patternId,
          employeeId: args.employeeId,
          employeeSubgroupId: null,
          employeeGroupId: null,
          branchId: null,
        },
        select: { id: true },
      });
      continue;
    }

    if (overlapsLeft) {
      await args.tx.workScheduleAssignment.update({
        where: { id: row.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });
      continue;
    }

    if (overlapsRight) {
      await args.tx.workScheduleAssignment.update({
        where: { id: row.id },
        data: { validFrom: dbDateFromDayKey(restoreDayKey) },
        select: { id: true },
      });
      continue;
    }

    await args.tx.workScheduleAssignment.delete({
      where: { id: row.id },
      select: { id: true },
    });
  }

  const created = await args.tx.workScheduleAssignment.create({
    data: {
      companyId: args.companyId,
      scope: "EMPLOYEE",
      priority: 0,
      validFrom: startDb,
      validTo: endDb,
      patternId,
      employeeId: args.employeeId,
      employeeSubgroupId: null,
      employeeGroupId: null,
      branchId: null,
    },
    select: { id: true },
  });
  touchedAssignmentId = created.id;

  const mergeResult = await mergeAdjacentEmployeeWorkScheduleAssignments({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });
  const resolved = await loadResolvedActiveAssignment({
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
    assignmentId: resolved?.id ?? touchedAssignmentId,
    patternId: resolved?.patternId ?? patternId,
    mergedPairCount: mergeResult.mergedPairCount,
  };
}
