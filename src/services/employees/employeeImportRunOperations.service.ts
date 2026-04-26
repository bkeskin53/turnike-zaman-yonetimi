import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { EMPLOYEE_IMPORT_SHEETS, EmployeeImportSheetKind } from "@/src/features/employees/importTemplate";
import { employeeImportOperationalStaleThresholdDate } from "@/src/services/employees/employeeImportRunHealthQuery.service";

type EmployeeImportOperationalLockRecord = {
  id: string;
  actorUserId: string;
  acquiredAt: Date;
};

type EmployeeImportOperationalRunRecord = {
  id: string;
  actorUserId: string;
  startedAt: Date;
};

export type EmployeeImportOperationalRecoveryAction = "NORMALIZE_STALE_SHEET_STATE";

export type EmployeeImportOperationalRecoveryBlockReason =
  | "ACTIVE_LOCK"
  | "RUNNING_APPLY_WITHOUT_LOCK"
  | "FRESH_RUNNING_APPLY_PRESENT";

export type EmployeeImportOperationalRecoveryPlan = {
  staleThresholdDate: Date;
  blockReason: EmployeeImportOperationalRecoveryBlockReason | null;
  staleLockId: string | null;
  staleApplyRunIds: string[];
  staleDryRunIds: string[];
  activeApplyRunIds: string[];
};

export type EmployeeImportOperationalRecoveryResult = {
  action: EmployeeImportOperationalRecoveryAction;
  sheetKind: EmployeeImportSheetKind;
  staleThresholdDate: Date;
  blocked: false;
  noOp: boolean;
  lockDeleted: boolean;
  recoveredApplyRunIds: string[];
  recoveredDryRunIds: string[];
  recoveredApplyRunCount: number;
  recoveredDryRunCount: number;
};

export class EmployeeImportOperationalRecoveryError extends Error {
  code:
    | "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_INVALID_SHEET"
    | "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_BLOCKED";
  status: number;
  meta?: Record<string, unknown>;

  constructor(
    code:
      | "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_INVALID_SHEET"
      | "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_BLOCKED",
    message: string,
    status: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeImportOperationalRecoveryError";
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

export function isEmployeeImportOperationalRecoveryError(
  error: unknown,
): error is EmployeeImportOperationalRecoveryError {
  return error instanceof EmployeeImportOperationalRecoveryError;
}

export function normalizeEmployeeImportOperationalRecoverySheetKind(value: unknown): EmployeeImportSheetKind {
  const normalized = String(value ?? "").trim();
  const sheet = EMPLOYEE_IMPORT_SHEETS.find((item) => item.kind === normalized);
  if (!sheet || !sheet.importable) {
    throw new EmployeeImportOperationalRecoveryError(
      "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_INVALID_SHEET",
      "Recovery yalnızca import edilebilir sheet türleri için çalışır.",
      400,
      { sheetKind: normalized || null },
    );
  }
  return sheet.kind;
}

export function planEmployeeImportOperationalRecovery(args: {
  existingLock: EmployeeImportOperationalLockRecord | null;
  runningApplyRuns: EmployeeImportOperationalRunRecord[];
  runningDryRuns: EmployeeImportOperationalRunRecord[];
  staleThresholdDate?: Date;
}): EmployeeImportOperationalRecoveryPlan {
  const threshold = args.staleThresholdDate ?? employeeImportOperationalStaleThresholdDate();
  const staleLockId = args.existingLock && args.existingLock.acquiredAt < threshold ? args.existingLock.id : null;
  const hasFreshLock = Boolean(args.existingLock && args.existingLock.acquiredAt >= threshold);
  const staleApplyRunIds = args.runningApplyRuns.filter((run) => run.startedAt < threshold).map((run) => run.id);
  const freshApplyRunIds = args.runningApplyRuns.filter((run) => run.startedAt >= threshold).map((run) => run.id);
  const staleDryRunIds = args.runningDryRuns.filter((run) => run.startedAt < threshold).map((run) => run.id);

  if (hasFreshLock) {
    return {
      staleThresholdDate: threshold,
      blockReason: "ACTIVE_LOCK",
      staleLockId: null,
      staleApplyRunIds,
      staleDryRunIds,
      activeApplyRunIds: freshApplyRunIds,
    };
  }

  if (!args.existingLock && freshApplyRunIds.length > 0) {
    return {
      staleThresholdDate: threshold,
      blockReason: "RUNNING_APPLY_WITHOUT_LOCK",
      staleLockId: null,
      staleApplyRunIds,
      staleDryRunIds,
      activeApplyRunIds: freshApplyRunIds,
    };
  }

  if (args.existingLock && freshApplyRunIds.length > 0) {
    return {
      staleThresholdDate: threshold,
      blockReason: "FRESH_RUNNING_APPLY_PRESENT",
      staleLockId: null,
      staleApplyRunIds,
      staleDryRunIds,
      activeApplyRunIds: freshApplyRunIds,
    };
  }

  return {
    staleThresholdDate: threshold,
    blockReason: null,
    staleLockId,
    staleApplyRunIds,
    staleDryRunIds,
    activeApplyRunIds: [],
  };
}

function buildRecoveryBlockedError(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  blockReason: EmployeeImportOperationalRecoveryBlockReason;
  activeApplyRunIds: string[];
}) {
  if (args.blockReason === "ACTIVE_LOCK") {
    return new EmployeeImportOperationalRecoveryError(
      "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_BLOCKED",
      "Bu sheet için taze apply kilidi bulunduğu için operasyonel recovery çalıştırılamaz.",
      409,
      {
        companyId: args.companyId,
        sheetKind: args.sheetKind,
        blockReason: args.blockReason,
      },
    );
  }

  if (args.blockReason === "RUNNING_APPLY_WITHOUT_LOCK") {
    return new EmployeeImportOperationalRecoveryError(
      "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_BLOCKED",
      "Bu sheet için taze RUNNING apply koşusu bulunduğu için recovery stale eşik dolmadan çalıştırılamaz.",
      409,
      {
        companyId: args.companyId,
        sheetKind: args.sheetKind,
        blockReason: args.blockReason,
        runIds: args.activeApplyRunIds,
      },
    );
  }

  return new EmployeeImportOperationalRecoveryError(
    "EMPLOYEE_IMPORT_OPERATIONAL_RECOVERY_BLOCKED",
    "Bu sheet için taze RUNNING apply koşusu bulunduğu için stale lock temizliği güvenli değil. Recovery işlemi durduruldu.",
    409,
    {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      blockReason: args.blockReason,
      runIds: args.activeApplyRunIds,
    },
  );
}

async function markEmployeeImportRunsRecovered(args: {
  tx: Prisma.TransactionClient;
  runIds: string[];
  failedCode: string;
  failedMessage: string;
}) {
  if (args.runIds.length === 0) return 0;
  const result = await args.tx.employeeImportRun.updateMany({
    where: {
      id: { in: args.runIds },
      status: EmployeeImportRunStatus.RUNNING,
    },
    data: {
      status: EmployeeImportRunStatus.FAILED,
      outcome: EmployeeImportRunOutcome.BLOCKING,
      failedCode: args.failedCode,
      failedMessage: args.failedMessage,
      finishedAt: new Date(),
    },
  });
  return result.count;
}

export async function normalizeEmployeeImportSheetOperationalState(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
}): Promise<EmployeeImportOperationalRecoveryResult> {
  const [existingLock, runningApplyRuns, runningDryRuns] = await Promise.all([
    prisma.employeeImportApplyLock.findUnique({
      where: {
        companyId_sheetKind: {
          companyId: args.companyId,
          sheetKind: args.sheetKind,
        },
      },
      select: {
        id: true,
        actorUserId: true,
        acquiredAt: true,
      },
    }),
    prisma.employeeImportRun.findMany({
      where: {
        companyId: args.companyId,
        sheetKind: args.sheetKind,
        mode: EmployeeImportRunMode.APPLY,
        status: EmployeeImportRunStatus.RUNNING,
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        actorUserId: true,
        startedAt: true,
      },
    }),
    prisma.employeeImportRun.findMany({
      where: {
        companyId: args.companyId,
        sheetKind: args.sheetKind,
        mode: EmployeeImportRunMode.DRY_RUN,
        status: EmployeeImportRunStatus.RUNNING,
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        actorUserId: true,
        startedAt: true,
      },
    }),
  ]);

  const plan = planEmployeeImportOperationalRecovery({
    existingLock,
    runningApplyRuns,
    runningDryRuns,
  });

  if (plan.blockReason) {
    throw buildRecoveryBlockedError({
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      blockReason: plan.blockReason,
      activeApplyRunIds: plan.activeApplyRunIds,
    });
  }

  const staleLockWhere = existingLock && plan.staleLockId
    ? {
        companyId_sheetKind: {
          companyId: args.companyId,
          sheetKind: args.sheetKind,
        },
      }
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const recoveredApplyRunCount = await markEmployeeImportRunsRecovered({
      tx,
      runIds: plan.staleApplyRunIds,
      failedCode: "EMPLOYEE_IMPORT_APPLY_MANUAL_OPERATIONAL_RECOVERY",
      failedMessage:
        "Bu apply kosusu stale/orphan RUNNING durumda kaldigi icin manuel operasyonel recovery tarafindan FAILED durumuna alinmistir.",
    });

    const recoveredDryRunCount = await markEmployeeImportRunsRecovered({
      tx,
      runIds: plan.staleDryRunIds,
      failedCode: "EMPLOYEE_IMPORT_DRY_RUN_MANUAL_OPERATIONAL_RECOVERY",
      failedMessage:
        "Bu kontrol kosusu stale/orphan RUNNING durumda kaldigi icin manuel operasyonel recovery tarafindan FAILED durumuna alinmistir.",
    });

    let lockDeleted = false;
    if (staleLockWhere) {
      const deleted = await tx.employeeImportApplyLock
        .delete({
          where: staleLockWhere,
          select: { id: true },
        })
        .catch(() => null);
      lockDeleted = Boolean(deleted);
    }

    return {
      recoveredApplyRunCount,
      recoveredDryRunCount,
      lockDeleted,
    };
  });

  return {
    action: "NORMALIZE_STALE_SHEET_STATE",
    sheetKind: args.sheetKind,
    staleThresholdDate: plan.staleThresholdDate,
    blocked: false,
    noOp: !result.lockDeleted && result.recoveredApplyRunCount === 0 && result.recoveredDryRunCount === 0,
    lockDeleted: result.lockDeleted,
    recoveredApplyRunIds: plan.staleApplyRunIds,
    recoveredDryRunIds: plan.staleDryRunIds,
    recoveredApplyRunCount: result.recoveredApplyRunCount,
    recoveredDryRunCount: result.recoveredDryRunCount,
  };
}
