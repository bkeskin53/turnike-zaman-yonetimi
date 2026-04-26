import crypto from "crypto";
import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { EmployeeImportSheetKind } from "@/src/features/employees/importTemplate";
import {
  EmployeeImportCodeResolutionSummary,
  EmployeeImportHeaderSummary,
  EmployeeImportValidationIssue,
} from "@/src/services/employees/importTemplateValidation.service";
import {
  EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
  EMPLOYEE_IMPORT_RUN_ISSUE_PREVIEW_LIMIT,
  employeeImportRunPreviewRetentionThresholdDate,
  employeeImportRunSnapshotRetentionThresholdDate,
  sanitizeEmployeeImportRunChangedEmployeeCodesPreview,
  sanitizeEmployeeImportRunIssuePreviewList,
} from "@/src/services/employees/employeeImportRunPrivacy.service";
import { parseCsvText } from "@/src/utils/csv";

export const EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES = 30;

type EmployeeImportApplyLockRecord = {
  id: string;
  actorUserId: string;
  acquiredAt: Date;
};

type EmployeeImportRunningApplyRunRecord = {
  id: string;
  actorUserId: string;
  startedAt: Date;
};

export type EmployeeImportApplyOperationalGuardPlan = {
  staleRunningRunIds: string[];
  shouldDeleteStaleLock: boolean;
  blockReason: "ACTIVE_LOCK" | "RUNNING_APPLY_WITHOUT_LOCK" | null;
  blockingLock: EmployeeImportApplyLockRecord | null;
  blockingRunningRun: EmployeeImportRunningApplyRunRecord | null;
};

export class EmployeeImportApplyLockError extends Error {
  code: "EMPLOYEE_IMPORT_APPLY_ALREADY_RUNNING";
  meta?: Record<string, unknown>;

  constructor(message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "EmployeeImportApplyLockError";
    this.code = "EMPLOYEE_IMPORT_APPLY_ALREADY_RUNNING";
    this.meta = meta;
  }
}

export function isEmployeeImportApplyLockError(error: unknown): error is EmployeeImportApplyLockError {
  return error instanceof EmployeeImportApplyLockError;
}

export type EmployeeImportRunDuplicateInfo = {
  id: string;
  status: EmployeeImportRunStatus;
  outcome: EmployeeImportRunOutcome | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export function canonicalizeEmployeeImportContent(args: {
  csvText: string;
  sheetKind: EmployeeImportSheetKind;
}): string {
  const parsed = parseCsvText(args.csvText);
  const canonicalRows = parsed.rows.map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t"));
  return [args.sheetKind, ...canonicalRows].join("\n");
}

export function buildEmployeeImportContentHash(args: {
  csvText: string;
  sheetKind: EmployeeImportSheetKind;
}): string {
  return crypto.createHash("sha256").update(canonicalizeEmployeeImportContent(args), "utf8").digest("hex");
}

export async function findLatestSuccessfulEmployeeImportRunByHash(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  contentHash: string;
}): Promise<EmployeeImportRunDuplicateInfo | null> {
  const run = await prisma.employeeImportRun.findFirst({
    where: {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      mode: EmployeeImportRunMode.APPLY,
      contentHash: args.contentHash,
      status: EmployeeImportRunStatus.COMPLETED,
    },
    orderBy: [{ finishedAt: "desc" }, { startedAt: "desc" }],
    select: {
      id: true,
      status: true,
      outcome: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  return run ?? null;
}

export function buildEmployeeImportDuplicateWarning(args: {
  sheetKind: EmployeeImportSheetKind;
  duplicateRunId: string;
}): EmployeeImportValidationIssue {
  return {
    line: 1,
    code: "DUPLICATE_CONTENT_PREVIOUSLY_APPLIED",
    message: `${args.sheetKind} icin ayni normalize icerik daha once apply edilmis olabilir. Onceki runId: ${args.duplicateRunId}`,
    field: undefined,
    value: args.duplicateRunId,
  };
}

function staleLockThresholdDate(): Date {
  return new Date(Date.now() - EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES * 60_000);
}

function staleRunThresholdDate(): Date {
  return staleLockThresholdDate();
}

async function loadEmployeeImportApplyOperationalState(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
}) {
  const [existingLock, runningApplyRuns] = await Promise.all([
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
  ]);

  return {
    existingLock,
    runningApplyRuns,
  };
}

export function planEmployeeImportApplyOperationalGuard(args: {
  existingLock: EmployeeImportApplyLockRecord | null;
  runningApplyRuns: EmployeeImportRunningApplyRunRecord[];
  staleThresholdDate?: Date;
}): EmployeeImportApplyOperationalGuardPlan {
  const threshold = args.staleThresholdDate ?? staleRunThresholdDate();
  const staleRunningRuns = args.runningApplyRuns.filter((run) => run.startedAt < threshold);
  const freshRunningRuns = args.runningApplyRuns.filter((run) => run.startedAt >= threshold);
  const staleLock = Boolean(args.existingLock && args.existingLock.acquiredAt < threshold);

  if (args.existingLock && !staleLock) {
    return {
      staleRunningRunIds: staleRunningRuns.map((run) => run.id),
      shouldDeleteStaleLock: false,
      blockReason: "ACTIVE_LOCK",
      blockingLock: args.existingLock,
      blockingRunningRun: null,
    };
  }

  if (!args.existingLock && freshRunningRuns.length > 0) {
    return {
      staleRunningRunIds: staleRunningRuns.map((run) => run.id),
      shouldDeleteStaleLock: false,
      blockReason: "RUNNING_APPLY_WITHOUT_LOCK",
      blockingLock: null,
      blockingRunningRun: freshRunningRuns[0] ?? null,
    };
  }

  return {
    staleRunningRunIds: staleRunningRuns.map((run) => run.id),
    shouldDeleteStaleLock: staleLock,
    blockReason: null,
    blockingLock: null,
    blockingRunningRun: null,
  };
}

async function markEmployeeImportRunsFailed(args: {
  runIds: string[];
  failedCode: string;
  failedMessage: string;
}) {
  if (args.runIds.length === 0) return 0;

  const result = await prisma.employeeImportRun.updateMany({
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

async function recoverStaleEmployeeImportRuns(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  mode: EmployeeImportRunMode;
  failedCode: string;
  failedMessage: string;
}) {
  const staleRuns = await prisma.employeeImportRun.findMany({
    where: {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      mode: args.mode,
      status: EmployeeImportRunStatus.RUNNING,
      startedAt: { lt: staleRunThresholdDate() },
    },
    select: { id: true },
  });

  const runIds = staleRuns.map((run) => run.id);
  const recoveredCount = await markEmployeeImportRunsFailed({
    runIds,
    failedCode: args.failedCode,
    failedMessage: args.failedMessage,
  });

  return {
    runIds,
    recoveredCount,
  };
}

async function tryCreateApplyLock(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  actorUserId: string;
}) {
  return prisma.employeeImportApplyLock.create({
    data: {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      actorUserId: args.actorUserId,
    },
    select: {
      id: true,
      companyId: true,
      sheetKind: true,
      actorUserId: true,
      acquiredAt: true,
    },
  });
}

export async function acquireEmployeeImportApplyLock(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  actorUserId: string;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await loadEmployeeImportApplyOperationalState(args);
    const plan = planEmployeeImportApplyOperationalGuard({
      existingLock: state.existingLock,
      runningApplyRuns: state.runningApplyRuns,
    });

    if (plan.staleRunningRunIds.length > 0) {
      await markEmployeeImportRunsFailed({
        runIds: plan.staleRunningRunIds,
        failedCode: "EMPLOYEE_IMPORT_APPLY_STALE_RECOVERED",
        failedMessage:
          "Bu apply kosusu stale/orphan RUNNING durumda kaldigi icin operasyonel guard tarafindan FAILED durumuna alinmistir.",
      });
    }

    if (plan.shouldDeleteStaleLock) {
      await prisma.employeeImportApplyLock.delete({
        where: {
          companyId_sheetKind: {
            companyId: args.companyId,
            sheetKind: args.sheetKind,
          },
        },
        select: { id: true },
      }).catch(() => null);
    }

    if (plan.blockReason === "ACTIVE_LOCK") {
      throw new EmployeeImportApplyLockError(
        "Bu sheet icin baska bir import apply islemi halen calisiyor. Islem bitmeden yeni apply baslatilamaz.",
        {
          companyId: args.companyId,
          sheetKind: args.sheetKind,
          guardReason: plan.blockReason,
          actorUserId: plan.blockingLock?.actorUserId ?? null,
          acquiredAt: plan.blockingLock?.acquiredAt.toISOString() ?? null,
        },
      );
    }

    if (plan.blockReason === "RUNNING_APPLY_WITHOUT_LOCK") {
      throw new EmployeeImportApplyLockError(
        "Bu sheet icin lock kaydi bulunamadi ancak yakin zamanda baslatilmis RUNNING apply run mevcut. Operasyonel guard stale sure dolmadan yeni apply baslatilmasina izin vermez.",
        {
          companyId: args.companyId,
          sheetKind: args.sheetKind,
          guardReason: plan.blockReason,
          runId: plan.blockingRunningRun?.id ?? null,
          actorUserId: plan.blockingRunningRun?.actorUserId ?? null,
          startedAt: plan.blockingRunningRun?.startedAt.toISOString() ?? null,
        },
      );
    }

    try {
      return await tryCreateApplyLock(args);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt === 0) {
        continue;
      }
      throw error;
    }
  }

  throw new EmployeeImportApplyLockError(
    "Import apply lock durumu dogrulanamadi. Lutfen islemi tekrar deneyin.",
    {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      guardReason: "LOCK_ACQUIRE_RACE",
    },
  );
}

export async function releaseEmployeeImportApplyLock(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
}) {
  await prisma.employeeImportApplyLock.deleteMany({
    where: {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
    },
  });
}

export async function inspectEmployeeImportContent(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  csvText: string;
}) {
  const contentHash = buildEmployeeImportContentHash({
    csvText: args.csvText,
    sheetKind: args.sheetKind,
  });
  const duplicateRun = await findLatestSuccessfulEmployeeImportRunByHash({
    companyId: args.companyId,
    sheetKind: args.sheetKind,
    contentHash,
  });

  return {
    contentHash,
    duplicateRun,
  };
}

export async function startEmployeeImportApplyRun(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  sheetTitle: string;
  csvText: string;
  actorUserId: string;
  requestedCount: number;
  contentHash?: string;
  duplicateRun?: EmployeeImportRunDuplicateInfo | null;
}) {
  await pruneExpiredEmployeeImportRunInspectionPayloads({
    companyId: args.companyId,
  });

  await recoverStaleEmployeeImportRuns({
    companyId: args.companyId,
    sheetKind: args.sheetKind,
    mode: EmployeeImportRunMode.DRY_RUN,
    failedCode: "EMPLOYEE_IMPORT_DRY_RUN_STALE_RECOVERED",
    failedMessage:
      "Bu dry-run kosusu stale RUNNING durumda kaldigi icin apply baslangici sirasinda otomatik olarak FAILED durumuna alinmistir.",
  });

  const inspection =
    args.contentHash && typeof args.duplicateRun !== "undefined"
      ? {
          contentHash: args.contentHash,
          duplicateRun: args.duplicateRun,
        }
      : await inspectEmployeeImportContent({
          companyId: args.companyId,
          sheetKind: args.sheetKind,
          csvText: args.csvText,
        });

  await acquireEmployeeImportApplyLock({
    companyId: args.companyId,
    sheetKind: args.sheetKind,
    actorUserId: args.actorUserId,
  });

  try {
    const run = await prisma.employeeImportRun.create({
      data: {
        companyId: args.companyId,
        sheetKind: args.sheetKind,
        sheetTitle: args.sheetTitle,
        contentHash: inspection.contentHash,
        actorUserId: args.actorUserId,
        requestedCount: args.requestedCount,
        duplicateOfRunId: inspection.duplicateRun?.id ?? null,
      },
      select: {
        id: true,
        status: true,
        duplicateOfRunId: true,
      },
    });

    return {
      runId: run.id,
      duplicateOfRunId: run.duplicateOfRunId ?? null,
      contentHash: inspection.contentHash,
      duplicateRun: inspection.duplicateRun,
    };
  } catch (error) {
    await releaseEmployeeImportApplyLock({
      companyId: args.companyId,
      sheetKind: args.sheetKind,
    }).catch(() => null);
    throw error;
  }
}

function deriveRunStatusFromApplySummary(_summary: Record<string, unknown>): EmployeeImportRunStatus {
  void _summary;
  return EmployeeImportRunStatus.COMPLETED;
}

export function deriveEmployeeImportRunOutcomeFromCompletedApply(args: {
  summary: Record<string, unknown>;
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
}): EmployeeImportRunOutcome {
  const rejectedCount = typeof args.summary.rejected === "number" ? args.summary.rejected : 0;
  if (rejectedCount > 0) return EmployeeImportRunOutcome.PARTIAL;
  if (args.errors.length > 0) return EmployeeImportRunOutcome.BLOCKING;
  if (args.warnings.length > 0) return EmployeeImportRunOutcome.WARNING;
  return EmployeeImportRunOutcome.CLEAN;
}

function previewIssues(issues: EmployeeImportValidationIssue[]) {
  return sanitizeEmployeeImportRunIssuePreviewList(
    issues.slice(0, EMPLOYEE_IMPORT_RUN_ISSUE_PREVIEW_LIMIT).map((issue) => ({
      line: issue.line,
      employeeCode: issue.employeeCode ?? null,
      code: issue.code,
      message: issue.message,
      field: issue.field ?? null,
      value: issue.value ?? null,
    })),
  );
}

function previewChangedEmployeeCodes(employeeCodes: string[]) {
  return sanitizeEmployeeImportRunChangedEmployeeCodesPreview(
    Array.from(new Set(employeeCodes.map((code) => String(code ?? "").trim()).filter(Boolean))).slice(
      0,
      EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
    ),
  );
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function createEmployeeImportRun(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  sheetTitle: string;
  mode: EmployeeImportRunMode;
  contentHash: string;
  actorUserId: string;
  requestedCount: number;
  duplicateOfRunId?: string | null;
}) {
  return prisma.employeeImportRun.create({
    data: {
      companyId: args.companyId,
      sheetKind: args.sheetKind,
      sheetTitle: args.sheetTitle,
      mode: args.mode,
      contentHash: args.contentHash,
      actorUserId: args.actorUserId,
      requestedCount: args.requestedCount,
      duplicateOfRunId: args.duplicateOfRunId ?? null,
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      duplicateOfRunId: true,
    },
  });
}

export async function pruneExpiredEmployeeImportRunInspectionPayloads(args: {
  companyId: string;
}) {
  const previewThreshold = employeeImportRunPreviewRetentionThresholdDate();
  const snapshotThreshold = employeeImportRunSnapshotRetentionThresholdDate();

  const [previewResult, snapshotResult] = await Promise.all([
    prisma.employeeImportRun.updateMany({
      where: {
        companyId: args.companyId,
        status: { in: [EmployeeImportRunStatus.COMPLETED, EmployeeImportRunStatus.FAILED] },
        finishedAt: { lt: previewThreshold },
      },
      data: {
        warningsPreview: Prisma.JsonNull,
        errorsPreview: Prisma.JsonNull,
        changedEmployeeCodesPreview: [],
      },
    }),
    prisma.employeeImportRun.updateMany({
      where: {
        companyId: args.companyId,
        status: { in: [EmployeeImportRunStatus.COMPLETED, EmployeeImportRunStatus.FAILED] },
        finishedAt: { lt: snapshotThreshold },
      },
      data: {
        headerSummarySnapshot: Prisma.JsonNull,
        codeResolutionSnapshot: Prisma.JsonNull,
        applySummarySnapshot: Prisma.JsonNull,
      },
    }),
  ]);

  return {
    previewsPruned: previewResult.count,
    snapshotsPruned: snapshotResult.count,
  };
}

export async function startEmployeeImportDryRun(args: {
  companyId: string;
  sheetKind: EmployeeImportSheetKind;
  sheetTitle: string;
  csvText: string;
  actorUserId: string;
  requestedCount: number;
  contentHash?: string;
  duplicateRun?: EmployeeImportRunDuplicateInfo | null;
}) {
  await pruneExpiredEmployeeImportRunInspectionPayloads({
    companyId: args.companyId,
  });

  await recoverStaleEmployeeImportRuns({
    companyId: args.companyId,
    sheetKind: args.sheetKind,
    mode: EmployeeImportRunMode.DRY_RUN,
    failedCode: "EMPLOYEE_IMPORT_DRY_RUN_STALE_RECOVERED",
    failedMessage:
      "Bu dry-run kosusu stale RUNNING durumda kaldigi icin yeni dogrulama baslangicinda otomatik olarak FAILED durumuna alinmistir.",
  });

  const inspection =
    args.contentHash && typeof args.duplicateRun !== "undefined"
      ? {
          contentHash: args.contentHash,
          duplicateRun: args.duplicateRun,
        }
      : await inspectEmployeeImportContent({
          companyId: args.companyId,
          sheetKind: args.sheetKind,
          csvText: args.csvText,
        });

  const run = await createEmployeeImportRun({
    companyId: args.companyId,
    sheetKind: args.sheetKind,
    sheetTitle: args.sheetTitle,
    mode: EmployeeImportRunMode.DRY_RUN,
    contentHash: inspection.contentHash,
    actorUserId: args.actorUserId,
    requestedCount: args.requestedCount,
    duplicateOfRunId: inspection.duplicateRun?.id ?? null,
  });

  return {
    runId: run.id,
    duplicateOfRunId: run.duplicateOfRunId ?? null,
    contentHash: inspection.contentHash,
    duplicateRun: inspection.duplicateRun,
    outcome: run.outcome,
  };
}

export async function completeEmployeeImportApplyRun(args: {
  runId: string;
  summary: Record<string, unknown>;
  processedCount?: number | null;
  headerSummarySnapshot?: EmployeeImportHeaderSummary | null;
  codeResolutionSnapshot?: EmployeeImportCodeResolutionSummary | null;
  changedEmployeeCodesPreview: string[];
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
}) {
  const requestedCount = typeof args.summary.requested === "number" ? args.summary.requested : 0;
  const processedCount = typeof args.processedCount === "number" ? args.processedCount : requestedCount;
  const foundCount = typeof args.summary.found === "number" ? args.summary.found : null;
  const changedCount = typeof args.summary.changed === "number" ? args.summary.changed : null;
  const unchangedCount = typeof args.summary.unchanged === "number" ? args.summary.unchanged : null;
  const rejectedCount = typeof args.summary.rejected === "number" ? args.summary.rejected : null;
  const status = deriveRunStatusFromApplySummary(args.summary);
  const outcome = deriveEmployeeImportRunOutcomeFromCompletedApply(args);

  return prisma.employeeImportRun.update({
    where: { id: args.runId },
    data: {
      status,
      outcome,
      requestedCount,
      processedCount,
      foundCount,
      changedCount,
      unchangedCount,
      rejectedCount,
      warningCount: args.warnings.length,
      errorCount: args.errors.length,
      headerSummarySnapshot: args.headerSummarySnapshot ? asJsonValue(args.headerSummarySnapshot) : Prisma.JsonNull,
      codeResolutionSnapshot: args.codeResolutionSnapshot ? asJsonValue(args.codeResolutionSnapshot) : Prisma.JsonNull,
      applySummarySnapshot: asJsonValue(args.summary),
      changedEmployeeCodesPreview: previewChangedEmployeeCodes(args.changedEmployeeCodesPreview),
      warningsPreview: args.warnings.length > 0 ? asJsonValue(previewIssues(args.warnings)) : Prisma.JsonNull,
      errorsPreview: args.errors.length > 0 ? asJsonValue(previewIssues(args.errors)) : Prisma.JsonNull,
      finishedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      duplicateOfRunId: true,
    },
  });
}

export function deriveEmployeeImportRunOutcomeFromDryRun(args: {
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
}): EmployeeImportRunOutcome {
  if (args.errors.length > 0) return EmployeeImportRunOutcome.BLOCKING;
  if (args.warnings.length > 0) return EmployeeImportRunOutcome.WARNING;
  return EmployeeImportRunOutcome.CLEAN;
}

export async function completeEmployeeImportDryRun(args: {
  runId: string;
  requestedCount: number;
  processedCount: number;
  rejectedCount: number;
  headerSummarySnapshot: EmployeeImportHeaderSummary;
  codeResolutionSnapshot?: EmployeeImportCodeResolutionSummary | null;
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
}) {
  const outcome = deriveEmployeeImportRunOutcomeFromDryRun(args);

  return prisma.employeeImportRun.update({
    where: { id: args.runId },
    data: {
      status: EmployeeImportRunStatus.COMPLETED,
      outcome,
      requestedCount: args.requestedCount,
      processedCount: args.processedCount,
      rejectedCount: args.rejectedCount,
      warningCount: args.warnings.length,
      errorCount: args.errors.length,
      headerSummarySnapshot: asJsonValue(args.headerSummarySnapshot),
      codeResolutionSnapshot: args.codeResolutionSnapshot ? asJsonValue(args.codeResolutionSnapshot) : Prisma.JsonNull,
      warningsPreview: args.warnings.length > 0 ? asJsonValue(previewIssues(args.warnings)) : Prisma.JsonNull,
      errorsPreview: args.errors.length > 0 ? asJsonValue(previewIssues(args.errors)) : Prisma.JsonNull,
      applySummarySnapshot: Prisma.JsonNull,
      changedEmployeeCodesPreview: [],
      finishedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      duplicateOfRunId: true,
    },
  });
}

export async function failEmployeeImportDryRun(args: {
  runId: string;
  requestedCount?: number;
  processedCount?: number;
  rejectedCount?: number;
  failedCode: string;
  failedMessage: string;
  headerSummarySnapshot?: EmployeeImportHeaderSummary | null;
  codeResolutionSnapshot?: EmployeeImportCodeResolutionSummary | null;
  warnings?: EmployeeImportValidationIssue[];
  errors?: EmployeeImportValidationIssue[];
}) {
  const warningPreview = args.warnings?.length ? previewIssues(args.warnings) : null;
  const errorPreview = args.errors?.length ? previewIssues(args.errors) : null;

  return prisma.employeeImportRun.update({
    where: { id: args.runId },
    data: {
      status: EmployeeImportRunStatus.FAILED,
      outcome: EmployeeImportRunOutcome.BLOCKING,
      requestedCount: typeof args.requestedCount === "number" ? args.requestedCount : undefined,
      processedCount: typeof args.processedCount === "number" ? args.processedCount : undefined,
      rejectedCount: typeof args.rejectedCount === "number" ? args.rejectedCount : undefined,
      failedCode: args.failedCode,
      failedMessage: args.failedMessage,
      warningCount: args.warnings?.length ?? undefined,
      errorCount: args.errors?.length ?? undefined,
      headerSummarySnapshot: args.headerSummarySnapshot ? asJsonValue(args.headerSummarySnapshot) : undefined,
      codeResolutionSnapshot: args.codeResolutionSnapshot ? asJsonValue(args.codeResolutionSnapshot) : undefined,
      warningsPreview: warningPreview ? asJsonValue(warningPreview) : undefined,
      errorsPreview: errorPreview ? asJsonValue(errorPreview) : undefined,
      applySummarySnapshot: Prisma.JsonNull,
      changedEmployeeCodesPreview: [],
      finishedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      duplicateOfRunId: true,
    },
  });
}

export async function failEmployeeImportApplyRun(args: {
  runId: string;
  failedCode: string;
  failedMessage: string;
  processedCount?: number | null;
  headerSummarySnapshot?: EmployeeImportHeaderSummary | null;
  codeResolutionSnapshot?: EmployeeImportCodeResolutionSummary | null;
  warnings?: EmployeeImportValidationIssue[];
  errors?: EmployeeImportValidationIssue[];
}) {
  const warningPreview = args.warnings?.length ? previewIssues(args.warnings) : null;
  const errorPreview = args.errors?.length ? previewIssues(args.errors) : null;

  return prisma.employeeImportRun.update({
    where: { id: args.runId },
    data: {
      status: EmployeeImportRunStatus.FAILED,
      outcome: EmployeeImportRunOutcome.BLOCKING,
      failedCode: args.failedCode,
      failedMessage: args.failedMessage,
      processedCount: typeof args.processedCount === "number" ? args.processedCount : undefined,
      warningCount: args.warnings?.length ?? undefined,
      errorCount: args.errors?.length ?? undefined,
      headerSummarySnapshot: args.headerSummarySnapshot ? asJsonValue(args.headerSummarySnapshot) : undefined,
      codeResolutionSnapshot: args.codeResolutionSnapshot ? asJsonValue(args.codeResolutionSnapshot) : undefined,
      warningsPreview: warningPreview ? asJsonValue(warningPreview) : undefined,
      errorsPreview: errorPreview ? asJsonValue(errorPreview) : undefined,
      finishedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      duplicateOfRunId: true,
    },
  });
}
