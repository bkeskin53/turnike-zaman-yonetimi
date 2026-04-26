import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

type Tx = Prisma.TransactionClient;

type EmployeeEmploymentPeriodRow = {
  id: string;
  startDate: Date;
  endDate: Date | null;
  reason: string | null;
};

export type EmployeeEmploymentLifecycleAction = "HIRE" | "TERMINATE" | "REHIRE";

export type EmployeeEmploymentLifecycleMutationErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "NO_OPEN_EMPLOYMENT"
  | "END_BEFORE_START"
  | "EMPLOYMENT_OVERLAP"
  | "EMPLOYMENT_HISTORY_EXISTS"
  | "EMPLOYMENT_HISTORY_REQUIRED";

export class EmployeeEmploymentLifecycleMutationError extends Error {
  code: EmployeeEmploymentLifecycleMutationErrorCode;
  meta?: Record<string, unknown>;

  constructor(
    code: EmployeeEmploymentLifecycleMutationErrorCode,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeEmploymentLifecycleMutationError";
    this.code = code;
    this.meta = meta;
  }
}

export function isEmployeeEmploymentLifecycleMutationError(
  error: unknown,
): error is EmployeeEmploymentLifecycleMutationError {
  return error instanceof EmployeeEmploymentLifecycleMutationError;
}

export type EmployeeEmploymentLifecyclePeriodWindow = {
  id: string;
  startDayKey: string;
  endDayKey: string | null;
  reason: string | null;
};

export type EmployeeEmploymentLifecycleMutationPlan =
  | {
      kind: "NO_OP";
      action: EmployeeEmploymentLifecycleAction;
      effectiveDayKey: string;
      periodId: string | null;
    }
  | {
      kind: "CREATE_PERIOD";
      action: "HIRE" | "REHIRE";
      effectiveDayKey: string;
    }
  | {
      kind: "CLOSE_OPEN_PERIOD";
      action: "TERMINATE";
      effectiveDayKey: string;
      openPeriod: EmployeeEmploymentLifecyclePeriodWindow;
    }
  | {
      kind: "REJECTED";
      action: EmployeeEmploymentLifecycleAction;
      effectiveDayKey: string;
      code: EmployeeEmploymentLifecycleMutationErrorCode;
      message: string;
      meta?: Record<string, unknown>;
    };

export type EmployeeEmploymentLifecycleMutationResult = {
  status: "changed" | "no_change";
  changed: boolean;
  action: EmployeeEmploymentLifecycleAction;
  employeeId: string;
  periodId: string | null;
  effectiveDayKey: string;
  derivedIsActive: boolean;
  employee: {
    id: string;
    isActive: boolean;
    hiredAt: string | null;
    terminatedAt: string | null;
  };
  cleanup:
    | {
        leavesDeleted: number;
        leavesTrimmed: number;
        weeklyPlansDeleted: number;
        adjustmentsDeleted: number;
      }
    | null;
};

function toDayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function normalizePeriods(
  rows: Array<Pick<EmployeeEmploymentPeriodRow, "id" | "startDate" | "endDate" | "reason">>,
): EmployeeEmploymentLifecyclePeriodWindow[] {
  return rows
    .map((row) => ({
      id: row.id,
      startDayKey: toDayKey(row.startDate)!,
      endDayKey: toDayKey(row.endDate),
      reason: row.reason ?? null,
    }))
    .sort((a, b) => a.startDayKey.localeCompare(b.startDayKey) || a.id.localeCompare(b.id));
}

function findOpenPeriods(periods: EmployeeEmploymentLifecyclePeriodWindow[]) {
  return periods.filter((period) => period.endDayKey === null);
}

function latestPeriod(
  periods: EmployeeEmploymentLifecyclePeriodWindow[],
): EmployeeEmploymentLifecyclePeriodWindow | null {
  return periods.length > 0 ? periods[periods.length - 1] : null;
}

function periodExtendsToOrPast(
  period: EmployeeEmploymentLifecyclePeriodWindow,
  dayKey: string,
): boolean {
  if (!period.endDayKey) return true;
  return period.endDayKey >= dayKey;
}

export function buildEmployeeEmploymentLifecycleMutationPlan(args: {
  action: EmployeeEmploymentLifecycleAction;
  effectiveDayKey: string;
  periods: Array<Pick<EmployeeEmploymentPeriodRow, "id" | "startDate" | "endDate" | "reason">>;
}): EmployeeEmploymentLifecycleMutationPlan {
  const periods = normalizePeriods(args.periods);
  const openPeriods = findOpenPeriods(periods);
  const latest = latestPeriod(periods);

  if (openPeriods.length > 1) {
    return {
      kind: "REJECTED",
      action: args.action,
      effectiveDayKey: args.effectiveDayKey,
      code: "EMPLOYMENT_OVERLAP",
      message: "Birden fazla acik istihdam donemi bulundu. Overlap olusmadan duzeltme gerekir.",
      meta: {
        openPeriodIds: openPeriods.map((period) => period.id),
      },
    };
  }

  if (args.action === "HIRE") {
    if (periods.length === 0) {
      return {
        kind: "CREATE_PERIOD",
        action: "HIRE",
        effectiveDayKey: args.effectiveDayKey,
      };
    }

    if (
      periods.length === 1 &&
      periods[0].startDayKey === args.effectiveDayKey &&
      periods[0].endDayKey === null
    ) {
      return {
        kind: "NO_OP",
        action: "HIRE",
        effectiveDayKey: args.effectiveDayKey,
        periodId: periods[0].id,
      };
    }

    return {
      kind: "REJECTED",
      action: "HIRE",
      effectiveDayKey: args.effectiveDayKey,
      code: "EMPLOYMENT_HISTORY_EXISTS",
      message:
        "Bu personel icin zaten istihdam gecmisi bulunuyor. Ilk kayit disinda HIRE yerine REHIRE kullanilmalidir.",
      meta: {
        latestPeriodId: latest?.id ?? null,
      },
    };
  }

  if (args.action === "TERMINATE") {
    const open = openPeriods[0] ?? null;
    if (open) {
      if (args.effectiveDayKey < open.startDayKey) {
        return {
          kind: "REJECTED",
          action: "TERMINATE",
          effectiveDayKey: args.effectiveDayKey,
          code: "END_BEFORE_START",
          message: "Cikis tarihi, acik istihdam donemi baslangic tarihinden once olamaz.",
          meta: {
            openPeriodId: open.id,
            openPeriodStartDayKey: open.startDayKey,
          },
        };
      }

      return {
        kind: "CLOSE_OPEN_PERIOD",
        action: "TERMINATE",
        effectiveDayKey: args.effectiveDayKey,
        openPeriod: open,
      };
    }

    if (latest && latest.endDayKey === args.effectiveDayKey) {
      return {
        kind: "NO_OP",
        action: "TERMINATE",
        effectiveDayKey: args.effectiveDayKey,
        periodId: latest.id,
      };
    }

    return {
      kind: "REJECTED",
      action: "TERMINATE",
      effectiveDayKey: args.effectiveDayKey,
      code: "NO_OPEN_EMPLOYMENT",
      message: "Acik istihdam kaydi bulunamadi.",
      meta: {
        latestPeriodId: latest?.id ?? null,
      },
    };
  }

  if (periods.length === 0) {
    return {
      kind: "REJECTED",
      action: "REHIRE",
      effectiveDayKey: args.effectiveDayKey,
      code: "EMPLOYMENT_HISTORY_REQUIRED",
      message: "REHIRE icin once kapanmis bir istihdam gecmisi gerekir.",
    };
  }

  const open = openPeriods[0] ?? null;
  if (open) {
    if (open.startDayKey === args.effectiveDayKey) {
      return {
        kind: "NO_OP",
        action: "REHIRE",
        effectiveDayKey: args.effectiveDayKey,
        periodId: open.id,
      };
    }

    return {
      kind: "REJECTED",
      action: "REHIRE",
      effectiveDayKey: args.effectiveDayKey,
      code: "EMPLOYMENT_OVERLAP",
      message: "Bu tarihte personel zaten aktif gorunuyor ya da acik employment period mevcut.",
      meta: {
        openPeriodId: open.id,
        openPeriodStartDayKey: open.startDayKey,
      },
    };
  }

  const overlap = periods.find((period) => periodExtendsToOrPast(period, args.effectiveDayKey));
  if (overlap) {
    return {
      kind: "REJECTED",
      action: "REHIRE",
      effectiveDayKey: args.effectiveDayKey,
      code: "EMPLOYMENT_OVERLAP",
      message:
        "REHIRE tarihi mevcut ya da ileri tarihli istihdam donemleriyle cakisiyor. Overlap olusmadan duzeltme gerekir.",
      meta: {
        overlapPeriodId: overlap.id,
        overlapPeriodStartDayKey: overlap.startDayKey,
        overlapPeriodEndDayKey: overlap.endDayKey,
      },
    };
  }

  return {
    kind: "CREATE_PERIOD",
    action: "REHIRE",
    effectiveDayKey: args.effectiveDayKey,
  };
}

function mergeActionDetails(args: {
  base: Prisma.InputJsonValue;
  extra?: Prisma.InputJsonValue;
}): Prisma.InputJsonValue {
  if (args.extra === undefined) return args.base;
  if (
    args.extra !== null &&
    typeof args.extra === "object" &&
    !Array.isArray(args.extra) &&
    args.base !== null &&
    typeof args.base === "object" &&
    !Array.isArray(args.base)
  ) {
    return {
      ...(args.base as Prisma.InputJsonObject),
      ...(args.extra as Prisma.InputJsonObject),
    } satisfies Prisma.InputJsonObject;
  }

  return {
    base: args.base,
    extra: args.extra,
  } satisfies Prisma.InputJsonObject;
}

async function cleanupAfterTermination(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
  timezone: string;
}) {
  const endDb = dbDateFromDayKey(args.effectiveDayKey);
  const endDayEndUtc = DateTime.fromISO(args.effectiveDayKey, { zone: args.timezone })
    .endOf("day")
    .toUTC()
    .toJSDate();

  const delLeaves = await args.tx.employeeLeave.deleteMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      dateFrom: { gt: endDayEndUtc },
    },
  });

  const trimLeaves = await args.tx.employeeLeave.updateMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      dateFrom: { lte: endDayEndUtc },
      dateTo: { gt: endDayEndUtc },
    },
    data: { dateTo: endDayEndUtc },
  });

  const delPlans = await args.tx.weeklyShiftPlan.deleteMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      weekStartDate: { gt: endDb },
    },
  });

  const delAdjustments = await args.tx.dailyAdjustment.deleteMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      date: { gt: endDb },
    },
  });

  return {
    leavesDeleted: delLeaves.count,
    leavesTrimmed: trimLeaves.count,
    weeklyPlansDeleted: delPlans.count,
    adjustmentsDeleted: delAdjustments.count,
  };
}

async function syncEmployeeEmploymentCacheFromHistory(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  todayKey: string;
}) {
  const todayDb = dbDateFromDayKey(args.todayKey);

  const [latestPeriod, activePeriod] = await Promise.all([
    args.tx.employeeEmploymentPeriod.findFirst({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    }),
    args.tx.employeeEmploymentPeriod.findFirst({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        startDate: { lte: todayDb },
        OR: [{ endDate: null }, { endDate: { gte: todayDb } }],
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
  ]);

  const derivedIsActive = Boolean(activePeriod);
  const updatedEmployee = await args.tx.employee.update({
    where: { id: args.employeeId, companyId: args.companyId },
    data: {
      isActive: derivedIsActive,
      hiredAt: latestPeriod?.startDate ?? null,
      terminatedAt: latestPeriod?.endDate ?? null,
    },
    select: {
      id: true,
      isActive: true,
      hiredAt: true,
      terminatedAt: true,
    },
  });

  return {
    derivedIsActive,
    employee: {
      id: updatedEmployee.id,
      isActive: updatedEmployee.isActive,
      hiredAt: toDayKey(updatedEmployee.hiredAt),
      terminatedAt: toDayKey(updatedEmployee.terminatedAt),
    },
    latestPeriodId: latestPeriod?.id ?? null,
  };
}

export async function applyEmployeeEmploymentLifecycleMutation(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  todayKey: string;
  actorUserId: string | null;
  action: EmployeeEmploymentLifecycleAction;
  effectiveDayKey: string;
  reason?: string | null;
  actionNote?: string | null;
  actionDetails?: Prisma.InputJsonValue;
  timezone?: string;
}): Promise<EmployeeEmploymentLifecycleMutationResult> {
  const employee = await args.tx.employee.findFirst({
    where: {
      companyId: args.companyId,
      id: args.employeeId,
    },
    select: { id: true },
  });

  if (!employee) {
    throw new EmployeeEmploymentLifecycleMutationError(
      "EMPLOYEE_NOT_FOUND",
      "Personel bulunamadi.",
      { employeeId: args.employeeId },
    );
  }

  const periods = await args.tx.employeeEmploymentPeriod.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
    },
  });

  const plan = buildEmployeeEmploymentLifecycleMutationPlan({
    action: args.action,
    effectiveDayKey: args.effectiveDayKey,
    periods,
  });

  if (plan.kind === "REJECTED") {
    throw new EmployeeEmploymentLifecycleMutationError(plan.code, plan.message, plan.meta);
  }

  if (plan.kind === "NO_OP") {
    const synced = await syncEmployeeEmploymentCacheFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      todayKey: args.todayKey,
    });

    return {
      status: "no_change",
      changed: false,
      action: plan.action,
      employeeId: args.employeeId,
      periodId: plan.periodId,
      effectiveDayKey: plan.effectiveDayKey,
      derivedIsActive: synced.derivedIsActive,
      employee: synced.employee,
      cleanup: null,
    };
  }

  if (plan.kind === "CREATE_PERIOD") {
    const createdPeriod = await args.tx.employeeEmploymentPeriod.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        startDate: dbDateFromDayKey(plan.effectiveDayKey),
        endDate: null,
        reason: args.reason ?? null,
      },
      select: { id: true },
    });

    await args.tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: plan.action,
        effectiveDate: dbDateFromDayKey(plan.effectiveDayKey),
        note: args.actionNote ?? args.reason ?? null,
        actorUserId: args.actorUserId ?? null,
        details: mergeActionDetails({
          base: {
            periodId: createdPeriod.id,
            startDate: plan.effectiveDayKey,
          },
          extra: args.actionDetails,
        }),
      },
    });

    const synced = await syncEmployeeEmploymentCacheFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      todayKey: args.todayKey,
    });

    return {
      status: "changed",
      changed: true,
      action: plan.action,
      employeeId: args.employeeId,
      periodId: createdPeriod.id,
      effectiveDayKey: plan.effectiveDayKey,
      derivedIsActive: synced.derivedIsActive,
      employee: synced.employee,
      cleanup: null,
    };
  }

  const timezone = args.timezone || "Europe/Istanbul";

  await args.tx.employeeEmploymentPeriod.update({
    where: { id: plan.openPeriod.id },
    data: {
      endDate: dbDateFromDayKey(plan.effectiveDayKey),
      reason: args.reason ?? plan.openPeriod.reason ?? null,
    },
    select: { id: true },
  });

  const cleanup = await cleanupAfterTermination({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    effectiveDayKey: plan.effectiveDayKey,
    timezone,
  });

  await args.tx.employeeAction.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      type: "TERMINATE",
      effectiveDate: dbDateFromDayKey(plan.effectiveDayKey),
      note: args.actionNote ?? args.reason ?? null,
      actorUserId: args.actorUserId ?? null,
      details: mergeActionDetails({
        base: {
          periodId: plan.openPeriod.id,
          startDate: plan.openPeriod.startDayKey,
          endDate: plan.effectiveDayKey,
          cleanup,
        },
        extra: args.actionDetails,
      }),
    },
  });

  const synced = await syncEmployeeEmploymentCacheFromHistory({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    todayKey: args.todayKey,
  });

  return {
    status: "changed",
    changed: true,
    action: "TERMINATE",
    employeeId: args.employeeId,
    periodId: plan.openPeriod.id,
    effectiveDayKey: plan.effectiveDayKey,
    derivedIsActive: synced.derivedIsActive,
    employee: synced.employee,
    cleanup,
  };
}
